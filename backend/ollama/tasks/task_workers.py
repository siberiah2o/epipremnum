"""
Ollama图片分析异步任务工作者 - 简化版
专注于批量分析的高效执行
"""

import logging
from django_async_manager import get_background_task

logger = logging.getLogger(__name__)
background_task = get_background_task()


@background_task(max_retries=2, retry_delay=30)
def analyze_batch_task(user_id, analysis_ids, model_name, max_concurrent=5):
    """
    批量分析图片任务 - 简化版
    直接使用并发管理器处理
    """
    logger.info(f"开始批量分析: {len(analysis_ids)} 个任务，并发数: {max_concurrent}")

    try:
        from ..models import OllamaImageAnalysis
        from .concurrency_manager import concurrency_manager
        from .state_manager import state_manager

        # 获取分析任务
        analyses = OllamaImageAnalysis.objects.filter(
            id__in=analysis_ids
        ).select_related('media', 'model')

        # 批量更新状态为处理中
        state_manager.batch_update_status(
            analysis_ids=analysis_ids,
            from_status='pending',
            to_status='processing'
        )

        # 准备媒体ID列表
        media_ids = [analysis.media.id for analysis in analyses]

        # 使用并发管理器处理
        batch_result = concurrency_manager.process_batch_images(
            user_id=user_id,
            media_ids=media_ids,
            model_name=model_name,
            analysis_options={'max_concurrent': max_concurrent}
        )

        logger.info(f"批量分析完成: 成功 {batch_result['success_count']}, 失败 {batch_result['error_count']}")

        return {
            'success': True,
            'completed_count': batch_result['success_count'],
            'failed_count': batch_result['error_count'],
            'total_count': len(analyses),
            'model_name': model_name,
            'max_concurrent': max_concurrent,
            'details': batch_result
        }

    except Exception as e:
        logger.error(f"批量分析任务失败: {str(e)}")

        # 批量标记失败
        try:
            from .state_manager import state_manager
            state_manager.batch_update_status(
                analysis_ids=analysis_ids,
                from_status=['pending', 'processing'],
                to_status='failed',
                error_message=f'批量任务失败: {str(e)}'
            )
        except Exception as update_error:
            logger.error(f"批量更新失败状态时出错: {str(update_error)}")

        raise


