"""
Ollama图片分析异步任务工作者
重新设计的简化版本，专注于批量分析功能
"""
import logging
import time
import base64
import requests
import json
from django_async_manager import get_background_task
from django.utils import timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)
background_task = get_background_task()


@background_task(max_retries=3, retry_delay=60)
def analyze_image_task(analysis_id: int) -> dict:
    """单个图片分析任务"""
    logger.info(f"🚀 开始图片分析: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from .ollama_client import OllamaImageAnalyzer

        # 获取分析任务
        analysis = OllamaImageAnalysis.objects.select_related('media', 'model').get(id=analysis_id)

        # 检查任务状态，如果是失败或取消状态，直接跳过
        if analysis.status in ['failed', 'cancelled']:
            logger.info(f"⏭️ 跳过已{analysis.status}的任务: analysis_id={analysis_id}")
            return {'success': True, 'skipped': True, 'status': analysis.status, 'message': f'任务已{analysis.status}，跳过处理'}

        # 使用状态管理器更新状态为处理中
        from .state_manager import state_manager
        success = state_manager.update_analysis_status(
            analysis_id=analysis_id,
            from_status='pending',
            to_status='processing'
        )

        if not success:
            logger.error(f"无法更新分析状态为处理中: analysis_id={analysis_id}")
            return {'success': False, 'error': '状态更新失败，可能任务已被其他进程处理'}

        # 执行分析
        analyzer = OllamaImageAnalyzer()
        result = analyzer.analyze(analysis)

        if result['success']:
            # 使用状态管理器更新媒体模型字段和任务状态
            media_update_success = state_manager.update_media_with_analysis_result(
                analysis, result['result']
            )
            
            task_update_success = state_manager.update_analysis_status(
                analysis_id=analysis_id,
                from_status='processing',
                to_status='completed',
                analysis_results=result['result'],
                processing_time=result.get('processing_time_ms')
            )
            
            if not media_update_success:
                logger.warning(f"媒体信息更新失败: analysis_id={analysis_id}")
            
            if not task_update_success:
                logger.error(f"任务状态更新失败: analysis_id={analysis_id}")
                return {'success': False, 'error': '任务状态更新失败'}

            logger.info(f"✅ 分析完成: analysis_id={analysis_id}")
            return {
                'success': True,
                'analysis_id': analysis_id,
                'media_id': analysis.media.id,
                'processing_time_s': round(result.get('processing_time_ms', 0) / 1000, 2) if result.get('processing_time_ms') else None
            }
        else:
            # 使用状态管理器更新任务状态为失败
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
        
        # 使用状态管理器更新任务状态为失败
        try:
            from .state_manager import state_manager
            state_manager.update_analysis_status(
                analysis_id=analysis_id,
                from_status=None,  # 允许从任何状态转换为失败
                to_status='failed',
                error_message=f"任务执行异常: {str(e)}"
            )
        except Exception as update_error:
            logger.error(f"更新失败状态时出错: {str(update_error)}")

        return {'success': False, 'error': str(e)}


@background_task(max_retries=1, retry_delay=15)
def cancel_analysis_task(analysis_id: int) -> dict:
    """取消分析任务"""
    logger.info(f"🚫 取消分析任务: analysis_id={analysis_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task

        analysis = OllamaImageAnalysis.objects.get(id=analysis_id)

        # 取消底层异步任务
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

        # 更新数据库状态
        if analysis.status in ['pending', 'processing']:
            analysis.status = 'cancelled'
            analysis.completed_at = timezone.now()
            analysis.save()
            db_updated = True
            logger.info(f"✅ 数据库状态已更新: analysis_id={analysis_id}")
        else:
            db_updated = False

        # 综合判断取消是否成功
        overall_success = async_task_cancelled or db_updated

        return {
            'success': overall_success,
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


@background_task(max_retries=2, retry_delay=30)
def analyze_batch_task(user_id, analysis_ids, model_name, max_concurrent=3):
    """
    批量分析图片任务
    支持并发控制，每个图片内部有4个请求（标题、描述、分类、标签）
    """
    try:
        logger.info(f"开始批量分析任务: user_id={user_id}, analysis_count={len(analysis_ids)}, max_concurrent={max_concurrent}")

        from ..models import OllamaImageAnalysis, OllamaAIModel, Media
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # 获取用户
        user = User.objects.get(id=user_id)

        # 获取分析任务
        analyses = OllamaImageAnalysis.objects.filter(
            id__in=analysis_ids,
            media__user_id=user_id
        ).select_related('media', 'model')

        if len(analyses) != len(analysis_ids):
            logger.warning(f"部分分析任务不存在: 请求 {len(analysis_ids)}, 找到 {len(analyses)}")

        # 获取模型信息
        try:
            model = OllamaAIModel.objects.get(name=model_name)
        except OllamaAIModel.DoesNotExist:
            logger.error(f"模型不存在: {model_name}")
            raise Exception(f"模型不存在: {model_name}")

        # 使用并发管理器进行批量处理
        from .concurrency_manager import concurrency_manager
        
        # 准备媒体ID列表
        media_ids = [analysis.media.id for analysis in analyses]
        
        # 使用并发管理器处理批量图片
        batch_result = concurrency_manager.process_batch_images(
            user_id=user_id,
            media_ids=media_ids,
            model_name=model_name,
            analysis_options={'max_concurrent': max_concurrent},
            executor_callback=None  # 不需要回调，因为内部会使用OllamaImageAnalyzer
        )

        # 转换结果格式以匹配原有接口
        completed_count = batch_result['success_count']
        failed_count = batch_result['error_count']
        
        results = []
        
        # 处理成功的结果
        for media_id, result_info in batch_result['results'].items():
            # 找到对应的analysis对象
            analysis = next(a for a in analyses if a.media.id == media_id)
            results.append({
                'analysis_id': analysis.id,
                'media_id': media_id,
                'success': True,
                'error': None,
                'results': result_info
            })
        
        # 处理失败的结果
        for failed_item in batch_result['failed_items']:
            results.append({
                'analysis_id': next(a for a in analyses if a.media.id == failed_item['media_id']).id,
                'media_id': failed_item['media_id'],
                'success': False,
                'error': failed_item['error']
            })

        logger.info(f"批量分析任务完成: 成功 {completed_count}, 失败 {failed_count}")

        return {
            'success': True,
            'completed_count': completed_count,
            'failed_count': failed_count,
            'total_count': len(analyses),
            'model_name': model_name,
            'max_concurrent': max_concurrent,
            'results': results
        }

    except Exception as e:
        logger.error(f"批量分析任务失败: {str(e)}")

        # 使用状态管理器标记所有未完成的分析任务为失败
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


def analyze_single_image(analysis, model):
    """
    分析单个图片
    每个图片内部有4个请求：标题、描述、分类、标签
    使用状态管理器避免数据库锁定
    """
    try:
        logger.debug(f"开始分析图片: media_id={analysis.media.id}")

        # 使用状态管理器更新状态为处理中
        from .state_manager import state_manager
        success = state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status='pending',
            to_status='processing'
        )
        
        if not success:
            logger.error(f"无法更新分析状态为处理中: analysis_id={analysis.id}")
            return {
                'success': False,
                'media_id': analysis.media.id,
                'error': '状态更新失败，可能任务已被其他进程处理'
            }

        # 使用真正的Ollama分析器
        from .ollama_client import OllamaImageAnalyzer
        analyzer = OllamaImageAnalyzer()
        
        # 执行真正的图片分析
        result = analyzer.analyze(analysis)
        
        if not result['success']:
            logger.error(f"Ollama分析失败: media_id={analysis.media.id}, error={result['error']}")
            # 更新任务状态为失败
            state_manager.update_analysis_status(
                analysis_id=analysis.id,
                from_status='processing',
                to_status='failed',
                error_message=result['error']
            )
            return {
                'success': False,
                'media_id': analysis.media.id,
                'error': result['error']
            }

        # 获取分析结果
        analysis_results = result.get('result', {})
        
        # 使用状态管理器更新媒体信息和任务状态
        # 准备结果数据
        result_data = {}
        if 'title' in analysis_results:
            result_data['title'] = analysis_results['title']
        if 'description' in analysis_results:
            result_data['description'] = analysis_results['description']
        if 'categories' in analysis_results:
            result_data['categories'] = analysis_results['categories']
        if 'tags' in analysis_results:
            result_data['tags'] = analysis_results['tags']
        
        # 原子性更新媒体信息
        media_update_success = state_manager.update_media_with_analysis_result(
            analysis, result_data
        )
        
        if not media_update_success:
            logger.warning(f"媒体信息更新失败，但继续完成任务: media_id={analysis.media.id}")
        
        # 将分类和标签列表转换为对象，以便数据库存储
        db_results = {}
        if 'categories' in analysis_results and isinstance(analysis_results['categories'], list):
            # 获取或创建分类对象
            from media.models import Category
            categories = []
            for name in analysis_results['categories']:
                if isinstance(name, str):
                    category, created = Category.objects.get_or_create(
                        name=name,
                        user=analysis.media.user,
                        defaults={'description': f'自动生成的分类: {name}'}
                    )
                    categories.append(category)
            db_results['categories'] = categories
            
        if 'tags' in analysis_results and isinstance(analysis_results['tags'], list):
            # 获取或创建标签对象
            from media.models import Tag
            tags = []
            for name in analysis_results['tags']:
                if isinstance(name, str):
                    tag, created = Tag.objects.get_or_create(
                        name=name,
                        user=analysis.media.user,
                        defaults={}
                    )
                    tags.append(tag)
            db_results['tags'] = tags
            
        if 'title' in analysis_results:
            db_results['title'] = analysis_results['title']
        if 'description' in analysis_results:
            db_results['description'] = analysis_results['description']
        
        # 计算处理时间
        processing_time_ms = result.get('processing_time_ms')
        if processing_time_ms is None and analysis.started_at:
            processing_time_ms = int((timezone.now() - analysis.started_at).total_seconds() * 1000)
        
        # 使用状态管理器更新任务状态为完成
        success = state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status='processing',
            to_status='completed',
            analysis_results=analysis_results,  # 保存原始结果用于JSON序列化
            processing_time=processing_time_ms
        )
        
        if not success:
            logger.error(f"无法更新分析状态为完成: analysis_id={analysis.id}")
            return {
                'success': False,
                'media_id': analysis.media.id,
                'error': '状态更新失败，任务可能已被其他进程修改'
            }

        logger.debug(f"图片分析完成: media_id={analysis.media.id}, 结果={list(analysis_results.keys())}")

        return {
            'success': True,
            'media_id': analysis.media.id,
            'results': db_results  # 返回包含对象的结果
        }

    except Exception as e:
        logger.error(f"图片分析失败: media_id={analysis.media.id}, error={str(e)}")

        # 使用状态管理器更新任务状态为失败
        from .state_manager import state_manager
        
        # 计算处理时间
        processing_time_ms = None
        try:
            if analysis.started_at:
                processing_time_ms = int((timezone.now() - analysis.started_at).total_seconds() * 1000)
        except:
            pass
        
        success = state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status=None,  # 允许从任何状态转换为失败
            to_status='failed',
            error_message=str(e),
            processing_time=processing_time_ms
        )
        
        if not success:
            logger.error(f"无法更新分析状态为失败: analysis_id={analysis.id}")

        return {
            'success': False,
            'media_id': analysis.media.id,
            'error': str(e)
        }


