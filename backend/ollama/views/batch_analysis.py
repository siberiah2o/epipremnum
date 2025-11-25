"""
批量分析视图处理器
重新设计的简化版本，专注于批量分析功能
"""

import logging
from django.utils import timezone
logger = logging.getLogger(__name__)

from rest_framework.decorators import action
from .base import BaseResponseHandler, BaseViewSetMixin
from typing import Dict, Any
from ..serializers import (
    OllamaImageAnalysisCreateSerializer,
    OllamaImageAnalysisTaskStatusSerializer,
    OllamaImageAnalysisTaskListSerializer
)
from django.conf import settings


class BatchAnalysisHandler(BaseViewSetMixin):
    """批量分析处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def batch_analyze(self):
        """批量分析接口"""
        from ..models import Media, OllamaAIModel, OllamaImageAnalysis
        from ..tasks.async_tasks import analyze_batch_images_task

        # 获取请求参数
        media_ids = self.request.data.get('media_ids', [])
        model_name = self.request.data.get('model_name')
        options = self.request.data.get('options', {})

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
                endpoint__created_by=self.request.user,
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
            user=self.request.user
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

        # 使用原子状态管理器创建分析任务记录
        from ..tasks.atomic_state_manager import atomic_state_manager
        analysis_tasks = []
        for media in media_items:
            analysis, created = atomic_state_manager.create_analysis_safely(
                media=media,
                model=model,
                analysis_options=options
            )
            analysis_tasks.append(analysis)

        # 启动异步批量处理任务
        try:
            task = analyze_batch_images_task.run_async(
                user_id=self.request.user.id,
                analysis_ids=[analysis.id for analysis in analysis_tasks],
                model_name=model_name,
                max_concurrent=max_concurrent if use_concurrency else 1
            )

            logger.info(f"启动批量分析任务: task_id={task.id}, 媒体数量={len(media_items)}, 并发数={max_concurrent}")

        except Exception as e:
            logger.error(f"启动批量分析任务失败: {str(e)}")
            # 使用原子状态管理器取消已创建的分析任务
            try:
                from ..tasks.atomic_state_manager import atomic_state_manager
                analysis_ids = [a.id for a in analysis_tasks]
                atomic_state_manager.batch_update_status(
                    analysis_ids=analysis_ids,
                    from_status='pending',
                    to_status='failed',
                    error_message=f'批量任务启动失败: {str(e)}'
                )
            except Exception as update_error:
                logger.error(f"批量更新失败状态时出错: {str(update_error)}")
            
            return BaseResponseHandler.error_response(
                message=f'启动批量分析任务失败: {str(e)}'
            )

        # 构建响应数据
        submitted_tasks = []
        for analysis in analysis_tasks:
            submitted_tasks.append({
                'media_id': analysis.media.id,
                'media_title': analysis.media.title or f"图片_{analysis.media.id}",
                'analysis_id': analysis.id,
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

    def batch_cancel(self):
        """批量取消任务接口"""
        from ..models import OllamaImageAnalysis
        from ..tasks.async_tasks import cancel_batch_tasks_task

        analysis_ids = self.request.data.get('analysis_ids', [])
        task_ids = self.request.data.get('task_ids', [])

        # 验证输入参数
        if not analysis_ids and not task_ids:
            return BaseResponseHandler.error_response(
                message='必须提供 analysis_ids 或 task_ids 参数'
            )

        # 启动异步批量取消任务
        try:
            task = cancel_batch_tasks_task.run_async(
                user_id=self.request.user.id,
                analysis_ids=analysis_ids if analysis_ids else None,
                task_ids=task_ids if task_ids else None
            )

            logger.info(f"启动批量取消任务: task_id={task.id}")

            return BaseResponseHandler.success_response(
                message='批量取消任务已启动',
                data={
                    'task_id': str(task.id),
                    'cancel_method': 'task_ids' if task_ids else 'analysis_ids',
                    'target_count': len(task_ids) if task_ids else len(analysis_ids)
                }
            )

        except Exception as e:
            logger.error(f"启动批量取消任务失败: {str(e)}")
            return BaseResponseHandler.error_response(
                message=f'启动批量取消任务失败: {str(e)}'
            )

    def batch_query(self):
        """批量查询任务状态接口"""
        from ..models import OllamaImageAnalysis

        analysis_ids = self.request.data.get('analysis_ids', [])
        status_filter = self.request.data.get('status', None)

        # 验证输入参数
        if not analysis_ids:
            return BaseResponseHandler.error_response(
                message='必须提供 analysis_ids 参数'
            )

        # 查询分析任务
        queryset = OllamaImageAnalysis.objects.filter(
            id__in=analysis_ids,
            media__user=self.request.user
        ).select_related('media', 'model')

        # 应用状态过滤
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 序列化结果
        serializer = OllamaImageAnalysisTaskListSerializer(queryset, many=True)

        # 统计信息
        status_counts = {}
        for analysis in queryset:
            status = analysis.status
            status_counts[status] = status_counts.get(status, 0) + 1

        return BaseResponseHandler.success_response(
            message='批量查询任务状态成功',
            data={
                'tasks': serializer.data,
                'total_count': len(queryset),
                'status_counts': status_counts,
                'requested_ids': analysis_ids,
                'found_ids': [analysis.id for analysis in queryset]
            }
        )

    def cancel_all_tasks(self):
        """取消所有任务接口"""
        from ..models import OllamaImageAnalysis
        from ..tasks.async_tasks import cancel_all_user_tasks_task
        from ..tasks.atomic_state_manager import atomic_state_manager
        from ..tasks.concurrency_controller import concurrency_controller

        # 立即更新数据库中的任务状态
        try:
            # 获取用户所有待处理和处理中的任务
            pending_analyses = OllamaImageAnalysis.objects.filter(
                media__user=self.request.user,
                status__in=['pending', 'processing']
            ).values_list('id', flat=True)
            
            analysis_ids = list(pending_analyses)
            
            if analysis_ids:
                # 使用原子状态管理器立即更新状态为已取消
                update_result = atomic_state_manager.batch_update_status(
                    analysis_ids=analysis_ids,
                    from_status=['pending', 'processing'],
                    to_status='cancelled',
                    error_message='用户取消所有任务'
                )
                
                logger.info(f"立即更新数据库状态: 成功 {update_result['success_count']}/{len(analysis_ids)} 个任务")
                
                cancelled_count = update_result['success_count']
            else:
                logger.info("用户没有待取消的任务")
                cancelled_count = 0

        except Exception as e:
            logger.error(f"立即更新数据库状态失败: {str(e)}")
            # 即使立即更新失败，仍然继续启动异步任务
            cancelled_count = 0

        # 立即取消并发控制器中的正在执行的任务
        try:
            concurrent_cancel_result = concurrency_controller.cancel_user_tasks(self.request.user.id)
            concurrent_cancelled_count = concurrent_cancel_result['cancelled_count']
            logger.info(f"并发控制器取消任务: {concurrent_cancelled_count} 个")
            cancelled_count += concurrent_cancelled_count
        except Exception as e:
            logger.error(f"取消并发控制器任务失败: {str(e)}")

        # 启动异步取消所有任务（作为后备和清理异步队列中的任务）
        try:
            task = cancel_all_user_tasks_task.run_async(
                user_id=self.request.user.id
            )

            logger.info(f"启动取消所有任务: task_id={task.id}, 已立即取消 {cancelled_count} 个任务")

            return BaseResponseHandler.success_response(
                message=f'取消所有任务已启动，已立即取消 {cancelled_count} 个任务',
                data={
                    'task_id': str(task.id),
                    'user_id': self.request.user.id,
                    'immediately_cancelled_count': cancelled_count
                }
            )

        except Exception as e:
            logger.error(f"启动取消所有任务失败: {str(e)}")
            return BaseResponseHandler.error_response(
                message=f'启动取消所有任务失败: {str(e)}'
            )

    def get_batch_status(self):
        """获取批量任务状态概览"""
        from ..models import OllamaImageAnalysis
        
        # 获取用户的分析任务统计
        user_analysis_stats = {}
        for status in ['pending', 'processing', 'completed', 'failed', 'cancelled']:
            count = OllamaImageAnalysis.objects.filter(
                media__user=self.request.user,
                status=status
            ).count()
            user_analysis_stats[status] = count
        
        # 获取最近的分析任务
        recent_analyses = OllamaImageAnalysis.objects.filter(
            media__user=self.request.user
        ).order_by('-created_at')[:10]
        
        recent_serializer = OllamaImageAnalysisTaskListSerializer(recent_analyses, many=True)
        
        return BaseResponseHandler.success_response(
            message=f'获取批量任务状态概览成功，正在运行 {user_analysis_stats["processing"]} 个任务',
            data={
                'analysis_stats': user_analysis_stats,
                'total_analysis_tasks': sum(user_analysis_stats.values()),
                'recent_tasks': recent_serializer.data
            }
        )