@background_task(max_retries=3, retry_delay=60)
def analyze_image_task(analysis_id):
    """
    单个图片分析任务
    """
    logger.info(f"🚀 开始图片分析: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from .ollama_client import OllamaImageAnalyzer

        # 获取分析任务
        analysis = OllamaImageAnalysis.objects.select_related('media', 'model').get(id=analysis_id)

        # 检查任务状态
        if analysis.status in ['failed', 'cancelled']:
            logger.info(f"⏭️ 跳过已{analysis.status}的任务: analysis_id={analysis_id}")
            return {'success': True, 'skipped': True, 'status': analysis.status}

        # 使用状态管理器更新状态
        from .state_manager import state_manager
        success = state_manager.update_analysis_status(
            analysis_id=analysis_id,
            from_status='pending',
            to_status='processing'
        )

        if not success:
            logger.error(f"无法更新分析状态为处理中: analysis_id={analysis_id}")
            return {'success': False, 'error': '状态更新失败'}

        # 执行分析（使用并行版本）
        analyzer = OllamaImageAnalyzer()
        try:
            result = analyzer.analyze_parallel(analysis)
        finally:
            # 确保关闭线程池
            analyzer.thread_pool.shutdown(wait=False)

        if result['success']:
            # 更新媒体信息
            state_manager.update_media_with_analysis_result(
                analysis, result['result']
            )

            # 更新任务状态
            state_manager.update_analysis_status(
                analysis_id=analysis_id,
                from_status='processing',
                to_status='completed',
                analysis_results=result['result'],
                processing_time=result.get('processing_time_ms')
            )

            logger.info(f"✅ 分析完成: analysis_id={analysis_id}")
            return {
                'success': True,
                'analysis_id': analysis_id,
                'media_id': analysis.media.id,
                'processing_time_s': round(result.get('processing_time_ms', 0) / 1000, 2)
            }
        else:
            # 标记失败
            state_manager.update_analysis_status(
                analysis_id=analysis_id,
                from_status='processing',
                to_status='failed',
                error_message=result['error']
            )

            logger.error(f"❌ 分析失败: analysis_id={analysis_id}, error={result['error']}")
            return {'success': False, 'error': result['error']}

    except OllamaImageAnalysis.DoesNotExist:
        logger.error(f"❌ 分析任务不存在: analysis_id={analysis_id}")
        return {'success': False, 'error': '分析任务不存在'}
    except Exception as e:
        logger.error(f"❌ 任务执行异常: analysis_id={analysis_id}, error={str(e)}")

        # 标记失败
        try:
            from .state_manager import state_manager
            state_manager.update_analysis_status(
                analysis_id=analysis_id,
                from_status=None,
                to_status='failed',
                error_message=f"任务执行异常: {str(e)}"
            )
        except Exception as update_error:
            logger.error(f"更新失败状态时出错: {str(update_error)}")

        return {'success': False, 'error': str(e)}


@background_task(max_retries=1, retry_delay=15)
def cancel_analysis_task(analysis_id):
    """
    取消分析任务
    """
    logger.info(f"🚫 取消分析任务: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task
        from django.utils import timezone

        analysis = OllamaImageAnalysis.objects.get(id=analysis_id)

        # 取消关联的异步任务
        async_task_cancelled = False
        if analysis.task_id:
            try:
                task = Task.objects.get(id=analysis.task_id)
                if task.status in ['pending', 'running', 'retry']:
                    task.status = 'cancelled'
                    task.save()
                    async_task_cancelled = True
                    logger.info(f"✅ 异步任务已取消: task_id={analysis.task_id}")
            except Task.DoesNotExist:
                logger.warning(f"⚠️ 异步任务不存在: task_id={analysis.task_id}")

        # 更新分析任务状态
        db_updated = False
        if analysis.status in ['pending', 'processing']:
            analysis.status = 'cancelled'
            analysis.completed_at = timezone.now()
            analysis.save()
            db_updated = True
            logger.info(f"✅ 数据库状态已更新: analysis_id={analysis_id}")

        return {
            'success': async_task_cancelled or db_updated,
            'analysis_id': analysis_id,
            'async_task_cancelled': async_task_cancelled,
            'database_updated': db_updated,
            'final_status': analysis.status
        }

    except OllamaImageAnalysis.DoesNotExist:
        logger.error(f"❌ 取消任务不存在: analysis_id={analysis_id}")
        return {'success': False, 'error': '分析任务不存在'}
    except Exception as e:
        logger.error(f"❌ 取消任务失败: {str(e)}")
        return {'success': False, 'error': f"取消失败: {str(e)}"}


@background_task(max_retries=1, retry_delay=15)
def cancel_all_user_tasks_task(user_id):
    """
    取消用户所有进行中和待处理的任务
    """
    logger.info(f"🚫 开始取消用户所有任务: user_id={user_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task
        from django.utils import timezone

        # 取消数据库中的分析任务
        cancelled_analyses = OllamaImageAnalysis.objects.filter(
            media__user_id=user_id,
            status__in=['pending', 'processing']
        ).update(
            status='cancelled',
            completed_at=timezone.now(),
            error_message='用户取消所有任务'
        )

        # 取消异步任务
        cancelled_async_tasks = Task.objects.filter(
            arguments__user_id=str(user_id),
            status__in=['pending', 'running', 'retry']
        ).update(
            status='cancelled',
            last_errors=['用户取消所有任务'],
            completed_at=timezone.now()
        )

        logger.info(f"取消所有任务完成: 分析任务 {cancelled_analyses} 个, 异步任务 {cancelled_async_tasks} 个")

        return {
            'success': True,
            'cancelled_analyses': cancelled_analyses,
            'cancelled_async_tasks': cancelled_async_tasks,
            'total_cancelled': cancelled_analyses + cancelled_async_tasks
        }

    except Exception as e:
        logger.error(f"取消所有任务失败: {str(e)}")
        return {'success': False, 'error': f"取消所有任务失败: {str(e)}"}