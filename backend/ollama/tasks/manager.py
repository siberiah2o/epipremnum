"""
Ollama图片分析任务管理器
负责任务的创建、查询、重试等管理操作
"""

import logging
from typing import Dict, Optional
from django.contrib.auth import get_user_model
from django_async_manager.models import Task

from ..models import OllamaImageAnalysis, OllamaAIModel
from .celery_tasks import analyze_image_with_ollama_task, retry_failed_analysis_task, cancel_analysis_task

logger = logging.getLogger(__name__)
User = get_user_model()


class OllamaTaskManager:
    """Ollama图片分析任务管理器"""

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

            # 检查重复任务 - 只检查正在运行的任务（pending或processing）
            # 已完成的任务允许重新分析
            existing_analysis = OllamaImageAnalysis.objects.filter(
                media=media,
                model=model,
                analysis_options=analysis_options or {},
                status__in=['pending', 'processing']
            ).first()

            if existing_analysis:
                # 返回正在运行的任务信息
                return {
                    'success': False,
                    'error': f'该媒体文件已有相同的分析任务正在进行中（分析ID: {existing_analysis.id}，任务ID: {existing_analysis.task_id or "未分配"}）',
                    'data': {
                        'analysis_id': existing_analysis.id,
                        'task_id': existing_analysis.task_id or "未分配",
                        'media_id': media_id,
                        'model_name': existing_analysis.model.name if existing_analysis.model else None,
                        'status': existing_analysis.status,
                        'is_duplicate': True
                    }
                }

            # 创建分析记录
            analysis = OllamaImageAnalysis.objects.create(
                media=media,
                model=model,
                analysis_options=analysis_options or {},
                prompt=prompt
            )

            # 启动异步任务
            task = analyze_image_with_ollama_task.run_async(analysis_id=analysis.id)
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

            task_info = self._get_task_info(analysis.task_id)

            return {
                'success': True,
                'analysis_id': analysis.id,
                'media_id': analysis.media.id,
                'status': analysis.status,
                'progress': analysis.task_progress,
                'created_at': analysis.created_at.isoformat(),
                'started_at': analysis.started_at.isoformat() if analysis.started_at else None,
                'completed_at': analysis.completed_at.isoformat() if analysis.completed_at else None,
                'processing_time_ms': analysis.processing_time,
                'retry_count': analysis.retry_count,
                'model_name': analysis.model.name if analysis.model else None,
                'can_retry': analysis.can_retry(),
                'async_task_status': task_info.get('status') if task_info else None,
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

            task = retry_failed_analysis_task.run_async(analysis_id=analysis_id)
            logger.info(f"🔄 重试任务启动: analysis_id={analysis_id}, task_id={task.id}")

            return {
                'success': True,
                'analysis_id': analysis_id,
                'task_id': str(task.id),
                'retry_count': analysis.retry_count + 1
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
                    'processing_time_ms': task.processing_time,
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

    def _get_task_info(self, task_id: Optional[str]) -> Optional[Dict]:
        """获取异步任务信息"""
        if not task_id:
            return None

        try:
            task = Task.objects.get(id=task_id)
            return {
                'id': task.id,
                'status': task.status,
                'created_at': task.created_at,
                'started_at': task.started_at,
                'completed_at': task.completed_at,
                'error_message': task.last_errors[0] if task.last_errors else None
            }
        except Task.DoesNotExist:
            return None