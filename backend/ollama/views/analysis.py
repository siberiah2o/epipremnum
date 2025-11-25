"""
图片分析视图处理器
提供图片分析任务的创建、查询、管理等功能
"""

import logging
from django.utils import timezone
logger = logging.getLogger(__name__)

from rest_framework.decorators import action
from .base import BaseResponseHandler, BaseViewSetMixin
from typing import Dict, Any
from ..serializers import (
    OllamaImageAnalysisCreateSerializer,
    OllamaImageAnalysisTaskCreateSerializer,
    OllamaImageAnalysisTaskStatusSerializer,
    OllamaImageAnalysisTaskListSerializer,
    OllamaImageAnalysisTaskRetrySerializer,
    OllamaImageAnalysisTaskCancelSerializer
)
from ..tasks.manager import OllamaTaskManager
from django.utils import timezone


class AnalysisTaskHandler(BaseViewSetMixin):
    """图片分析任务处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request
        self.task_manager = OllamaTaskManager()

    def create_task(self):
        """创建图片分析任务"""
        serializer = OllamaImageAnalysisCreateSerializer(data=self.request.data)
        serializer.is_valid(raise_exception=True)

        # 验证模型名称（如果有指定）
        model_name = serializer.validated_data.get('model_name')
        if model_name:
            model_validation = self._validate_model_for_user(model_name)
            if not model_validation['valid']:
                return BaseResponseHandler.error_response(
                    message=model_validation['error']
                )

        # 使用原子状态管理器创建分析任务
        from ..models import Media, OllamaAIModel
        from ..tasks.atomic_state_manager import atomic_state_manager
        from ..tasks.async_tasks import analyze_image_with_ollama_task

        try:
            # 验证媒体文件
            media = Media.objects.get(
                id=serializer.validated_data['media_id'],
                user=self.request.user
            )

            # 验证模型
            model = None
            if model_name:
                model = OllamaAIModel.objects.get(
                    name=model_name,
                    endpoint__created_by=self.request.user,
                    is_active=True,
                    is_vision_capable=True
                )
            else:
                # 使用默认模型
                model = OllamaAIModel.objects.filter(
                    endpoint__created_by=self.request.user,
                    is_active=True,
                    is_vision_capable=True,
                    is_default=True
                ).first()

            if not model:
                return BaseResponseHandler.error_response(
                    message='没有可用的视觉分析模型'
                )

            # 使用原子状态管理器创建分析任务
            analysis, created = atomic_state_manager.create_analysis_safely(
                media=media,
                model=model,
                analysis_options=serializer.validated_data.get('options', {})
            )

            # 启动异步分析任务
            task = analyze_image_with_ollama_task.run_async(
                analysis_id=analysis.id
            )

            # 构建响应数据
            response_data = {
                'analysis_id': analysis.id,
                'task_id': str(task.id),
                'media_id': media.id,
                'media_title': media.title or f"图片_{media.id}",
                'model_name': model.name,
                'status': analysis.status,
                'created_at': analysis.created_at
            }

            response_serializer = OllamaImageAnalysisTaskCreateSerializer(data=response_data)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.created_response(
                message='图片分析任务创建成功',
                data=response_serializer.data
            )

        except Media.DoesNotExist:
            return BaseResponseHandler.error_response(
                message='媒体文件不存在或无权访问'
            )
        except OllamaAIModel.DoesNotExist:
            return BaseResponseHandler.error_response(
                message=f'模型 "{model_name}" 不存在或不支持视觉分析'
            )
        except Exception as e:
            return BaseResponseHandler.error_response(
                message=f'创建分析任务失败: {str(e)}'
            )

    def get_task_status(self, analysis_id):
        """获取任务状态"""
        result = self.task_manager.get_task_status(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskStatusSerializer(result)

            return BaseResponseHandler.success_response(
                message='获取任务状态成功',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def list_tasks(self):
        """获取任务列表"""
        # 获取查询参数
        status_filter = self.request.query_params.get('status')
        limit = min(int(self.request.query_params.get('limit', 50)), 100)
        offset = max(int(self.request.query_params.get('offset', 0)), 0)

        result = self.task_manager.list_tasks(
            user=self.request.user,
            status_filter=status_filter,
            limit=limit,
            offset=offset
        )

        if result['success']:
            # 序列化任务列表
            task_list = result['tasks']
            serializer = OllamaImageAnalysisTaskListSerializer(task_list, many=True)

            return BaseResponseHandler.success_response(
                message='获取任务列表成功',
                data={
                    'tasks': serializer.data,
                    'total_count': result['total_count'],
                    'limit': limit,
                    'offset': offset
                }
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def retry_task(self, analysis_id):
        """重试失败的任务"""
        result = self.task_manager.retry_task(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskRetrySerializer(data=result)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.success_response(
                message='任务重试已启动',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def cancel_task(self, analysis_id):
        """取消正在进行的任务"""
        result = self.task_manager.cancel_task(analysis_id, self.request.user)

        if result['success']:
            # 序列化返回数据
            response_serializer = OllamaImageAnalysisTaskCancelSerializer(data=result)
            response_serializer.is_valid(raise_exception=True)

            return BaseResponseHandler.success_response(
                message='任务取消已启动',
                data=response_serializer.data
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def _validate_model_for_user(self, model_name):
        """验证用户是否有权限使用指定模型"""
        try:
            from ..models import OllamaAIModel

            # 查找用户拥有的模型
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.viewset.request.user,
                name=model_name,
                is_active=True,
                is_vision_capable=True
            ).first()

            if not model:
                return {
                    'valid': False,
                    'error': f'模型 "{model_name}" 不存在或不支持视觉分析'
                }

            return {'valid': True, 'model': model}

        except Exception as e:
            return {
                'valid': False,
                'error': f'验证模型失败: {str(e)}'
            }


class AnalysisBatchHandler(BaseViewSetMixin):
    """批量分析处理器 - 简化版本"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance

    def batch_create_tasks(self):
        """批量创建分析任务 - 简化实现"""
        from ..models import Media, OllamaAIModel, OllamaImageAnalysis
        from ..tasks.async_tasks import analyze_batch_images_task
        from django.conf import settings

        media_ids = self.viewset.request.data.get('media_ids', [])
        model_name = self.viewset.request.data.get('model_name')
        options = self.viewset.request.data.get('options', {})

        # 验证输入参数
        if not isinstance(media_ids, list) or not media_ids:
            return BaseResponseHandler.error_response(
                message='media_ids 必须是非空数组'
            )

        if len(media_ids) > 50:
            return BaseResponseHandler.error_response(
                message='单次批量操作最多支持50个文件'
            )

        # 验证模型
        try:
            model = OllamaAIModel.objects.get(
                name=model_name,
                endpoint__created_by=self.viewset.request.user,
                is_active=True,
                is_vision_capable=True
            )
        except OllamaAIModel.DoesNotExist:
            return BaseResponseHandler.error_response(
                message=f'模型 "{model_name}" 不存在或不支持视觉分析'
            )

        # 验证媒体文件
        media_items = Media.objects.filter(
            id__in=media_ids,
            user=self.viewset.request.user
        )

        if len(media_items) != len(media_ids):
            found_ids = [item.id for item in media_items]
            missing_ids = [mid for mid in media_ids if mid not in found_ids]
            return BaseResponseHandler.error_response(
                message=f'以下媒体文件不存在或无权访问: {missing_ids}'
            )

        # 处理并发控制参数
        max_concurrent = options.get('max_concurrent', getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3))
        use_concurrency = options.get('use_concurrency', True)

        if not isinstance(max_concurrent, int) or max_concurrent < 1 or max_concurrent > 20:
            return BaseResponseHandler.error_response(
                message='max_concurrent必须在1-20之间'
            )

        # 检查重复任务
        existing_analyses = OllamaImageAnalysis.objects.filter(
            media__in=media_items,
            model=model,
            status__in=['pending', 'processing']
        ).values_list('media_id', flat=True)

        if existing_analyses:
            return BaseResponseHandler.error_response(
                message=f'以下媒体已有正在进行的分析任务: {list(existing_analyses)}'
            )

        # 创建分析任务记录
        analysis_tasks = []
        for media in media_items:
            analysis = OllamaImageAnalysis.objects.create(
                media=media,
                model=model,
                status='pending',
                analysis_options=options,
                created_at=timezone.now()
            )
            analysis_tasks.append(analysis)

        # 启动异步批量处理任务
        try:
            task = analyze_batch_images_task.run_async(
                user_id=self.viewset.request.user.id,
                analysis_ids=[analysis.id for analysis in analysis_tasks],
                model_name=model_name,
                max_concurrent=max_concurrent if use_concurrency else 1
            )

            logger.info(f"启动批量分析任务: task_id={task.id}, 媒体数量={len(media_items)}, 并发数={max_concurrent}")

        except Exception as e:
            logger.error(f"启动批量分析任务失败: {str(e)}")
            # 取消已创建的分析任务
            OllamaImageAnalysis.objects.filter(id__in=[a.id for a in analysis_tasks]).update(
                status='failed',
                error_message=f'批量任务启动失败: {str(e)}'
            )
            return BaseResponseHandler.error_response(
                message=f'启动批量分析任务失败: {str(e)}'
            )

        # 构建响应数据
        submitted_tasks = []
        for analysis in analysis_tasks:
            submitted_tasks.append({
                'media_id': analysis.media.id,
                'media_title': analysis.media.title or f"图片_{analysis.media.id}",
                'analysis_id': analysis.id,  # 保留用于查询状态
                'status': 'pending',
                'message': '批量分析任务已启动'
            })

        return BaseResponseHandler.success_response(
            message=f'批量分析任务已启动: {len(media_items)} 个文件已提交',
            data={
                'batch_info': {
                    'task_id': str(task.id),  # 异步任务队列ID
                    'total_media': len(media_items),
                    'max_concurrent': max_concurrent,
                    'use_concurrency': use_concurrency,
                    'model_name': model_name
                },
                'submitted_tasks': submitted_tasks,
                'total_count': len(media_items)
            }
        )

    def _prepare_single_analysis(self, analysis, prompt_text: str) -> Dict[str, Any]:
        """为统一并发控制器准备单次分析的数据"""
        return self.analyzer._prepare_single_analysis(analysis, prompt_text)

    def batch_cancel_tasks(self):
        """批量取消任务 - 简化实现"""
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task

        analysis_ids = self.viewset.request.data.get('analysis_ids', [])
        task_ids = self.viewset.request.data.get('task_ids', [])

        # 验证输入参数
        if not analysis_ids and not task_ids:
            return BaseResponseHandler.error_response(
                message='必须提供 analysis_ids 或 task_ids 参数'
            )

        # 优先使用 task_ids 取消异步任务
        if task_ids:
            cancelled_tasks = []
            errors = []

            for task_id in task_ids:
                try:
                    task = Task.objects.filter(
                        id=task_id,
                        status__in=['pending', 'running', 'retry']
                    ).first()

                    if not task:
                        errors.append({
                            'task_id': task_id,
                            'error': '任务不存在或已完成'
                        })
                        continue

                    # 标记任务为已取消
                    task.status = 'cancelled'
                    task.last_errors = ['用户批量取消']
                    task.completed_at = timezone.now()
                    task.save()

                    cancelled_tasks.append({
                        'task_id': task_id,
                        'status': 'cancelled',
                        'task_name': task.name
                    })

                except Exception as e:
                    errors.append({
                        'task_id': task_id,
                        'error': str(e)
                    })

            return BaseResponseHandler.success_response(
                message=f'批量取消任务完成: 成功 {len(cancelled_tasks)} 个, 失败 {len(errors)} 个',
                data={
                    'cancel_method': 'task_ids',
                    'cancelled_tasks': cancelled_tasks,
                    'errors': errors,
                    'total_count': len(task_ids),
                    'success_count': len(cancelled_tasks),
                    'error_count': len(errors)
                }
            )

        # 使用 analysis_ids 取消分析任务
        if analysis_ids:
            # 获取用户的分析任务
            analyses = OllamaImageAnalysis.objects.filter(
                id__in=analysis_ids,
                media__user=self.viewset.request.user,
                status__in=['pending', 'processing']
            )

            cancelled_count = analyses.update(
                status='cancelled',
                completed_at=timezone.now(),
                error_message='用户批量取消'
            )

            # 检查哪些任务不存在或无法取消
            found_ids = set(analyses.values_list('id', flat=True))
            missing_ids = [aid for aid in analysis_ids if aid not in found_ids]

            return BaseResponseHandler.success_response(
                message=f'批量取消任务完成: 成功取消 {cancelled_count} 个任务',
                data={
                    'cancel_method': 'analysis_ids',
                    'cancelled_count': cancelled_count,
                    'not_found_or_completed': missing_ids,
                    'total_count': len(analysis_ids),
                    'success_count': cancelled_count,
                    'error_count': len(missing_ids)
                }
            )

    def cancel_all_tasks(self):
        """取消用户所有进行中和待处理的任务 - 简化实现"""
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task

        try:
            # 取消数据库中的分析任务
            cancelled_analyses = OllamaImageAnalysis.objects.filter(
                media__user=self.viewset.request.user,
                status__in=['pending', 'processing']
            ).update(
                status='cancelled',
                completed_at=timezone.now(),
                error_message='用户取消所有任务'
            )

            # 取消异步队列中的任务
            cancelled_async_tasks = Task.objects.filter(
                arguments__user_id=str(self.viewset.request.user.id),
                status__in=['pending', 'running', 'retry']
            ).update(
                status='cancelled',
                last_errors=['用户取消所有任务'],
                completed_at=timezone.now()
            )

            return BaseResponseHandler.success_response(
                message=f'取消所有任务完成: 分析任务 {cancelled_analyses} 个, 异步任务 {cancelled_async_tasks} 个',
                data={
                    'cancelled_analyses': cancelled_analyses,
                    'cancelled_async_tasks': cancelled_async_tasks,
                    'total_cancelled': cancelled_analyses + cancelled_async_tasks,
                    'cancellation_methods': ['数据库状态更新', '异步任务取消']
                }
            )

        except Exception as e:
            return BaseResponseHandler.error_response(
                message=f'取消所有任务失败: {str(e)}'
            )

    def _validate_model_for_user(self, model_name):
        """验证用户是否有权限使用指定模型"""
        try:
            from ..models import OllamaAIModel

            # 查找用户拥有的模型
            model = OllamaAIModel.objects.filter(
                endpoint__created_by=self.viewset.request.user,
                name=model_name,
                is_active=True,
                is_vision_capable=True
            ).first()

            if not model:
                return {
                    'valid': False,
                    'error': f'模型 "{model_name}" 不存在或不支持视觉分析'
                }

            return {'valid': True, 'model': model}

        except Exception as e:
            return {
                'valid': False,
                'error': f'验证模型失败: {str(e)}'
            }
    def _validate_concurrency_options(self, options):
        """验证并发控制选项"""
        errors = []

        # 验证并发数设置
        if 'max_concurrent' in options:
            max_concurrent = options['max_concurrent']
            if not isinstance(max_concurrent, int) or not 1 <= max_concurrent <= 20:
                errors.append('max_concurrent必须在1-20之间')

        # 验证并发模式开关
        if 'use_concurrency' in options:
            use_concurrency = options['use_concurrency']
            if not isinstance(use_concurrency, bool):
                errors.append('use_concurrency必须是布尔值')

        # 检查并发逻辑一致性
        use_concurrency = options.get('use_concurrency', False)
        max_concurrent = options.get('max_concurrent', None)

        # 如果启用了并发但没有指定最大并发数，给出警告
        if use_concurrency and max_concurrent is None:
            from django.conf import settings
            default_concurrent = getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3)
            options['max_concurrent'] = default_concurrent  # 自动设置默认值

        return errors
