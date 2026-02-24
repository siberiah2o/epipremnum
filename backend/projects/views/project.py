"""
项目视图

提供项目和项目媒体的 CRUD 操作
"""

import logging
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    BadRequestResponse,
    NotFoundResponse,
)
from utils.pagination import StandardPagination
from utils.viewsets import BaseModelViewSet
from utils.exceptions import ResourceNotFound, ValidationError

from ..models import Project, ProjectMedia
from ..serializers import (
    ProjectSerializer,
    ProjectCreateSerializer,
    ProjectUpdateSerializer,
    ProjectMediaSerializer,
    AddMediaToProjectSerializer,
    ReorderMediaSerializer,
)
from ..services import ProjectService, ProjectMediaService, LoraExportService
from media.serializers import MediaSerializer

logger = logging.getLogger(__name__)


class ProjectViewSet(BaseModelViewSet):
    """
    项目视图集

    API 端点:
    - GET    /api/projects/                    # 列表
    - POST   /api/projects/                    # 创建
    - GET    /api/projects/{id}/               # 详情
    - PUT    /api/projects/{id}/               # 更新
    - DELETE /api/projects/{id}/               # 删除
    - GET    /api/projects/{id}/media/         # 获取项目媒体
    - POST   /api/projects/{id}/add_media/     # 添加媒体
    - POST   /api/projects/{id}/remove_media/  # 移除媒体
    - POST   /api/projects/{id}/reorder_media/ # 重新排序
    - GET    /api/projects/available_media/    # 获取可添加的媒体
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']
    ordering = ['-updated_at', '-created_at']

    def get_queryset(self):
        """只返回当前用户的项目"""
        return Project.objects.filter(owner=self.request.user).prefetch_related('project_media')

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return ProjectCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ProjectUpdateSerializer
        return ProjectSerializer

    def perform_create(self, serializer):
        """创建时自动设置所有者"""
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        """创建项目"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project = ProjectService.create_project(
            name=serializer.validated_data['name'],
            owner=request.user,
            description=serializer.validated_data.get('description', ''),
            cover_image_id=serializer.validated_data.get('cover_image'),
        )
        return CreatedResponse(ProjectSerializer(project).data)

    def update(self, request, *args, **kwargs):
        """更新项目"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        project = ProjectService.update_project(
            project=instance,
            name=serializer.validated_data.get('name'),
            description=serializer.validated_data.get('description'),
            cover_image_id=serializer.validated_data.get('cover_image'),
        )
        return SuccessResponse(ProjectSerializer(project).data)

    def destroy(self, request, *args, **kwargs):
        """删除项目"""
        instance = self.get_object()
        ProjectService.delete_project(instance)
        return NoContentResponse()

    @action(detail=True, methods=['get'])
    def media(self, request, pk=None):
        """获取项目中的所有媒体文件"""
        project = self.get_object()
        project_media = project.project_media.all()

        page = self.paginate_queryset(project_media)
        if page is not None:
            serializer = ProjectMediaSerializer(page, many=True)
            return self.paginator.get_paginated_response(serializer.data)

        serializer = ProjectMediaSerializer(project_media, many=True)
        return SuccessResponse(serializer.data)

    @action(detail=True, methods=['post'], url_path='media/add')
    def add_media(self, request, pk=None):
        """添加媒体文件到项目"""
        project = self.get_object()
        serializer = AddMediaToProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = ProjectMediaService.add_media_to_project(
                project=project,
                media_ids=serializer.validated_data['media_ids'],
                notes=serializer.validated_data.get('notes', '')
            )
            return SuccessResponse({
                'message': f'成功添加 {result["created"]} 个媒体文件',
                **result
            })
        except ValidationError as e:
            return BadRequestResponse(message=str(e))

    @action(detail=True, methods=['post'], url_path='media/remove')
    def remove_media(self, request, pk=None):
        """从项目移除媒体文件"""
        project = self.get_object()
        media_id = request.data.get('media_id')

        if not media_id:
            return BadRequestResponse('请提供 media_id')

        try:
            ProjectMediaService.remove_media_from_project(project, media_id)
            return SuccessResponse({'message': '移除成功'})
        except ResourceNotFound as e:
            return NotFoundResponse(message=str(e))

    @action(detail=True, methods=['post'], url_path='batch_remove_media')
    def batch_remove_media(self, request, pk=None):
        """批量从项目移除媒体文件"""
        project = self.get_object()
        media_ids = request.data.get('media_ids', [])

        if not media_ids:
            return BadRequestResponse('请提供 media_ids 列表')

        deleted_count = ProjectMediaService.batch_remove_media(project, media_ids)
        return SuccessResponse({
            'message': f'成功移除 {deleted_count} 个媒体文件',
            'deleted_count': deleted_count
        })

    @action(detail=True, methods=['post'], url_path='reorder_media')
    def reorder_media(self, request, pk=None):
        """重新排序项目中的媒体文件"""
        project = self.get_object()
        order_data = request.data.get('order', [])

        if not isinstance(order_data, list):
            return BadRequestResponse('order 必须是列表')

        ProjectMediaService.reorder_media(project, order_data)
        return SuccessResponse({'message': '排序成功'})

    @action(detail=True, methods=['post'], url_path='update_media_notes')
    def update_media_notes(self, request, pk=None):
        """更新项目媒体备注"""
        project = self.get_object()
        media_id = request.data.get('media_id')
        notes = request.data.get('notes', '')

        if not media_id:
            return BadRequestResponse('请提供 media_id')

        try:
            ProjectMediaService.update_media_notes(project, media_id, notes)
            return SuccessResponse({'message': '备注更新成功'})
        except ResourceNotFound as e:
            return NotFoundResponse(message=str(e))

    @action(detail=False, methods=['get'])
    def available_media(self, request):
        """获取可添加到项目的媒体文件"""
        from media.models import Media

        project_id = request.query_params.get('project_id')
        queryset = Media.objects.filter(owner=request.user)

        if project_id:
            queryset = queryset.exclude(project_media__project_id=project_id)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = MediaSerializer(page, many=True)
            return self.paginator.get_paginated_response(serializer.data)

        serializer = MediaSerializer(queryset, many=True)
        return SuccessResponse(serializer.data)

    @action(detail=True, methods=['get'])
    def export_stats(self, request, pk=None):
        """
        获取项目导出统计信息

        GET /api/projects/{id}/export_stats/
        """
        project = self.get_object()
        stats = LoraExportService.get_export_stats(project)
        return SuccessResponse(stats)

    @action(detail=True, methods=['post'])
    def export_lora_dataset(self, request, pk=None):
        """
        导出项目的 LoRA 训练数据集

        POST /api/projects/{id}/export_lora_dataset/?trigger_word=xxx

        参数:
        - trigger_word: 可选，触发词，会在描述前添加

        返回 ZIP 文件，包含：
        - 图片文件（保持原格式）
        - 对应的 .txt 描述文件
        """
        project = self.get_object()
        trigger_word = request.query_params.get('trigger_word', '').strip()

        try:
            response = LoraExportService.export_project_lora_dataset(
                project,
                trigger_word=trigger_word if trigger_word else None
            )
            return response
        except ValueError as e:
            return BadRequestResponse(str(e))
        except Exception as e:
            logger.error(f"导出LoRA数据集失败: {e}")
            return BadRequestResponse("导出失败，请稍后重试")
