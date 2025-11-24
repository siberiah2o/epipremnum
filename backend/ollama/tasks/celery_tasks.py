"""
Ollama图片分析异步任务
简化设计，专注于核心功能
"""
import logging
import time
import base64
import requests
import json
from django_async_manager import get_background_task
from django.utils import timezone

logger = logging.getLogger(__name__)
background_task = get_background_task()


@background_task(max_retries=3, retry_delay=60)
def analyze_image_with_ollama_task(analysis_id: int) -> dict:
    """图片分析任务"""
    logger.info(f"🚀 开始图片分析: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from .analyzer import OllamaImageAnalyzer

        # 获取分析任务
        analysis = OllamaImageAnalysis.objects.select_related('media', 'model').get(id=analysis_id)
        analysis.mark_as_started()

        # 执行分析
        analyzer = OllamaImageAnalyzer()
        result = analyzer.analyze(analysis)

        if result['success']:
            # 更新媒体模型字段
            analysis.update_media_with_analysis_result(result['result'])
            analysis.mark_as_completed(result['processing_time_ms'])

            logger.info(f"✅ 分析完成: analysis_id={analysis_id}")
            return {
                'success': True,
                'analysis_id': analysis_id,
                'media_id': analysis.media.id,
                'processing_time_ms': result['processing_time_ms']
            }
        else:
            analysis.mark_as_failed(result['error'])
            logger.error(f"❌ 分析失败: analysis_id={analysis_id}, error={result['error']}")
            return {'success': False, 'error': result['error']}

    except OllamaImageAnalysis.DoesNotExist:
        logger.error(f"❌ 分析任务不存在: analysis_id={analysis_id}")
        return {'success': False, 'error': '分析任务不存在'}
    except Exception as e:
        logger.error(f"❌ 任务执行异常: analysis_id={analysis_id}, error={str(e)}")
        # 更新任务状态为失败
        try:
            analysis = OllamaImageAnalysis.objects.get(id=analysis_id)
            analysis.mark_as_failed(f"任务执行异常: {str(e)}")
        except:
            pass
        raise e


@background_task(max_retries=2, retry_delay=30)
def retry_failed_analysis_task(analysis_id: int) -> dict:
    """重试失败的分析任务"""
    logger.info(f"🔄 重试分析任务: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis

        analysis = OllamaImageAnalysis.objects.get(id=analysis_id)

        if not analysis.can_retry():
            logger.warning(f"⚠️ 任务无法重试: analysis_id={analysis_id}")
            return {'success': False, 'error': '任务无法重试'}

        # 增加重试次数
        analysis.increment_retry()

        # 启动新任务
        task = analyze_image_with_ollama_task.run_async(analysis_id=analysis_id)
        analysis.task_id = task.id
        analysis.save(update_fields=['task_id'])

        logger.info(f"🔄 重试任务已启动: analysis_id={analysis_id}, task_id={task.id}")
        return {
            'success': True,
            'analysis_id': analysis_id,
            'task_id': task.id,
            'retry_count': analysis.retry_count
        }

    except OllamaImageAnalysis.DoesNotExist:
        logger.error(f"❌ 重试任务不存在: analysis_id={analysis_id}")
        return {'success': False, 'error': '分析任务不存在'}
    except Exception as e:
        logger.error(f"❌ 重试任务失败: {str(e)}")
        return {'success': False, 'error': f"重试失败: {str(e)}"}


@background_task(max_retries=1, retry_delay=15)
def cancel_analysis_task(analysis_id: int) -> dict:
    """取消分析任务"""
    logger.info(f"🚫 取消分析任务: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task

        analysis = OllamaImageAnalysis.objects.get(id=analysis_id)

        # 取消异步任务
        if analysis.task_id:
            try:
                task = Task.objects.get(id=analysis.task_id)
                if task.status == 'in_progress':
                    task.status = 'canceled'
                    task.save()
                    logger.info(f"✅ 异步任务已取消: task_id={analysis.task_id}")
            except Task.DoesNotExist:
                logger.warning(f"⚠️ 异步任务不存在: task_id={analysis.task_id}")

        # 更新分析任务状态
        analysis.status = 'cancelled'
        analysis.completed_at = timezone.now()
        analysis.save()

        logger.info(f"✅ 分析任务已取消: analysis_id={analysis_id}")
        return {'success': True, 'analysis_id': analysis_id}

    except OllamaImageAnalysis.DoesNotExist:
        logger.error(f"❌ 取消任务不存在: analysis_id={analysis_id}")
        return {'success': False, 'error': '分析任务不存在'}
    except Exception as e:
        logger.error(f"❌ 取消任务失败: {str(e)}")
        return {'success': False, 'error': f"取消失败: {str(e)}"}