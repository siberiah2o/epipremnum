"""
图片分析视图

提供图片分析的完整 API，合并原 TaskViewSet 和 ImageAnalysisViewSet 的功能

API 端点:
- POST   /api/llm/analyses/                # 创建分析
- POST   /api/llm/analyses/batch/          # 批量创建
- GET    /api/llm/analyses/                # 列表
- GET    /api/llm/analyses/{id}/           # 详情
- POST   /api/llm/analyses/{id}/retry/     # 重试
- POST   /api/llm/analyses/{id}/cancel/    # 取消
- POST   /api/llm/analyses/batch_retry/    # 批量重试
- POST   /api/llm/analyses/batch_cancel/   # 批量取消
- GET    /api/llm/analyses/stats/          # 统计
- GET    /api/llm/analyses/by_media/       # 按媒体查询
- POST   /api/llm/analyses/sync/           # 同步模型
"""

import logging
from django.utils import timezone
from django.db.models import F
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from django_q.tasks import async_task

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    BadRequestResponse,
    NotFoundResponse,
    ErrorResponse,
)
from llm.models import (
    Endpoint,
    AIModel,
    ImageAnalysis,
    AnalysisStatus,
)
from llm.serializers import (
    ImageAnalysisSerializer,
    ImageAnalysisUpdateSerializer,
    CreateAnalysisSerializer,
    BatchAnalyzeSerializer,
    BatchAnalysisActionSerializer,
    SyncModelsSerializer,
)
from llm.services import AnalysisService, SyncService
from llm.tasks import (
    execute_analysis_task,
    retry_analysis_task,
    sync_models_task,
)
from llm.exceptions import (
    LLMException,
    AnalysisAlreadyExistsError,
)

logger = logging.getLogger(__name__)


