"""
改进的批量处理器 - 简化版
移除复杂的并发控制，只负责任务准备和结果整理
"""

import logging
from typing import Dict, Any, List
from django.db import transaction
from .state_manager import state_manager

logger = logging.getLogger(__name__)


class SimplifiedBatchHandler:
    """简化版批量处理器"""

    def __init__(self):
        self.max_batch_size = 50  # 增加批量大小

    def prepare_tasks(self, user, media_ids, model_name=None, analysis_options=None, prompt=None):
        """准备批量任务 - 简化版"""
        from media.models import Media
        from ollama.models import OllamaAIModel

        valid_tasks = []
        validation_errors = []

        # 批量查询媒体文件
        media_items = Media.objects.filter(
            id__in=media_ids,
            user=user
        ).select_related('user')

        # 检查缺失的媒体
        found_ids = {m.id for m in media_items}
        for media_id in media_ids:
            if media_id not in found_ids:
                validation_errors.append({
                    'media_id': media_id,
                    'error': '媒体文件不存在或无权访问'
                })

        # 获取模型
        model = self._get_model(user, model_name)
        if not model:
            raise BatchValidationError("没有可用的分析模型")

        # 批量创建分析任务
        for media in media_items:
            try:
                analysis, created = state_manager.create_analysis_safely(
                    media=media,
                    model=model,
                    analysis_options=analysis_options or {},
                    prompt=prompt
                )

                valid_tasks.append(analysis)
                logger.debug(f"创建分析任务: media_id={media.id}, analysis_id={analysis.id}")

            except Exception as e:
                validation_errors.append({
                    'media_id': media.id,
                    'error': f"创建分析任务失败: {str(e)}"
                })

        summary = {
            'total_requested': len(media_ids),
            'valid_tasks': len(valid_tasks),
            'validation_errors': len(validation_errors)
        }

        return valid_tasks, validation_errors, summary

    def _get_model(self, user, model_name=None):
        """获取模型 - 简化版"""
        from ollama.models import OllamaAIModel

        queryset = OllamaAIModel.objects.filter(
            endpoint__created_by=user,
            is_active=True,
            is_vision_capable=True
        )

        if model_name:
            queryset = queryset.filter(name=model_name)

        return queryset.filter(is_default=True).first() or queryset.first()

    def analyze_images_with_concurrency_task(self, user_id, media_ids, model_name, analysis_options=None, prompt=None):
        """
        图片并发批量分析任务 - 简化版
        直接使用并发管理器
        """
        logger.info(f"🚀 开始批量分析: {len(media_ids)} 张图片，用户: {user_id}")

        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()

            # 获取用户
            user = User.objects.get(id=user_id)

            # 验证请求
            validation_result = self.validate_request(media_ids, model_name, analysis_options)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': f"批量请求验证失败: {'; '.join(validation_result['errors'])}"
                }

            # 准备任务
            valid_tasks, validation_errors, summary = self.prepare_tasks(
                user=user,
                media_ids=media_ids,
                model_name=model_name,
                analysis_options=analysis_options,
                prompt=prompt
            )

            if not valid_tasks:
                return {
                    'success': False,
                    'error': '没有可处理的任务',
                    'validation_errors': validation_errors
                }

            # 创建批量分析异步任务
            from .task_workers import analyze_batch_task

            analysis_ids = [task.id for task in valid_tasks]
            max_concurrent = analysis_options.get('max_concurrent', 10) if analysis_options else 10

            batch_task = analyze_batch_task.run_async(
                user_id=user_id,
                analysis_ids=analysis_ids,
                model_name=model_name,
                max_concurrent=max_concurrent
            )

            logger.info(f"✅ 批量分析任务已启动: task_id={batch_task.id}")

            return {
                'success': True,
                'batch_started': True,
                'batch_task_id': str(batch_task.id),
                'summary': summary,
                'analysis_ids': analysis_ids,
                'max_concurrent': max_concurrent
            }

        except Exception as e:
            logger.error(f"❌ 批量分析任务异常: {str(e)}")
            return {
                'success': False,
                'error': f"批量分析任务异常: {str(e)}"
            }

    def validate_request(self, media_ids, model_name=None, analysis_options=None):
        """验证批量请求参数"""
        errors = []
        warnings = []

        # 验证媒体ID列表
        if not media_ids or not isinstance(media_ids, list):
            errors.append("media_ids 必须是非空数组")
            return {'valid': False, 'errors': errors, 'warnings': warnings}

        if len(media_ids) > self.max_batch_size:
            errors.append(f"批量大小超过限制，最多支持 {self.max_batch_size} 个文件")

        if len(media_ids) == 0:
            errors.append("媒体ID列表不能为空")

        # 检查重复ID
        if len(media_ids) != len(set(media_ids)):
            warnings.append("媒体ID列表中包含重复项")

        # 验证并发控制参数
        analysis_options = analysis_options or {}
        if 'max_concurrent' in analysis_options:
            max_concurrent = analysis_options['max_concurrent']
            if not isinstance(max_concurrent, int) or not 1 <= max_concurrent <= 10:
                errors.append('max_concurrent必须在1-10之间')

        # 验证模型名称
        if model_name and not isinstance(model_name, str):
            errors.append("模型名称必须是字符串")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'media_count': len(media_ids)
        }

    def execute_processing(self, user, valid_tasks, analysis_options):
        """简化的批量执行处理"""
        from .concurrency_manager import concurrency_manager

        media_ids = [task.media.id for task in valid_tasks]

        return concurrency_manager.process_batch_images(
            user_id=user.id,
            media_ids=media_ids,
            model_name=valid_tasks[0].model.name,
            analysis_options=analysis_options
        )


class BatchError(Exception):
    """批量处理错误基类"""
    pass


class BatchValidationError(BatchError):
    """批量处理验证错误"""
    pass


# 更新全局实例
batch_handler = SimplifiedBatchHandler()