"""
改进的并发分析管理器 - 简化版
只负责图片级并发，图片内并行由analyzer处理
"""

import asyncio
import logging
import time
import threading
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
from django.conf import settings

logger = logging.getLogger(__name__)


class SimplifiedConcurrencyManager:
    """简化版并发管理器 - 只控制图片级并发"""

    def __init__(self):
        # 全局线程池，替代复杂的用户级线程池
        self.executor = ThreadPoolExecutor(
            max_workers=getattr(settings, 'OLLAMA_GLOBAL_MAX_CONCURRENT', 10),
            thread_name_prefix="ollama_worker"
        )

        # 活跃任务跟踪
        self.active_tasks = {}
        self._lock = threading.RLock()

        logger.info("🔧 简化版并发管理器初始化完成")

    def process_batch_images(self, user_id, media_ids, model_name, analysis_options, executor_callback=None):
        """
        批量处理图片 - 简化版
        使用全局线程池，每张图片独立处理
        """
        from ..models import OllamaImageAnalysis

        logger.info(f"🚀 开始批量处理: {len(media_ids)} 个图片，用户 {user_id}")

        # 获取所有分析对象
        analyses = OllamaImageAnalysis.objects.filter(
            media_id__in=media_ids,
            media__user_id=user_id,
            status__in=['pending', 'processing']
        ).select_related('media', 'model')

        results = {}
        failed_items = []
        futures = []

        # 提交所有任务到线程池
        for analysis in analyses:
            try:
                future = self.executor.submit(
                    self._process_single_image_simplified,
                    analysis
                )
                futures.append((future, analysis.media.id))

                with self._lock:
                    self.active_tasks[future] = {
                        'user_id': user_id,
                        'media_id': analysis.media.id
                    }

            except Exception as e:
                failed_items.append({
                    'media_id': analysis.media.id,
                    'error': f"提交任务失败: {str(e)}"
                })

        # 等待所有任务完成
        for future, media_id in futures:
            try:
                result = future.result(timeout=getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300))

                if result['success']:
                    results[media_id] = {
                        'success': True,
                        'status': 'completed'
                    }
                else:
                    failed_items.append({
                        'media_id': media_id,
                        'error': result.get('error', '未知错误')
                    })

            except Exception as e:
                failed_items.append({
                    'media_id': media_id,
                    'error': f"任务执行异常: {str(e)}"
                })

            finally:
                with self._lock:
                    self.active_tasks.pop(future, None)

        logger.info(f"📊 批量处理完成: 成功 {len(results)} 个，失败 {len(failed_items)} 个")

        return {
            'success_count': len(results),
            'error_count': len(failed_items),
            'results': results,
            'failed_items': failed_items
        }

    def _process_single_image_simplified(self, analysis):
        """
        处理单张图片 - 简化版
        使用增强版分析器的并行处理
        """
        from .state_manager import state_manager
        from .ollama_client import OllamaImageAnalyzer

        try:
            # 更新状态为处理中
            state_manager.update_analysis_status(
                analysis_id=analysis.id,
                from_status='pending',
                to_status='processing'
            )

            # 使用增强版分析器（并行处理）
            analyzer = OllamaImageAnalyzer()
            result = analyzer.analyze_parallel(analysis)

            if result['success']:
                # 更新媒体信息
                state_manager.update_media_with_analysis_result(
                    analysis, result['result']
                )

                # 更新任务状态
                state_manager.update_analysis_status(
                    analysis_id=analysis.id,
                    from_status='processing',
                    to_status='completed',
                    analysis_results=result['result'],
                    processing_time=result.get('processing_time_ms')
                )

                return {
                    'success': True,
                    'media_id': analysis.media.id,
                    'result': result['result']
                }
            else:
                # 标记失败
                state_manager.update_analysis_status(
                    analysis_id=analysis.id,
                    from_status='processing',
                    to_status='failed',
                    error_message=result.get('error', '分析失败')
                )

                return {
                    'success': False,
                    'media_id': analysis.media.id,
                    'error': result.get('error', '分析失败')
                }

        except Exception as e:
            logger.error(f"❌ 处理图片失败: media_id={analysis.media.id}, error={str(e)}")

            # 确保任务被标记为失败
            try:
                state_manager.update_analysis_status(
                    analysis_id=analysis.id,
                    from_status=None,
                    to_status='failed',
                    error_message=str(e)
                )
            except:
                pass

            return {
                'success': False,
                'media_id': analysis.media.id,
                'error': str(e)
            }

    def cancel_user_tasks(self, user_id: int) -> Dict[str, Any]:
        """取消用户的所有任务"""
        cancelled_count = 0

        with self._lock:
            # 找到该用户的所有活动任务
            user_futures = [
                future for future, info in self.active_tasks.items()
                if info['user_id'] == user_id
            ]

            # 尝试取消未开始的任务
            for future in user_futures:
                if not future.running():
                    if future.cancel():
                        cancelled_count += 1

        # 简化版取消逻辑 - 只需要标记数据库中的任务状态
        pass

        logger.info(f"🚫 用户 {user_id} 任务取消完成: {cancelled_count} 个")

        return {
            'cancelled_count': cancelled_count
        }

    def get_active_tasks_info(self) -> Dict[str, Any]:
        """获取当前活跃任务信息"""
        with self._lock:
            user_task_counts = {}
            for info in self.active_tasks.values():
                user_id = info['user_id']
                user_task_counts[user_id] = user_task_counts.get(user_id, 0) + 1

            return {
                'total_active_tasks': len(self.active_tasks),
                'user_task_counts': user_task_counts,
                'max_workers': self.executor._max_workers
            }

    def shutdown(self):
        """关闭管理器"""
        logger.info("🛑 关闭简化版并发管理器...")
        self.executor.shutdown(wait=False)
        logger.info("✅ 简化版并发管理器已关闭")


# 替换全局实例
concurrency_manager = SimplifiedConcurrencyManager()