class AnalysisViewSet(viewsets.ModelViewSet):
    """
    分析视图集

    合并原 TaskViewSet 和 ImageAnalysisViewSet 的功能
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'media', 'model', 'error_type']
    search_fields = ['description', 'error_message']
    ordering_fields = ['created_at', 'completed_at', 'retry_count']
    ordering = ['-created_at']

    def get_queryset(self):
        """只返回当前用户的分析记录"""
        return ImageAnalysis.objects.filter(
            user=self.request.user
        ).select_related('media', 'model', 'endpoint')

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return CreateAnalysisSerializer
        return ImageAnalysisSerializer

    def create(self, request):
        """
        创建分析任务

        POST /api/llm/analyses/
        Body: { "media_id": 1, "model_id": 1 }
        """
        serializer = CreateAnalysisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media_id = serializer.validated_data['media_id']
        model_id = serializer.validated_data['model_id']

        try:
            # 使用服务层创建分析记录
            analysis = AnalysisService.create_analysis(
                media_id=media_id,
                model_id=model_id,
                user_id=request.user.id
            )
        except AnalysisAlreadyExistsError as e:
            return BadRequestResponse(e.message)
        except LLMException as e:
            return NotFoundResponse(e.message)

        # 创建异步任务
        async_task(
            execute_analysis_task,
            analysis.id,
            save=True
        )

        logger.info(f"分析任务已创建: analysis_id={analysis.id}")

        return CreatedResponse({
            'analysis_id': analysis.id,
            'message': '分析任务已创建，正在后台处理'
        })

    def list(self, request):
        """列表"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return SuccessResponse(serializer.data)

    def retrieve(self, request, pk=None):
        """详情"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return SuccessResponse(serializer.data)

    def destroy(self, request, pk=None):
        """删除分析记录"""
        instance = self.get_object()
        instance.delete()
        return NoContentResponse()

    @action(detail=False, methods=['post'])
    def batch(self, request):
        """
        批量创建分析任务

        POST /api/llm/analyses/batch/
        Body: { "media_ids": [1, 2, 3], "model_id": 1 }
        """
        serializer = BatchAnalyzeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        media_ids = serializer.validated_data['media_ids']
        model_id = serializer.validated_data['model_id']
        group = f"batch_{request.user.id}_{model_id}"

        created_ids = []
        skipped_count = 0

        for media_id in media_ids:
            try:
                analysis = AnalysisService.create_analysis(
                    media_id=media_id,
                    model_id=model_id,
                    user_id=request.user.id
                )
                created_ids.append(analysis.id)

                # 创建异步任务
                async_task(
                    execute_analysis_task,
                    analysis.id,
                    group=group,
                    save=True
                )
            except LLMException:
                skipped_count += 1
                continue

        logger.info(f"批量任务已创建: count={len(created_ids)}, skipped={skipped_count}")

        return CreatedResponse({
            'group': group,
            'count': len(created_ids),
            'analysis_ids': created_ids,
            'skipped': skipped_count,
            'message': f'已创建 {len(created_ids)} 个任务，跳过 {skipped_count} 个'
        })

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """
        重试分析

        POST /api/llm/analyses/{id}/retry/
        """
        instance = self.get_object()

        # 检查状态
        if instance.status == AnalysisStatus.PROCESSING:
            return BadRequestResponse('分析正在进行中，无需重试')

        if instance.status == AnalysisStatus.PENDING:
            return SuccessResponse({
                'message': '任务已在队列中等待处理',
                'status': instance.status
            })

        # 检查重试次数
        if instance.retry_count >= instance.max_retries:
            return BadRequestResponse(f'已达到最大重试次数 ({instance.max_retries})')

        # 重置状态
        instance.status = AnalysisStatus.PENDING
        instance.retry_count += 1
        instance.last_retry_at = timezone.now()
        instance.error_message = ''
        instance.error_details = {}
        instance.save()

        # 创建重试任务
        async_task(retry_analysis_task, instance.id, save=True)

        logger.info(f"重试任务已创建: analysis_id={instance.id}")

        return CreatedResponse({
            'retry_count': instance.retry_count,
            'message': '重试任务已创建'
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        取消分析

        POST /api/llm/analyses/{id}/cancel/
        """
        instance = self.get_object()

        if instance.status not in [AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]:
            return BadRequestResponse(f'无法取消状态为 {instance.get_status_display()} 的任务')

        instance.status = AnalysisStatus.CANCELLED
        instance.error_message = '用户取消'
        instance.save()

        return SuccessResponse({'message': '任务已取消'})

    @action(detail=False, methods=['post'])
    def batch_retry(self, request):
        """
        批量重试失败的分析

        POST /api/llm/analyses/batch_retry/
        Body: { "analysis_ids": [1, 2, 3] }  # 可选，为空则重试所有失败的任务
        """
        from django.db import transaction

        serializer = BatchAnalysisActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        analysis_ids = serializer.validated_data.get('analysis_ids', [])

        # 如果没有指定 ID，则重试所有失败且未达到最大重试次数的任务
        if not analysis_ids:
            queryset = self.get_queryset().filter(
                status=AnalysisStatus.FAILED,
                retry_count__lt=F('max_retries')
            )
        else:
            queryset = self.get_queryset().filter(
                id__in=analysis_ids,
                status__in=[AnalysisStatus.FAILED, AnalysisStatus.CANCELLED]
            )

        # 筛选可重试的记录
        retryable_queryset = queryset.filter(
            status__in=[AnalysisStatus.FAILED, AnalysisStatus.CANCELLED],
            retry_count__lt=F('max_retries')
        )

        # 获取 ID 列表
        retryable_ids = list(retryable_queryset.values_list('id', flat=True))

        if not retryable_ids:
            return CreatedResponse({
                'retried': 0,
                'skipped': queryset.count(),
                'message': '没有可重试的任务'
            })

        # 批量更新
        now = timezone.now()
        updated_count = ImageAnalysis.objects.filter(id__in=retryable_ids).update(
            status=AnalysisStatus.PENDING,
            retry_count=F('retry_count') + 1,
            last_retry_at=now,
            error_message='',
            error_details={}
        )

        # 批量创建重试任务
        for analysis_id in retryable_ids:
            async_task(retry_analysis_task, analysis_id, save=True)

        return CreatedResponse({
            'retried': updated_count,
            'skipped': len(analysis_ids) - updated_count if analysis_ids else 0,
            'message': f'已重试 {updated_count} 个任务'
        })

    @action(detail=False, methods=['post'])
    def batch_cancel(self, request):
        """
        批量取消分析

        POST /api/llm/analyses/batch_cancel/
        Body: { "analysis_ids": [1, 2, 3] }
        """
        serializer = BatchAnalysisActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        analysis_ids = serializer.validated_data['analysis_ids']

        cancelled_count = self.get_queryset().filter(
            id__in=analysis_ids,
            status__in=[AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]
        ).update(
            status=AnalysisStatus.CANCELLED,
            error_message='用户批量取消'
        )

        return SuccessResponse({
            'cancelled': cancelled_count,
            'message': f'已取消 {cancelled_count} 个任务'
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        获取分析统计

        GET /api/llm/analyses/stats/
        """
        stats = AnalysisService.get_stats(request.user.id)
        return SuccessResponse(stats)

    @action(detail=False, methods=['get'])
    def by_media(self, request):
        """
        根据媒体 ID 获取分析记录

        GET /api/llm/analyses/by_media/?media_id=1
        """
        media_id = request.query_params.get('media_id')
        if not media_id:
            return BadRequestResponse('缺少 media_id 参数')

        analyses = self.get_queryset().filter(media_id=media_id)
        serializer = self.get_serializer(analyses, many=True)
        return SuccessResponse(serializer.data)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """
        同步模型列表

        POST /api/llm/analyses/sync/
        Body: { "endpoint_id": 1 }
        """
        serializer = SyncModelsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        endpoint_id = serializer.validated_data['endpoint_id']

        # 验证权限
        try:
            Endpoint.objects.get(id=endpoint_id, owner=request.user)
        except Endpoint.DoesNotExist:
            return NotFoundResponse('端点不存在或无权访问')

        # 创建异步任务
        task_id = async_task(
            sync_models_task,
            endpoint_id,
            request.user.id,
            save=True
        )

        return CreatedResponse({
            'task_id': task_id,
            'message': '模型同步任务已创建'
        })

    @action(detail=True, methods=['patch'])
    def update_description(self, request, pk=None):
        """
        更新分析描述

        PATCH /api/llm/analyses/{id}/update_description/
        Body: { "description": "新的描述文本" }
        """
        instance = self.get_object()

        serializer = ImageAnalysisUpdateSerializer(
            instance,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return SuccessResponse({
            'id': instance.id,
            'description': instance.description,
            'message': '描述已更新'
        })
