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
    OllamaImageAnalysisCreateSerializer
)
from django.conf import settings


class BatchAnalysisHandler(BaseViewSetMixin):
    """批量分析处理器"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def batch_analyze(self):
        """批量分析接口"""
        from ..tasks.task_service import task_service

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

        # 直接使用 task_service 进行批量分析
        result = task_service.batch_analyze(
            user=self.request.user,
            media_ids=media_ids,
            model_name=model_name,
            analysis_options=options
        )

        if result['success']:
            return BaseResponseHandler.success_response(
                message='批量分析任务已启动',
                data=result
            )
        else:
            return BaseResponseHandler.error_response(
                message=result['error']
            )

    def batch_cancel(self):
        """批量取消任务接口"""
        from ..models import OllamaImageAnalysis
        from ..tasks.task_workers import cancel_batch_tasks_task

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
        from ..tasks.task_workers import cancel_all_user_tasks_task
        from ..tasks.state_manager import state_manager
        from ..tasks.concurrency_manager import concurrency_manager

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
                update_result = state_manager.batch_update_status(
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
            concurrent_cancel_result = concurrency_manager.cancel_user_tasks(self.request.user.id)
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
                    'user_id': self.request.user.id
                }
            )

        except Exception as e:
            logger.error(f"启动取消所有任务失败: {str(e)}")
            return BaseResponseHandler.error_response(
                message=f'启动取消所有任务失败: {str(e)}'
            )

    def get_batch_status(self):
        """获取批量任务状态概览"""
        from ..tasks.task_service import task_service

        # 获取批量状态摘要
        status_result = task_service.get_batch_status(self.request.user)

        # 获取最近的分析任务列表
        recent_tasks_result = task_service.list_tasks(
            user=self.request.user,
            limit=10,
            offset=0
        )

        if status_result['success'] and recent_tasks_result['success']:
            # 从批量状态中提取统计信息
            batch_status = status_result['status']
            user_task_stats = batch_status.get('user_task_stats', {})

            # 计算正在运行的任务数（从用户任务统计中）
            processing_count = user_task_stats.get('processing', 0)

            # 计算总任务数（只计算用户任务统计中的数值）
            total_tasks = 0
            for key, value in user_task_stats.items():
                if isinstance(value, (int, float)):
                    total_tasks += value

            return BaseResponseHandler.success_response(
                message=f'获取批量任务状态概览成功，正在运行 {processing_count} 个任务',
                data={
                    'analysis_stats': user_task_stats,
                    'total_analysis_tasks': total_tasks,
                    'recent_tasks': recent_tasks_result['tasks']
                }
            )
        else:
            # 如果其中任何一个失败，返回错误
            error_msg = status_result.get('error') or recent_tasks_result.get('error')
            return BaseResponseHandler.error_response(
                message=f'获取批量状态失败: {error_msg}'
            )