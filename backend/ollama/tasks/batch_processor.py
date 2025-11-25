"""
改进的批量处理器
提供更好的错误处理和恢复机制
"""

import logging
import time
from typing import Dict, Any, List, Tuple
from django.db import transaction
from django.utils import timezone
from django_async_manager import get_background_task
from .atomic_state_manager import atomic_state_manager

logger = logging.getLogger(__name__)
background_task = get_background_task()


class BatchProcessingError(Exception):
    """批量处理错误基类"""
    pass


class BatchValidationError(BatchProcessingError):
    """批量处理验证错误"""
    pass


class BatchExecutionError(BatchProcessingError):
    """批量处理执行错误"""
    pass


class BatchProcessor:
    """批量处理器"""

    def __init__(self):
        self.max_batch_size = 20
        self.default_concurrent = 2
        self.max_concurrent_per_user = 5
        self.task_timeout = 300  # 5分钟

    def validate_batch_request(self, media_ids: List[int], model_name: str = None,
                              analysis_options: Dict[str, Any] = None) -> Dict[str, Any]:
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
        concurrency_errors = self._validate_concurrency_options(analysis_options)
        errors.extend(concurrency_errors)

        # 验证模型名称
        if model_name and not isinstance(model_name, str):
            errors.append("模型名称必须是字符串")

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'media_count': len(media_ids)
        }

    def _validate_concurrency_options(self, options: Dict[str, Any]) -> List[str]:
        """验证并发控制选项"""
        errors = []

        if 'max_concurrent' in options:
            max_concurrent = options['max_concurrent']
            if not isinstance(max_concurrent, int) or not 1 <= max_concurrent <= self.max_concurrent_per_user:
                errors.append(f'max_concurrent必须在1-{self.max_concurrent_per_user}之间')

        if 'use_concurrency' in options:
            use_concurrency = options['use_concurrency']
            if not isinstance(use_concurrency, bool):
                errors.append('use_concurrency必须是布尔值')

        return errors

    @transaction.atomic
    def prepare_batch_tasks(self, user, media_ids: List[int], model_name: str = None,
                          analysis_options: Dict[str, Any] = None) -> Tuple[List, List, Dict[str, Any]]:
        """准备批量任务（原子性操作）"""
        from media.models import Media
        from ..models import OllamaAIModel, OllamaImageAnalysis

        valid_tasks = []
        validation_errors = []

        try:
            # 验证并获取媒体文件
            valid_media_items = []
            for media_id in media_ids:
                try:
                    media = Media.objects.get(id=media_id, user=user)
                    valid_media_items.append(media)
                except Media.DoesNotExist:
                    validation_errors.append({
                        'media_id': media_id,
                        'error': '媒体文件不存在或无权访问'
                    })

            # 即使没有有效媒体文件，也继续处理，让视图层能够返回包含跳过项的响应
            # 这样可以保持API响应格式的一致性

            # 获取或验证模型
            model = self._get_or_validate_model(user, model_name)
            if not model:
                raise BatchValidationError("没有可用的分析模型")

            # 为每个媒体文件创建分析任务 - 允许重复任务
            for media in valid_media_items:
                try:
                    # 直接创建新的分析任务，不检查重复
                    # 每次批量分析都应该创建新的异步任务
                    analysis = OllamaImageAnalysis.objects.create(
                        media=media,
                        model=model,
                        analysis_options=analysis_options or {},
                        prompt=None,
                        status='pending'
                    )

                    valid_tasks.append(analysis)
                    logger.info(f"✅ 创建分析任务: media_id={media.id}, analysis_id={analysis.id}")

                except Exception as e:
                    validation_errors.append({
                        'media_id': media.id,
                        'error': f"创建分析任务失败: {str(e)}"
                    })

            # 注意：移除了skipped_items处理，因为现在允许重复任务
            # 每个媒体文件都会创建新的分析任务

            summary = {
                'total_requested': len(media_ids),
                'valid_tasks': len(valid_tasks),
                'validation_errors': len(validation_errors),
                'skipped_items': 0  # 移除跳过逻辑，总是0
            }

            logger.info(f"批量任务准备完成: {summary}")
            return valid_tasks, validation_errors, summary

        except Exception as e:
            logger.error(f"批量任务准备失败: {str(e)}")
            raise BatchValidationError(f"批量任务准备失败: {str(e)}")

    def _get_or_validate_model(self, user, model_name: str = None):
        """获取或验证模型"""
        from ..models import OllamaAIModel

        queryset = OllamaAIModel.objects.filter(
            endpoint__created_by=user,
            is_active=True,
            is_vision_capable=True
        )

        if model_name:
            queryset = queryset.filter(name=model_name)

        # 优先使用默认模型
        model = queryset.filter(is_default=True).first()
        if not model:
            model = queryset.first()

        return model

    def execute_batch_processing(self, user, valid_tasks: List, analysis_options: Dict[str, Any]) -> Dict[str, Any]:
        """执行批量处理"""
        try:
            if not valid_tasks:
                raise BatchExecutionError("没有有效的任务需要处理")

            # 准备执行参数
            media_ids = [task.media.id for task in valid_tasks]
            model_name = valid_tasks[0].model.name  # 所有任务使用相同模型

            # 创建 media_id 到 analysis_id 的映射
            media_to_analysis = {task.media.id: task.id for task in valid_tasks}

            # 导入并发控制器
            from .concurrency_controller import concurrency_controller

            # 准备执行器回调
            from .image_analyzer import OllamaImageAnalyzer
            analyzer = OllamaImageAnalyzer()

            def executor_callback(analysis_obj, prompt_text):
                return analyzer._prepare_single_analysis(analysis_obj, prompt_text)

            # 执行批量处理
            logger.info(f"🚀 开始执行批量处理: {len(media_ids)} 个文件，用户: {user.id}")
            start_time = time.time()

            batch_result = concurrency_controller.process_batch_images(
                user_id=user.id,
                media_ids=media_ids,
                model_name=model_name,
                analysis_options=analysis_options,
                executor_callback=executor_callback
            )

            processing_time = int((time.time() - start_time) * 1000)

            logger.info(f"📊 批量处理完成: 成功 {batch_result['success_count']} 个，"
                       f"失败 {batch_result['error_count']} 个，耗时: {processing_time}ms")

            # 增强结果格式，添加 analysis_ids
            enhanced_results = []
            for result in batch_result['results']:
                media_id = result.get('media_id')
                enhanced_result = result.copy()
                enhanced_result['analysis_id'] = media_to_analysis.get(media_id)
                enhanced_results.append(enhanced_result)

            # 增强失败项，添加 analysis_ids
            enhanced_failed_items = []
            for failed_item in batch_result['failed_items']:
                media_id = failed_item.get('media_id')
                enhanced_failed_item = failed_item.copy()
                enhanced_failed_item['analysis_id'] = media_to_analysis.get(media_id)
                enhanced_failed_items.append(enhanced_failed_item)

            return {
                'success_count': batch_result['success_count'],
                'error_count': batch_result['error_count'],
                'results': enhanced_results,
                'failed_items': enhanced_failed_items,
                'processing_time_ms': processing_time,
                'media_ids': media_ids,
                'analysis_ids': list(media_to_analysis.values()),
                'media_analysis_mapping': media_to_analysis
            }

        except Exception as e:
            logger.error(f"❌ 批量处理执行失败: {str(e)}")
            raise BatchExecutionError(f"批量处理执行失败: {str(e)}")

    def handle_batch_failure(self, valid_tasks: List, error: Exception):
        """处理批量失败情况"""
        try:
            # 取消所有已提交的任务
            analysis_ids = [task.id for task in valid_tasks]
            cancelled_result = atomic_state_manager.batch_update_status(
                analysis_ids=analysis_ids,
                from_status=['pending', 'processing'],
                to_status='failed',
                error_message=f"批量处理失败: {str(error)}"
            )

            logger.info(f"🚫 批量失败处理: 取消了 {cancelled_result['success_count']} 个任务")

            return cancelled_result

        except Exception as cleanup_error:
            logger.error(f"❌ 批量失败清理操作失败: {str(cleanup_error)}")
            return {'success_count': 0, 'error_count': len(valid_tasks)}

    def _start_async_batch_processing(self, user, valid_tasks: List, analysis_options: Dict[str, Any]) -> None:
        """启动基于并发控制的异步批量处理 - 所有任务都在worker中并发运行"""
        try:
            from .concurrency_controller import concurrency_controller

            logger.info(f"🚀 启动基于并发控制的批量处理: {len(valid_tasks)} 个任务")

            # 获取并发控制参数
            max_concurrent = analysis_options.get('max_concurrent', self.default_concurrent)

            # 准备任务数据
            task_data = []
            for analysis in valid_tasks:
                task_data.append({
                    'analysis_id': analysis.id,
                    'media_id': analysis.media.id,
                    'analysis': analysis
                })

            # 使用并发控制器执行批量处理
            def task_executor(analysis_obj):
                """单个任务的执行函数 - 直接执行图片分析，不创建异步任务"""
                try:
                    from .image_analyzer import OllamaImageAnalyzer

                    logger.info(f"🔄 开始并发图片分析: analysis_id={analysis_obj.id}")

                    # 立即标记任务开始处理（避免状态卡住）
                    try:
                        analysis_obj.mark_as_started()
                        analysis_obj.save(update_fields=['status', 'started_at'])
                    except Exception as save_error:
                        logger.error(f"❌ 无法标记任务开始: analysis_id={analysis_obj.id}, error={str(save_error)}")

                    # 直接执行图片分析，但强制使用串行模式避免双重并发控制
                    analyzer = OllamaImageAnalyzer()
                    # 临时修改分析选项，强制串行执行
                    original_options = analysis_obj.analysis_options.copy()
                    analysis_obj.analysis_options['use_concurrency'] = False
                    # 保存选项更改
                    analysis_obj.save(update_fields=['analysis_options'])

                    result = analyzer.analyze(analysis_obj)
                    # 恢复原始选项
                    analysis_obj.analysis_options = original_options
                    analysis_obj.save(update_fields=['analysis_options'])

                    # 处理分析结果
                    if result.get('success'):
                        # 标记为已完成
                        processing_time = result.get('processing_time_ms')
                        analysis_obj.mark_as_completed(processing_time)

                        # 更新媒体文件信息
                        if result.get('result'):
                            analysis_obj.update_media_with_analysis_result(result['result'])

                        logger.info(f"✅ 并发图片分析完成: analysis_id={analysis_obj.id}")
                    else:
                        # 标记为失败
                        error_message = result.get('error', '未知错误')
                        analysis_obj.mark_as_failed(error_message)
                        logger.error(f"❌ 图片分析失败: analysis_id={analysis_obj.id}, 错误: {error_message}")

                    # 保存状态更改
                    analysis_obj.save()

                    return {
                        'success': result.get('success', False),
                        'analysis_id': analysis_obj.id,
                        'result': result,
                        'media_id': analysis_obj.media.id
                    }

                except Exception as e:
                    logger.error(f"❌ 并发图片分析失败: analysis_id={analysis_obj.id}, error={str(e)}")
                    try:
                        analysis_obj.mark_as_failed(f'并发图片分析失败: {str(e)}')
                        analysis_obj.save()
                    except Exception as save_error:
                        logger.error(f"❌ 无法标记任务失败: analysis_id={analysis_obj.id}, error={str(save_error)}")

                    return {
                        'success': False,
                        'analysis_id': analysis_obj.id,
                        'error': str(e),
                        'media_id': analysis_obj.media.id
                    }

            # 通过并发控制器提交所有任务
            # 添加数据库连接检查和错误处理
            try:
                futures = []
                submitted_count = 0

                for task_info in task_data:
                    try:
                        # 确保数据库连接可用
                        from django.db import connection
                        if connection.connection and connection.connection.closed:
                            connection.connection = None

                        future = concurrency_controller.submit_task(
                            user_id=user.id,
                            task_func=task_executor,
                            analysis_obj=task_info['analysis']
                        )
                        futures.append(future)
                        submitted_count += 1

                        logger.debug(f"✅ 成功提交任务: analysis_id={task_info['analysis'].id}")

                    except Exception as submit_error:
                        logger.error(f"❌ 提交任务失败: analysis_id={task_info['analysis'].id}, error={str(submit_error)}")
                        # 标记失败的任务
                        try:
                            task_info['analysis'].mark_as_failed(f'任务提交失败: {str(submit_error)}')
                            task_info['analysis'].save()
                        except:
                            pass

                logger.info(f"🎯 并发批量处理启动: 成功提交 {submitted_count}/{len(task_data)} 个任务到并发控制器")

                # 如果没有任何任务被成功提交，处理剩余任务
                if submitted_count == 0:
                    logger.error("❌ 没有任务能够被成功提交到并发控制器")
                    self.handle_batch_failure(valid_tasks, "并发控制器无法接受任何任务")

            except Exception as e:
                logger.error(f"❌ 并发批量处理启动失败: {str(e)}")
                # 如果并发控制失败，回退到原来的方式

        except Exception as e:
            logger.error(f"❌ 并发批量处理启动失败: {str(e)}")
            # 如果并发控制失败，回退到原来的方式
            try:
                logger.info("🔄 回退到直接异步任务模式")
                self._fallback_to_direct_async_tasks(user, valid_tasks)
            except Exception as fallback_error:
                logger.error(f"❌ 回退处理也失败: {str(fallback_error)}")
                self.handle_batch_failure(valid_tasks, fallback_error)

    def _fallback_to_direct_async_tasks(self, user, valid_tasks: List) -> None:
        """回退到直接异步任务模式（不经过并发控制器）"""
        from .async_tasks import analyze_image_with_ollama_task

        for analysis in valid_tasks:
            try:
                task = analyze_image_with_ollama_task.run_async(analysis_id=analysis.id)
                analysis.task_id = task.id
                analysis.save(update_fields=['task_id'])

                logger.info(f"🔄 回退任务创建: analysis_id={analysis.id}, task_id={task.id}")

            except Exception as e:
                logger.error(f"❌ 回退任务创建失败: analysis_id={analysis.id}, error={str(e)}")
                analysis.mark_as_failed(f'任务创建失败: {str(e)}')

    def analyze_images_with_concurrency_task(self, user_id: int, media_ids: List[int],
                                             model_name: str, analysis_options: Dict[str, Any] = None,
                                             prompt: str = None) -> Dict[str, Any]:
        """
        图片并发批量分析任务
        提供更好的错误处理和恢复机制
        """
        logger.info(f"🚀 开始图片并发批量分析: {len(media_ids)} 张图片，用户: {user_id}")

        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()

            # 获取用户
            user = User.objects.get(id=user_id)

            # 创建批量处理器实例
            processor = BatchProcessor()

            # 验证批量请求
            validation_result = processor.validate_batch_request(media_ids, model_name, analysis_options)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': f"批量请求验证失败: {'; '.join(validation_result['errors'])}",
                    'validation_errors': validation_result['errors']
                }

            # 准备批量任务（原子性操作）
            valid_tasks, validation_errors, summary = processor.prepare_batch_tasks(
                user=user,
                media_ids=media_ids,
                model_name=model_name,
                analysis_options=analysis_options
            )

            # 如果没有有效任务，返回结果
            if not valid_tasks:
                return {
                    'success': False,
                    'error': '没有可处理的任务',
                    'validation_errors': validation_errors,
                    'summary': summary
                }

            # 🔥 关键修复：立即启动异步处理，不等待结果
            try:
                # 创建 media_id 到 analysis_id 的映射
                media_to_analysis = {task.media.id: task.id for task in valid_tasks}

                # 立即启动并发批量处理（在后台异步执行）
                processor._start_async_batch_processing(user, valid_tasks, analysis_options)

                # 立即返回任务启动信息，不等待处理完成
                response = {
                    'success': True,
                    'batch_started': True,
                    'summary': summary,
                    'analysis_ids': list(media_to_analysis.values()),
                    'media_analysis_mapping': media_to_analysis,
                    'validation_errors': validation_errors if validation_errors else None,
                    'warnings': validation_result.get('warnings', []),
                    'message': '批量分析任务已启动，正在后台异步处理'
                }

                logger.info(f"🚀 批量分析任务已启动: {summary['total_requested']} 个文件，{len(valid_tasks)} 个有效任务")
                return response

            except Exception as e:
                # 处理任务启动错误
                logger.error(f"❌ 批量任务启动失败: {str(e)}")
                processor.handle_batch_failure(valid_tasks, e)

                return {
                    'success': False,
                    'error': f"批量任务启动失败: {str(e)}",
                    'summary': summary,
                    'validation_errors': validation_errors,
                    'cancelled_count': len(valid_tasks)
                }

        except Exception as e:
            logger.error(f"❌ 批量分析任务异常: {str(e)}")

            # 尝试清理资源
            try:
                if 'valid_tasks' in locals():
                    processor.handle_batch_failure(valid_tasks, e)
            except:
                pass

            return {
                'success': False,
                'error': f"批量分析任务异常: {str(e)}",
                'media_ids': media_ids,
                'user_id': user_id
            }

    def get_batch_status_summary(self, user) -> Dict[str, Any]:
        """获取批量状态摘要"""
        try:
            # 使用原子状态管理器获取统计信息
            user_stats = atomic_state_manager.get_user_task_statistics(user.id)

            # 添加批量特定信息
            from django_async_manager.models import Task
            batch_tasks = Task.objects.filter(
                name__startswith='improved_analyze_images_with_concurrency_task',
                status__in=['PENDING', 'RUNNING', 'RETRY']
            ).count()

            return {
                'user_task_stats': user_stats,
                'active_batch_tasks': batch_tasks,
                'system_status': 'healthy' if batch_tasks < 5 else 'busy'
            }

        except Exception as e:
            logger.error(f"❌ 获取批量状态失败: {str(e)}")
            return {
                'user_task_stats': {},
                'active_batch_tasks': 0,
                'system_status': 'error',
                'error': str(e)
            }


# 全局批量处理器实例
batch_processor = BatchProcessor()


# Django异步任务管理器兼容性包装器（必需）
@background_task(max_retries=2, retry_delay=60)
def analyze_images_with_concurrency_task(user_id: int, media_ids: List[int],
                                       model_name: str, analysis_options: Dict[str, Any] = None,
                                       prompt: str = None) -> Dict[str, Any]:
    """
    Django异步任务管理器兼容性包装器

    由于Django异步任务系统只能调用模块级函数，无法调用类方法，
    因此需要这个包装器函数来桥接到批量处理器实例。

    Args:
        user_id: 用户ID
        media_ids: 媒体ID列表
        model_name: 模型名称
        analysis_options: 分析选项
        prompt: 自定义提示词

    Returns:
        Dict[str, Any]: 任务执行结果
    """
    # 创建新的批量处理器实例，避免序列化问题
    processor = BatchProcessor()
    return processor.analyze_images_with_concurrency_task(
        user_id, media_ids, model_name, analysis_options, prompt
    )