@background_task(max_retries=1, retry_delay=15)
def cancel_batch_tasks_task(user_id, analysis_ids=None, task_ids=None):
    """
    批量取消任务
    可以通过analysis_ids或task_ids取消
    """
    logger.info(f"🚫 开始批量取消任务: user_id={user_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # 获取用户
        user = User.objects.get(id=user_id)

        cancelled_count = 0
        error_count = 0
        results = []

        # 优先使用 task_ids 取消异步任务
        if task_ids:
            for task_id in task_ids:
                try:
                    task = Task.objects.filter(
                        id=task_id,
                        status__in=['pending', 'running', 'retry']
                    ).first()

                    if not task:
                        results.append({
                            'task_id': task_id,
                            'success': False,
                            'error': '任务不存在或已完成'
                        })
                        error_count += 1
                        continue

                    # 标记任务为已取消
                    task.status = 'cancelled'
                    task.last_errors = ['用户批量取消']
                    task.completed_at = timezone.now()
                    task.save()

                    results.append({
                        'task_id': task_id,
                        'success': True,
                        'status': 'cancelled'
                    })
                    cancelled_count += 1

                except Exception as e:
                    results.append({
                        'task_id': task_id,
                        'success': False,
                        'error': str(e)
                    })
                    error_count += 1

        # 使用 analysis_ids 取消分析任务
        if analysis_ids:
            analyses = OllamaImageAnalysis.objects.filter(
                id__in=analysis_ids,
                media__user=user,
                status__in=['pending', 'processing']
            )

            for analysis in analyses:
                try:
                    # 如果有关联的异步任务，也取消
                    if analysis.task_id:
                        try:
                            task = Task.objects.get(id=analysis.task_id)
                            if task.status in ['pending', 'running', 'retry']:
                                task.status = 'cancelled'
                                task.last_errors = ['用户批量取消']
                                task.completed_at = timezone.now()
                                task.save()
                        except Task.DoesNotExist:
                            pass

                    # 更新分析任务状态
                    analysis.status = 'cancelled'
                    analysis.completed_at = timezone.now()
                    analysis.error_message = '用户批量取消'
                    analysis.save()

                    results.append({
                        'analysis_id': analysis.id,
                        'media_id': analysis.media.id,
                        'success': True,
                        'status': 'cancelled'
                    })
                    cancelled_count += 1

                except Exception as e:
                    results.append({
                        'analysis_id': analysis.id,
                        'success': False,
                        'error': str(e)
                    })
                    error_count += 1

        logger.info(f"批量取消任务完成: 成功 {cancelled_count}, 失败 {error_count}")

        return {
            'success': True,
            'cancelled_count': cancelled_count,
            'error_count': error_count,
            'total_count': len(results),
            'results': results
        }

    except Exception as e:
        logger.error(f"批量取消任务失败: {str(e)}")
        return {'success': False, 'error': f"批量取消失败: {str(e)}"}


@background_task(max_retries=1, retry_delay=15)
def cancel_all_user_tasks_task(user_id):
    """
    取消用户所有进行中和待处理的任务
    """
    logger.info(f"🚫 开始取消用户所有任务: user_id={user_id}")

    try:
        from ..models import OllamaImageAnalysis
        from django_async_manager.models import Task
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # 获取用户
        user = User.objects.get(id=user_id)

        # 取消数据库中的分析任务（只取消pending和processing状态）
        cancelled_analyses = OllamaImageAnalysis.objects.filter(
            media__user=user,
            status__in=['pending', 'processing']
        ).update(
            status='cancelled',
            completed_at=timezone.now(),
            error_message='用户取消所有任务'
        )
        
        logger.info(f"🚫 取消数据库中的分析任务: {cancelled_analyses} 个")

        # 取消异步队列中的任务
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

