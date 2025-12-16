"""
Ollama图片分析任务服务
负责任务的创建、查询、重试等管理操作
"""

import logging
from typing import Dict, Optional
from django.contrib.auth import get_user_model
from django_async_manager.models import Task

from ollama.models import OllamaImageAnalysis, OllamaAIModel
from .task_workers import analyze_image_task, cancel_analysis_task
from .state_manager import state_manager

logger = logging.getLogger(__name__)
User = get_user_model()


class TaskService:
    """Ollama图片分析任务服务"""

    def create_task(self, user, media_id: int, model_name: Optional[str] = None,
                   analysis_options: Optional[Dict] = None, prompt: Optional[str] = None) -> Dict:
        """创建分析任务"""
        try:
            from media.models import Media

            # 验证媒体文件
            media = Media.objects.get(id=media_id)
            if media.user != user:
                return {'success': False, 'error': '没有权限访问此媒体文件'}

            # 获取模型
            model = self._get_model(user, model_name)
            if not model:
                return {'success': False, 'error': '没有可用的分析模型'}

            # 使用状态管理器创建分析记录
            analysis, created = state_manager.create_analysis_safely(
                media=media,
                model=model,
                analysis_options=analysis_options or {},
                prompt=prompt
            )

            # 如果返回了已存在的任务，返回其信息
            if not created:
                return {
                    'success': False,
                    'error': f'该媒体文件已有相同的分析任务正在进行中（分析ID: {analysis.id}，任务ID: {analysis.task_id or "未分配"}）',
                    'data': {
                        'analysis_id': analysis.id,
                        'task_id': analysis.task_id or "未分配",
                        'media_id': media_id,
                        'model_name': analysis.model.name if analysis.model else None,
                        'status': analysis.status,
                        'is_duplicate': True
                    }
                }

            # 启动异步任务
            task = analyze_image_task.run_async(analysis_id=analysis.id)
            analysis.task_id = task.id
            analysis.save(update_fields=['task_id'])

            logger.info(f"✅ 分析任务创建: analysis_id={analysis.id}, task_id={task.id}")

            return {
                'success': True,
                'analysis_id': analysis.id,
                'task_id': str(task.id),
                'media_id': media_id,
                'model_name': model.name,
                'status': 'pending'
            }

        except Media.DoesNotExist:
            return {'success': False, 'error': '媒体文件不存在'}
        except Exception as e:
            logger.error(f"❌ 创建任务失败: {str(e)}")
            return {'success': False, 'error': f'创建任务失败: {str(e)}'}

    def get_task_status(self, analysis_id: int, user) -> Dict:
        """获取任务状态"""
        try:
            analysis = OllamaImageAnalysis.objects.select_related('media', 'model').get(
                id=analysis_id, media__user=user
            )

            return {
                'success': True,
                'analysis_id': analysis.id,
                'media_id': analysis.media.id,
                'status': analysis.status,
                'progress': analysis.task_progress,
                'created_at': analysis.created_at.isoformat(),
                'started_at': analysis.started_at.isoformat() if analysis.started_at else None,
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'processing_time_s': round(analysis.processing_time / 1000, 2) if analysis.processing_time else None,
                'retry_count': analysis.retry_count,
                'model_name': analysis.model.name if analysis.model else None,
                'can_retry': analysis.can_retry(),
                'error_message': analysis.error_message
            }

        except OllamaImageAnalysis.DoesNotExist:
            return {'success': False, 'error': '分析任务不存在'}
        except Exception as e:
            logger.error(f"❌ 获取任务状态失败: {str(e)}")
            return {'success': False, 'error': f'获取状态失败: {str(e)}'}

    def retry_task(self, analysis_id: int, user) -> Dict:
        """重试任务"""
        try:
            analysis = OllamaImageAnalysis.objects.select_related('media').get(
                id=analysis_id, media__user=user
            )

            if not analysis.can_retry():
                return {
                    'success': False,
                    'error': f'任务无法重试: status={analysis.status}, retries={analysis.retry_count}'
                }

            # 增加重试次数
            analysis.increment_retry()
            
            # 重新启动分析任务
            task = analyze_image_task.run_async(analysis_id=analysis_id)
            analysis.task_id = task.id
            analysis.save(update_fields=['task_id'])
            
            logger.info(f"🔄 重试任务启动: analysis_id={analysis_id}, task_id={task.id}")

            return {
                'success': True,
                'analysis_id': analysis_id,
                'task_id': str(task.id),
                'retry_count': analysis.retry_count
            }

        except OllamaImageAnalysis.DoesNotExist:
            return {'success': False, 'error': '分析任务不存在'}
        except Exception as e:
            logger.error(f"❌ 重试任务失败: {str(e)}")
            return {'success': False, 'error': f'重试失败: {str(e)}'}

    def cancel_task(self, analysis_id: int, user) -> Dict:
        """取消任务"""
        try:
            analysis = OllamaImageAnalysis.objects.select_related('media').get(
                id=analysis_id, media__user=user
            )

            if analysis.status not in ['pending', 'processing']:
                return {'success': False, 'error': f'任务无法取消: status={analysis.status}'}

            task = cancel_analysis_task.run_async(analysis_id=analysis_id)
            logger.info(f"🚫 取消任务启动: analysis_id={analysis_id}, task_id={task.id}")

            return {
                'success': True,
                'analysis_id': analysis_id,
                'task_id': str(task.id)
            }

        except OllamaImageAnalysis.DoesNotExist:
            return {'success': False, 'error': '分析任务不存在'}
        except Exception as e:
            logger.error(f"❌ 取消任务失败: {str(e)}")
            return {'success': False, 'error': f'取消失败: {str(e)}'}

    def list_tasks(self, user, status_filter: Optional[str] = None,
                   limit: int = 50, offset: int = 0) -> Dict:
        """获取任务列表"""
        try:
            queryset = OllamaImageAnalysis.objects.filter(
                media__user=user
            ).select_related('media', 'model').order_by('-created_at')

            if status_filter:
                queryset = queryset.filter(status=status_filter)

            total_count = queryset.count()
            tasks = queryset[offset:offset + limit]

            task_list = []
            for task in tasks:
                task_list.append({
                    'analysis_id': task.id,
                    'media_id': task.media.id,
                    'media_title': task.media.title or task.media.file.name,
                    'status': task.status,
                    'progress': task.task_progress,
                    'model_name': task.model.name if task.model else None,
                    'created_at': task.created_at.isoformat(),
                    'processing_time_s': round(task.processing_time / 1000, 2) if task.processing_time else None,
                    'retry_count': task.retry_count,
                    'can_retry': task.can_retry(),
                    'error_message': task.error_message
                })

            return {
                'success': True,
                'tasks': task_list,
                'total_count': total_count,
                'limit': limit,
                'offset': offset
            }

        except Exception as e:
            logger.error(f"❌ 获取任务列表失败: {str(e)}")
            return {'success': False, 'error': f'获取列表失败: {str(e)}'}

    def _get_model(self, user, model_name: Optional[str]) -> Optional[OllamaAIModel]:
        """获取分析模型"""
        queryset = OllamaAIModel.objects.filter(
            endpoint__created_by=user,
            is_active=True,
            is_vision_capable=True
        )

        if model_name:
            queryset = queryset.filter(name=model_name)

        return queryset.filter(is_default=True).first() or queryset.first()

    
    def get_user_statistics(self, user) -> Dict:
        """获取用户任务统计"""
        try:
            # 使用状态管理器获取统计信息
            user_stats = state_manager.get_user_task_statistics(user.id)
            
            return {
                'success': True,
                'statistics': user_stats
            }
            
        except Exception as e:
            logger.error(f"❌ 获取用户统计失败: {str(e)}")
            return {'success': False, 'error': f'获取统计失败: {str(e)}'}

    def cleanup_old_tasks(self, user, days_old: int = 30) -> Dict:
        """清理用户的旧任务"""
        try:
            # 使用状态管理器清理旧分析记录
            cleanup_result = state_manager.cleanup_old_analyses(days_old)
            
            return {
                'success': True,
                'deleted_count': cleanup_result.get('deleted_count', 0),
                'message': f"已清理 {cleanup_result.get('deleted_count', 0)} 个旧任务"
            }
            
        except Exception as e:
            logger.error(f"❌ 清理旧任务失败: {str(e)}")
            return {'success': False, 'error': f'清理失败: {str(e)}'}

    def batch_analyze(self, user, media_ids: list, model_name: Optional[str] = None,
                     analysis_options: Optional[Dict] = None) -> Dict:
        """批量分析任务"""
        try:
            from .batch_handler import batch_handler
            
            # 使用批量处理器执行批量分析
            result = batch_handler.analyze_images_with_concurrency_task(
                user_id=user.id,
                media_ids=media_ids,
                model_name=model_name,
                analysis_options=analysis_options or {}
            )
            
            return result
            
        except Exception as e:
            logger.error(f"❌ 批量分析失败: {str(e)}")
            return {'success': False, 'error': f'批量分析失败: {str(e)}'}

    def cancel_all_user_tasks(self, user) -> Dict:
        """取消用户所有任务"""
        try:
            from .task_workers import cancel_all_user_tasks_task
            
            # 启动取消所有用户任务的异步任务
            task = cancel_all_user_tasks_task.run_async(user_id=user.id)
            
            logger.info(f"🚫 取消用户所有任务启动: user_id={user.id}, task_id={task.id}")
            
            return {
                'success': True,
                'task_id': str(task.id),
                'message': '已启动取消所有任务的异步操作'
            }
            
        except Exception as e:
            logger.error(f"❌ 取消所有任务失败: {str(e)}")
            return {'success': False, 'error': f'取消所有任务失败: {str(e)}'}

    def get_batch_status(self, user) -> Dict:
        """获取批量处理状态"""
        try:
            from .batch_handler import batch_handler
            
            # 使用批量处理器获取状态摘要
            status_summary = batch_handler.get_status_summary(user)
            
            return {
                'success': True,
                'status': status_summary
            }
            
        except Exception as e:
            logger.error(f"❌ 获取批量状态失败: {str(e)}")
            return {'success': False, 'error': f'获取批量状态失败: {str(e)}'}


# 全局任务服务实例
task_service = TaskService()