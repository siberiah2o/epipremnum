"""
并发控制状态视图
"""
import logging
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from ..tasks.concurrency_controller import concurrency_controller

logger = logging.getLogger(__name__)


class ConcurrencyStatusView(APIView):
    """并发控制状态视图"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """获取当前并发状态"""
        try:
            active_info = concurrency_controller.get_active_tasks_info()

            # 添加配置信息
            config_info = {
                'default_concurrent': getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3),
                'global_max_concurrent': getattr(settings, 'OLLAMA_GLOBAL_MAX_CONCURRENT', 10),
                'analysis_timeout': getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300),
            }

            # 计算每个用户的并发限制
            user_limits = {}
            for user_id, semaphore_value in active_info['user_semaphores'].items():
                user_limits[user_id] = {
                    'current_limit': semaphore_value,
                    'available_slots': semaphore_value
                }

            response_data = {
                'active_threads': active_info['active_threads'],
                'active_tasks_count': active_info['active_threads'],
                'thread_details': active_info['thread_details'],
                'user_semaphores': user_limits,
                'config': config_info,
                'timestamp': logger.handlers[0].formatter.formatTime(logger.makeRecord(
                    '', 0, '', 0, '', (), None
                )) if logger.handlers else None
            }

            return Response({
                'code': 200,
                'message': '获取并发状态成功',
                'data': response_data
            })

        except Exception as e:
            logger.error(f"获取并发状态失败: {str(e)}")
            return Response({
                'code': 500,
                'message': f'获取并发状态失败: {str(e)}',
                'data': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)