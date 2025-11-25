"""
批量状态查询处理器
提供批量任务状态和并发状态查询功能
"""

import logging
from django.db.models import Q
from .base import BaseResponseHandler, BaseViewSetMixin
from ..tasks.concurrency_controller import concurrency_controller

logger = logging.getLogger(__name__)


class BatchStatusHandler(BaseViewSetMixin):
    """批量状态查询处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def batch_get_status(self):
        """批量获取任务状态 - 简化实现"""
        try:
            from ..models import OllamaImageAnalysis
            from django.db import models
            from django.utils import timezone
            from django_async_manager.models import Task

            # 获取用户分析任务状态统计
            status_counts = OllamaImageAnalysis.objects.filter(
                media__user=self.request.user
            ).values('status').annotate(count=models.Count('id'))

            # 构建状态摘要
            all_status_options = ['pending', 'processing', 'completed', 'failed', 'cancelled']
            status_summary = {status: 0 for status in all_status_options}

            for status_count in status_counts:
                status_summary[status_count['status']] = status_count['count']

            # 获取用户活跃的异步任务
            active_async_tasks = Task.objects.filter(
                arguments__user_id=str(self.request.user.id),
                status__in=['pending', 'running', 'retry']
            ).values('id', 'name', 'status', 'created_at', 'started_at')

            batch_task_info = []
            for task in active_async_tasks:
                batch_task_info.append({
                    'task_id': str(task['id']),
                    'task_name': task['name'],
                    'status': task['status'].lower(),
                    'created_at': task['created_at'],
                    'started_at': task['started_at']
                })

            # 获取最近的分析任务
            recent_tasks = []
            recent_analyses = OllamaImageAnalysis.objects.filter(
                media__user=self.request.user
            ).select_related('media', 'model').order_by('-created_at')[:20]

            for analysis in recent_analyses:
                recent_tasks.append({
                    'analysis_id': analysis.id,
                    'media_id': analysis.media.id,
                    'media_title': analysis.media.title or f"图片_{analysis.media.id}",
                    'status': analysis.status,
                    'model_name': analysis.model.name if analysis.model else None,
                    'created_at': analysis.created_at,
                    'started_at': analysis.started_at,
                    'completed_at': analysis.completed_at,
                    'processing_time_s': round(analysis.processing_time / 1000, 2) if analysis.processing_time else None,
                    'error_message': analysis.error_message
                })

            response_data = {
                'status_summary': status_summary,
                'total_tasks': sum(status_summary.values()),
                'recent_tasks': recent_tasks,
                'active_batch_tasks': batch_task_info,
                'timestamp': timezone.now(),
                'is_processing': len(batch_task_info) > 0
            }

            return BaseResponseHandler.success_response(
                data=response_data,
                message=f'批量状态查询成功: 共 {response_data["total_tasks"]} 个任务'
            )

        except Exception as e:
            logger.error(f"批量状态查询失败: {str(e)}")
            return BaseResponseHandler.error_response(
                message=f'批量状态查询失败: {str(e)}'
            )

    def batch_get_image_concurrency_status(self):
        """获取图片级并发状态详情 - 简化实现"""
        try:
            from ..models import OllamaImageAnalysis
            from django.utils import timezone
            from django.conf import settings

            # 获取用户活跃的分析任务
            active_analyses = OllamaImageAnalysis.objects.filter(
                media__user=self.request.user,
                status__in=['pending', 'processing']
            ).select_related('media', 'model').order_by('-created_at')

            # 构建活跃图片列表
            active_images = []
            pending_count = 0
            processing_count = 0

            for analysis in active_analyses:
                active_images.append({
                    'analysis_id': analysis.id,
                    'media_id': analysis.media.id,
                    'media_title': analysis.media.title or f"图片_{analysis.media.id}",
                    'status': analysis.status,
                    'model_name': analysis.model.name if analysis.model else None,
                    'created_at': analysis.created_at,
                    'started_at': analysis.started_at,
                    'processing_time_s': round(analysis.processing_time / 1000, 2) if analysis.processing_time else None
                })

                if analysis.status == 'pending':
                    pending_count += 1
                elif analysis.status == 'processing':
                    processing_count += 1

            # 获取配置信息
            config_info = {
                'default_concurrent': getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3),
                'global_max_concurrent': getattr(settings, 'OLLAMA_GLOBAL_MAX_CONCURRENT', 10),
                'analysis_timeout': getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300),
            }

            response_data = {
                'image_concurrency': {
                    'active_images_count': len(active_images),
                    'pending_count': pending_count,
                    'processing_count': processing_count,
                    'active_images': active_images,
                    'max_concurrent_images': config_info['default_concurrent'],
                },
                'config': config_info,
                'timestamp': timezone.now()
            }

            return BaseResponseHandler.success_response(
                data=response_data,
                message=f'图片并发状态查询成功: {len(active_images)} 个活跃任务'
            )

        except Exception as e:
            logger.error(f"图片并发状态查询失败: {str(e)}")
            return BaseResponseHandler.error_response(
                message=f'图片并发状态查询失败: {str(e)}'
            )