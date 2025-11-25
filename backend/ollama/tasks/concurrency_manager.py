"""
改进的并发分析管理器
解决原有线程控制不稳定、状态控制不稳定等问题
"""

import threading
import time
import logging
from typing import Dict, Any, List, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, Future, as_completed
from django.conf import settings
from django.core.cache import cache
from .task_cancellation import cancellation_manager, TaskCancelledException

logger = logging.getLogger(__name__)


class ConcurrencyManager:
    """并发分析管理器"""

    def __init__(self):
        # 每个用户的独立线程池执行器
        self.user_executors: Dict[int, ThreadPoolExecutor] = {}
        # 跟踪所有活动的Future对象
        self.active_futures: Dict[Future, Dict[str, Any]] = {}
        # 用户信号量管理
        self.user_semaphores: Dict[int, threading.Semaphore] = {}
        # 全局控制锁
        self._lock = threading.RLock()
        # 系统关闭标志
        self._shutdown_event = threading.Event()
        # 全局活跃线程计数器
        self.global_active_threads = 0

        # 系统限制配置
        self.global_max_concurrent = getattr(settings, 'OLLAMA_GLOBAL_MAX_CONCURRENT', 20)  # 增加全局并发限制
        self.default_concurrent = getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 5)  # 增加默认并发限制
        self.cleanup_interval = 300  # 5分钟清理一次
        self.executor_timeout = 3600  # 1小时后清理空闲执行器

        # 启动后台清理线程
        self._start_cleanup_thread()

    def _start_cleanup_thread(self):
        """启动后台清理线程"""
        def cleanup_worker():
            while not self._shutdown_event.wait(self.cleanup_interval):
                try:
                    self.cleanup_idle_resources()
                except Exception as e:
                    logger.error(f"清理资源时出错: {str(e)}")

        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        logger.info("🧹 后台资源清理线程已启动")

    def get_or_create_user_executor(self, user_id: int, max_workers: int) -> ThreadPoolExecutor:
        """获取或创建用户线程池执行器"""
        with self._lock:
            # 检查系统是否正在关闭
            if self._shutdown_event.is_set():
                raise Exception("系统正在关闭，不接受新任务")

            # 检查全局并发限制
            current_global_threads = sum(
                executor._threads.__len__() if hasattr(executor, '_threads') else 0
                for executor in self.user_executors.values()
            )

            # 移除全局线程数限制，允许每个用户独立控制并发数
            # if current_global_threads >= self.global_max_concurrent:
            #     logger.warning(f"⚠️ 全局线程数已达上限: {current_global_threads}/{self.global_max_concurrent}")
            #     # 使用最小线程数创建执行器，确保新任务能被接受但会排队等待
            #     max_workers = min(max_workers, max(1, self.global_max_concurrent - current_global_threads))

            # 为用户创建或获取执行器
            if user_id not in self.user_executors:
                executor = ThreadPoolExecutor(
                    max_workers=max_workers,
                    thread_name_prefix=f"user_{user_id}_worker"
                )
                self.user_executors[user_id] = executor
                logger.info(f"🔧 为用户 {user_id} 创建线程池执行器，最大并发: {max_workers}")
            else:
                # 检查是否需要更新执行器的最大工作线程数
                existing_executor = self.user_executors[user_id]
                if hasattr(existing_executor, '_max_workers') and existing_executor._max_workers < max_workers:
                    logger.info(f"🔧 用户 {user_id} 的线程池执行器需要更新并发限制，从 {existing_executor._max_workers} 增加到 {max_workers}")
                    # 注意：ThreadPoolExecutor 不支持动态调整 max_workers
                    # 这里只是记录日志，实际使用中可能需要重新创建执行器
                    # 但为了稳定性，我们保持现有执行器，只更新信号量

            return self.user_executors[user_id]

    def get_user_semaphore(self, user_id: int, max_concurrent: int) -> threading.Semaphore:
        """获取用户并发控制信号量"""
        with self._lock:
            if user_id not in self.user_semaphores:
                self.user_semaphores[user_id] = threading.Semaphore(max_concurrent)
                logger.info(f"🔧 为用户 {user_id} 创建信号量，并发限制: {max_concurrent}")
            else:
                # 检查是否需要更新信号量限制
                current_semaphore = self.user_semaphores[user_id]
                current_value = current_semaphore._value
                max_value = max_concurrent
                
                # 如果新的并发限制更大，需要重新创建信号量
                if max_value > current_value:
                    self.user_semaphores[user_id] = threading.Semaphore(max_concurrent)
                    logger.info(f"🔧 更新用户 {user_id} 信号量，从 {current_value} 增加到 {max_concurrent}")
                    
            return self.user_semaphores[user_id]

    def submit_task(self, user_id: int, task_func, *args, max_concurrent: Optional[int] = None, **kwargs) -> Future:
        """提交任务到用户的线程池"""
        max_concurrent = max_concurrent or self.default_concurrent
        
        logger.debug(f"📤 提交任务: 用户 {user_id}, 并发限制: {max_concurrent}")

        # 检查系统是否关闭
        if self._shutdown_event.is_set():
            raise Exception("系统正在关闭，不接受新任务")

        # 获取用户执行器
        executor = self.get_or_create_user_executor(user_id, max_concurrent)

        # 获取用户信号量
        semaphore = self.get_user_semaphore(user_id, max_concurrent)

        def task_wrapper(*task_args, **task_kwargs):
            """任务包装器，管理信号量和状态"""
            # 获取信号量
            semaphore.acquire()
            thread_id = threading.get_ident()

            try:
                with self._lock:
                    self.global_active_threads += 1

                logger.info(f"🚀 用户 {user_id} 任务开始执行 (线程: {thread_id})")
                start_time = time.time()

                # 执行实际任务
                result = task_func(*task_args, **task_kwargs)

                processing_time = time.time() - start_time
                logger.info(f"✅ 用户 {user_id} 任务完成，耗时: {processing_time:.2f}s")

                return result

            except TaskCancelledException:
                logger.info(f"🚫 用户 {user_id} 任务被取消 (线程: {thread_id})")
                raise
            except Exception as e:
                logger.error(f"❌ 用户 {user_id} 任务执行失败: {str(e)}")
                raise
            finally:
                # 释放信号量和更新计数器
                semaphore.release()
                with self._lock:
                    self.global_active_threads -= 1
                    # 从活动任务列表中移除
                    for future in list(self.active_futures.keys()):
                        if future.done() or future.cancelled():
                            self.active_futures.pop(future, None)

        # 提交任务
        future = executor.submit(task_wrapper, *args, **kwargs)

        # 记录活动任务
        with self._lock:
            self.active_futures[future] = {
                'user_id': user_id,
                'thread_name': threading.current_thread().name,
                'submitted_at': time.time()
            }

        return future

    def cancel_user_tasks(self, user_id: int) -> Dict[str, Any]:
        """取消用户的所有任务"""
        cancelled_count = 0
        cancelled_futures = []

        with self._lock:
            # 找到该用户的所有活动任务
            user_futures = [
                future for future, info in self.active_futures.items()
                if info['user_id'] == user_id
            ]

            # 尝试取消未开始的任务
            for future in user_futures:
                if not future.running():
                    if future.cancel():
                        cancelled_count += 1
                        cancelled_futures.append(future)
                        logger.debug(f"🚫 取消未开始的任务: {future}")

        # 清理已取消的任务
        for future in cancelled_futures:
            self.active_futures.pop(future, None)

        # 通过任务管理器取消可取消任务
        task_cancelled_count = cancellation_manager.cancel_user_tasks(user_id)

        total_cancelled = cancelled_count + task_cancelled_count

        logger.info(f"🚫 用户 {user_id} 任务取消完成: "
                   f"future_cancelled={cancelled_count}, "
                   f"task_cancelled={task_cancelled_count}, "
                   f"total={total_cancelled}")

        return {
            'cancelled_count': total_cancelled,
            'future_cancelled': cancelled_count,
            'task_cancelled': task_cancelled_count
        }

    def execute_tasks_concurrently(
        self,
        tasks: List[Tuple[str, str]],
        analysis,
        executor_callback
    ) -> Dict[str, Any]:
        """并发执行分析任务（改进版）"""
        user_id = analysis.media.user.id if hasattr(analysis.media, 'user') else None
        options = analysis.analysis_options

        # 获取并发控制参数
        max_concurrent = options.get('max_concurrent', self.default_concurrent)
        # 移除全局并发限制，允许用户设置更高的并发数
        # max_concurrent = min(max_concurrent, self.global_max_concurrent)

        logger.info(f"🔄 开始改进版并发执行 {len(tasks)} 个任务，用户: {user_id}，并发数: {max_concurrent}")

        results = {}
        failed_tasks = []
        submitted_futures = []

        try:
            # 提交所有任务
            for task_name, task_prompt in tasks:
                try:
                    future = self.submit_task(
                        user_id=user_id,
                        task_func=self._execute_single_task,
                        task_name=task_name,
                        task_prompt=task_prompt,
                        analysis=analysis,
                        executor_callback=executor_callback,
                        max_concurrent=max_concurrent
                    )
                    submitted_futures.append((future, task_name))
                except Exception as e:
                    failed_tasks.append(f"{task_name}: 提交任务失败 - {str(e)}")
                    logger.error(f"❌ 任务 {task_name} 提交失败: {str(e)}")

            # 等待所有任务完成
            for future, task_name in submitted_futures:
                try:
                    # 设置超时限制
                    timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)
                    result = future.result(timeout=timeout)

                    if result['success']:
                        results[task_name] = result['result']
                        logger.debug(f"✅ 任务 {task_name} 执行成功")
                    else:
                        failed_tasks.append(f"{task_name}: {result['error']}")
                        logger.error(f"❌ 任务 {task_name} 执行失败: {result['error']}")

                except Exception as e:
                    failed_tasks.append(f"{task_name}: 执行异常 - {str(e)}")
                    logger.error(f"❌ 任务 {task_name} 执行异常: {str(e)}")

            logger.info(f"📊 并发执行完成: 成功 {len(results)} 个，失败 {len(failed_tasks)} 个")

            return {
                'results': results,
                'failed_tasks': failed_tasks,
                'total_tasks': len(tasks),
                'completed_tasks': len(results)
            }

        except Exception as e:
            logger.error(f"❌ 并发执行出现严重错误: {str(e)}")
            return {
                'results': results,
                'failed_tasks': failed_tasks + [f"系统错误: {str(e)}"],
                'total_tasks': len(tasks),
                'completed_tasks': len(results)
            }

    def _execute_single_task(self, task_name: str, task_prompt: str, analysis, executor_callback) -> Dict[str, Any]:
        """执行单个任务（支持取消）"""
        # 创建可取消任务
        cancellable_task = cancellation_manager.create_task(
            f"{task_name}_{analysis.id}_{int(time.time())}",
            analysis.media.user.id
        )

        try:
            cancellable_task.start()

            # 检查取消状态
            cancellable_task.check_cancelled()

            # 执行回调准备数据
            data = cancellable_task.execute_with_cancellation_check(
                executor_callback, analysis, task_prompt
            )

            # 再次检查取消状态
            cancellable_task.check_cancelled()

            # 调用API
            api_result = cancellable_task.execute_with_cancellation_check(
                self._call_api_with_timeout,
                analysis.model.endpoint.url,
                analysis.model.name,
                data,
                cancellable_task
            )

            # 最终检查取消状态
            cancellable_task.check_cancelled()

            if api_result['success']:
                # 处理结果
                from .ollama_client import OllamaImageAnalyzer
                analyzer = OllamaImageAnalyzer()

                response_dict = api_result['response']
                if isinstance(response_dict, dict) and 'response' in response_dict:
                    response_text = response_dict['response']
                else:
                    response_text = str(response_dict)

                task_result = analyzer._process_single_result(response_text, task_name)

                cancellable_task.set_result(task_result)
                return {'success': True, 'result': task_result}
            else:
                error_msg = api_result['error']
                cancellable_task.set_error(Exception(error_msg))
                return {'success': False, 'error': error_msg}

        except TaskCancelledException:
            logger.info(f"🚫 任务 {task_name} 被取消")
            return {'success': False, 'error': '任务已被取消', 'cancelled': True}
        except Exception as e:
            error_msg = f"任务 {task_name} 异常: {str(e)}"
            cancellable_task.set_error(e)
            logger.error(error_msg)
            return {'success': False, 'error': error_msg}
        finally:
            # 清理任务
            cancellation_manager.remove_task(cancellable_task.task_id)

    def _call_api_with_timeout(self, endpoint_url: str, model_name: str, data: Dict, cancellable_task) -> Dict:
        """调用API（带取消检查）"""
        import requests

        timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)
        api_url = f"{endpoint_url.rstrip('/')}/api/generate"

        request_data = {
            'model': model_name,
            'prompt': data['prompt'],
            'images': [data['image']],
            'stream': False,
            'options': data['options']
        }

        try:
            # 使用可取消任务执行请求
            response = cancellable_task.execute_with_cancellation_check(
                requests.post,
                api_url,
                json=request_data,
                timeout=timeout,
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code == 200:
                return {
                    'success': True,
                    'response': response.json()
                }
            else:
                return {
                    'success': False,
                    'error': f"API请求失败: HTTP {response.status_code}"
                }

        except requests.exceptions.Timeout:
            return {'success': False, 'error': "API请求超时"}
        except requests.exceptions.ConnectionError:
            return {'success': False, 'error': "无法连接到Ollama服务"}
        except Exception as e:
            if "取消" in str(e):
                raise e
            return {'success': False, 'error': f"API调用异常: {str(e)}"}

    def get_active_tasks_info(self) -> Dict[str, Any]:
        """获取当前活跃任务信息"""
        with self._lock:
            user_task_counts = {}
            for info in self.active_futures.values():
                user_id = info['user_id']
                user_task_counts[user_id] = user_task_counts.get(user_id, 0) + 1

            return {
                'total_active_tasks': len(self.active_futures),
                'global_active_threads': self.global_active_threads,
                'user_executors_count': len(self.user_executors),
                'user_semaphores_count': len(self.user_semaphores),
                'user_task_counts': user_task_counts,
                'active_futures_details': [
                    {
                        'user_id': info['user_id'],
                        'submitted_at': info['submitted_at'],
                        'is_running': future.running(),
                        'is_done': future.done()
                    }
                    for future, info in self.active_futures.items()
                ]
            }

    def cleanup_user_resources(self, user_id: int):
        """清理用户资源"""
        with self._lock:
            cancelled_count = self.cancel_user_tasks(user_id)['cancelled_count']

            # 关闭用户执行器
            if user_id in self.user_executors:
                executor = self.user_executors[user_id]
                executor.shutdown(wait=False)
                del self.user_executors[user_id]
                logger.info(f"🔧 关闭用户 {user_id} 的线程池执行器")

            # 清理用户信号量
            if user_id in self.user_semaphores:
                del self.user_semaphores[user_id]
                logger.info(f"🔧 清理用户 {user_id} 的信号量")

        logger.info(f"🧹 用户 {user_id} 资源清理完成，取消 {cancelled_count} 个任务")

    def cleanup_idle_resources(self):
        """清理空闲资源"""
        with self._lock:
            current_time = time.time()
            idle_threshold = self.executor_timeout

            # 清理空闲的执行器
            users_to_remove = []
            for user_id, executor in self.user_executors.items():
                # 检查是否有活动任务
                user_has_active_tasks = any(
                    info['user_id'] == user_id for info in self.active_futures.values()
                )

                if not user_has_active_tasks:
                    users_to_remove.append(user_id)

            for user_id in users_to_remove:
                self.cleanup_user_resources(user_id)

            # 清理已完成的Future
            completed_futures = [
                future for future in self.active_futures.keys()
                if future.done() or future.cancelled()
            ]
            for future in completed_futures:
                self.active_futures.pop(future, None)

            # 清理任务管理器中的已完成任务
            cancellation_manager.cleanup_completed_tasks()

        if users_to_remove or completed_futures:
            logger.info(f"🧹 清理完成: 移除 {len(users_to_remove)} 个用户执行器, "
                       f"清理 {len(completed_futures)} 个已完成的任务")

    def shutdown(self):
        """关闭管理器"""
        logger.info("🛑 正在关闭并发管理器...")

        self._shutdown_event.set()

        with self._lock:
            # 取消所有活动任务
            for future in list(self.active_futures.keys()):
                future.cancel()

            # 关闭所有执行器
            for executor in self.user_executors.values():
                executor.shutdown(wait=False)

            self.user_executors.clear()
            self.user_semaphores.clear()
            self.active_futures.clear()

        logger.info("✅ 并发管理器已关闭")

    def process_batch_images(
        self,
        user_id: int,
        media_ids: List[int],
        model_name: str,
        analysis_options: Dict[str, Any],
        executor_callback=None
    ) -> Dict[str, Any]:
        """
        批量处理图片（改进版）
        使用稳定的线程池管理和真正的取消机制

        重要说明：
        - 多张图片之间可以并发处理（受max_concurrent控制）
        - 每张图片内部的4个分析项目（标题、描述、分类、标签）强制串行执行，避免API冲突
        """
        from ..models import OllamaImageAnalysis
        from .ollama_client import OllamaImageAnalyzer
        from .prompt_templates import TaskConfig

        max_concurrent = analysis_options.get('max_concurrent', self.default_concurrent)
        logger.info(f"🚀 开始批量处理 {len(media_ids)} 个图片，用户 {user_id} 图片级并发限制: {max_concurrent}")
        logger.info(f"📝 说明：每张图片内部的4个分析项目将串行执行（标题、描述、分类、标签）")
        
        # 记录当前活跃任务信息
        active_info = self.get_active_tasks_info()
        logger.info(f"📊 当前活跃任务信息: {active_info}")

        # 获取所有分析对象（只处理待处理的任务）
        analyses = OllamaImageAnalysis.objects.filter(
            media_id__in=media_ids,
            media__user_id=user_id,
            status__in=['pending', 'processing']  # 只处理未完成的任务
        ).select_related('media', 'model')

        results = {}
        failed_items = []

        # 提交所有图片处理任务
        submitted_futures = []
        try:
            for analysis in analyses:
                try:
                    future = self.submit_task(
                        user_id=user_id,
                        task_func=self._process_single_image_with_cancellation,
                        analysis=analysis,
                        executor_callback=executor_callback,
                        max_concurrent=max_concurrent
                    )
                    submitted_futures.append((future, analysis.media.id))
                except Exception as e:
                    failed_items.append({
                        'media_id': analysis.media.id,
                        'error': f"提交任务失败: {str(e)}"
                    })
                    logger.error(f"❌ 图片 {analysis.media.id} 任务提交失败: {str(e)}")

            logger.info(f"📤 已提交 {len(submitted_futures)} 个图片处理任务")

            # 等待所有任务完成
            timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)
            for future, media_id in submitted_futures:
                try:
                    result = future.result(timeout=timeout)

                    if result['success']:
                        # 修复：使用状态管理器更新状态
                        from .state_manager import state_manager
                        analysis = next(a for a in analyses if a.media.id == media_id)
                        
                        # 准备结果数据
                        result_data = result.get('result', {})
                        
                        # 原子性更新媒体信息
                        media_update_success = state_manager.update_media_with_analysis_result(
                            analysis, result_data
                        )
                        
                        if not media_update_success:
                            logger.warning(f"媒体信息更新失败，但继续完成任务: media_id={media_id}")
                        
                        # 计算处理时间
                        processing_time_ms = result.get('processing_time_ms')
                        
                        # 确保处理时间不为None
                        if processing_time_ms is None:
                            processing_time_ms = 0
                            
                        # 使用状态管理器更新任务状态为完成
                        task_update_success = state_manager.update_analysis_status(
                            analysis_id=analysis.id,
                            from_status='processing',
                            to_status='completed',
                            analysis_results=result_data,
                            processing_time=processing_time_ms
                        )
                        
                        if not task_update_success:
                            # 重新获取分析对象以获取最新状态
                            from ..models import OllamaImageAnalysis
                            updated_analysis = OllamaImageAnalysis.objects.get(id=analysis.id)
                            
                            if updated_analysis.status == 'cancelled':
                                logger.warning(f"任务已被取消，无法标记为完成: media_id={media_id}")
                                results[media_id] = {
                                    'success': False,
                                    'status': 'cancelled',
                                    'error': '任务已被取消',
                                    'processing_time_s': round(processing_time_ms / 1000, 2) if processing_time_ms else None
                                }
                                continue
                            else:
                                logger.warning(f"任务状态更新失败，当前状态: {updated_analysis.status}, media_id={media_id}")
                                results[media_id] = {
                                    'success': False,
                                    'status': updated_analysis.status,
                                    'error': f'状态更新失败，当前状态: {updated_analysis.status}',
                                    'processing_time_s': round(processing_time_ms / 1000, 2) if processing_time_ms else None
                                }
                                continue

                        results[media_id] = {
                            'success': True,
                            'status': 'completed',
                            'processing_time_s': round(processing_time_ms / 1000, 2) if processing_time_ms else None
                        }
                    else:
                        failed_items.append({
                            'media_id': media_id,
                            'error': result.get('error', '未知错误')
                        })
                        # 修复：使用状态管理器标记失败
                        from .state_manager import state_manager
                        analysis = next(a for a in analyses if a.media.id == media_id)
                        
                        # 使用状态管理器更新任务状态为失败
                        task_update_success = state_manager.update_analysis_status(
                            analysis_id=analysis.id,
                            from_status=None,  # 允许从任何状态转换为失败
                            to_status='failed',
                            error_message=result.get('error', '未知错误')
                        )
                        
                        if not task_update_success:
                            # 重新获取分析对象以获取最新状态
                            from ..models import OllamaImageAnalysis
                            updated_analysis = OllamaImageAnalysis.objects.get(id=analysis.id)
                            
                            if updated_analysis.status == 'cancelled':
                                logger.warning(f"任务已被取消，无法标记为失败: media_id={media_id}")
                                failed_items[-1]['error'] = "任务已被取消"
                            else:
                                logger.warning(f"任务状态更新失败，当前状态: {updated_analysis.status}, media_id={media_id}")
                                failed_items[-1]['error'] = f"状态更新失败，当前状态: {updated_analysis.status}"

                except Exception as e:
                    failed_items.append({
                        'media_id': media_id,
                        'error': f"图片处理异常: {str(e)}"
                    })
                    # 修复：使用状态管理器标记失败
                    try:
                        from .state_manager import state_manager
                        analysis = next(a for a in analyses if a.media.id == media_id)
                        
                        # 使用状态管理器更新任务状态为失败
                        state_manager.update_analysis_status(
                            analysis_id=analysis.id,
                            from_status=None,  # 允许从任何状态转换为失败
                            to_status='failed',
                            error_message=str(e)
                        )
                    except:
                        pass

            logger.info(f"📊 批量处理完成: 成功 {len(results)} 个，失败 {len(failed_items)} 个")

        except Exception as e:
            logger.error(f"❌ 批量处理出现系统错误: {str(e)}")
            # 尝试取消已提交的任务
            for future, _ in submitted_futures:
                if not future.done():
                    future.cancel()

        return {
            'success_count': len(results),
            'error_count': len(failed_items),
            'results': results,
            'failed_items': failed_items,
            'total_processing_time_ms': 0  # 这里可以计算总处理时间
        }

    def _process_single_image_with_cancellation(self, analysis, executor_callback=None) -> Dict[str, Any]:
        """
        处理单张图片的所有分析任务（支持取消）
        使用可取消任务框架
        """
        from .prompt_templates import TaskConfig
        from .ollama_client import OllamaImageAnalyzer
        from .task_cancellation import TaskCancelledException

        start_time = time.time()

        # 创建可取消任务
        cancellable_task = cancellation_manager.create_task(
            f"batch_image_{analysis.media.id}_{int(time.time())}",
            analysis.media.user.id
        )

        try:
            cancellable_task.start()

            # 关键修复：在开始处理前检查任务是否已被取消
            if analysis.status == 'cancelled':
                logger.info(f"🚫 任务已被取消，跳过处理: analysis_id={analysis.id}")
                return {
                    'success': False,
                    'result': {},
                    'failed_tasks': ["任务已被取消"],
                    'total_tasks': 0,
                    'completed_tasks': 0,
                    'processing_time_ms': int((time.time() - start_time) * 1000),
                    'cancelled': True
                }

            # 关键修复：使用状态管理器安全地标记任务为处理中状态
            from .state_manager import state_manager
            status_update_success = state_manager.update_analysis_status(
                analysis_id=analysis.id,
                from_status='pending',
                to_status='processing'
            )
            
            if not status_update_success:
                # 如果状态更新失败，说明任务可能已被取消或状态不匹配
                # 重新获取最新状态
                from ..models import OllamaImageAnalysis
                updated_analysis = OllamaImageAnalysis.objects.get(id=analysis.id)
                
                if updated_analysis.status == 'cancelled':
                    logger.info(f"🚫 任务已被取消，停止处理: analysis_id={analysis.id}")
                    return {
                        'success': False,
                        'result': {},
                        'failed_tasks': ["任务已被取消"],
                        'total_tasks': 0,
                        'completed_tasks': 0,
                        'processing_time_ms': int((time.time() - start_time) * 1000),
                        'cancelled': True
                    }
                else:
                    logger.warning(f"⚠️ 任务状态更新失败，当前状态: {updated_analysis.status}, analysis_id={analysis.id}")
                    return {
                        'success': False,
                        'result': {},
                        'failed_tasks': [f"任务状态更新失败，当前状态: {updated_analysis.status}"],
                        'total_tasks': 0,
                        'completed_tasks': 0,
                        'processing_time_ms': int((time.time() - start_time) * 1000)
                    }
            
            logger.info(f"🚀 开始处理图片 {analysis.media.id}，状态成功更新为 processing")

            # 检查取消状态
            cancellable_task.check_cancelled()

            # 修复：使用真正的Ollama分析器而不是手动执行任务
            analyzer = OllamaImageAnalyzer()
            
            # 执行真正的图片分析（支持取消）
            result = analyzer.analyze_with_cancellation(analysis, cancellable_task)
            
            # 检查取消状态
            cancellable_task.check_cancelled()

            if not result['success']:
                error_msg = result.get('error', '分析失败')
                logger.error(f"❌ Ollama分析失败: {error_msg}")
                # 修复：使用状态管理器标记失败
                from .state_manager import state_manager
                state_manager.update_analysis_status(
                    analysis_id=analysis.id,
                    from_status='processing',
                    to_status='failed',
                    error_message=error_msg
                )
                return {
                    'success': False,
                    'result': {},
                    'failed_tasks': [error_msg],
                    'total_tasks': 0,
                    'completed_tasks': 0,
                    'processing_time_ms': int((time.time() - start_time) * 1000)
                }

            # 获取分析结果
            results = result.get('result', {})
            failed_tasks = result.get('failed_tasks', [])
            
            # 修复：确保failed_tasks不为None
            if failed_tasks is None:
                failed_tasks = []

            # 最终检查取消状态
            cancellable_task.check_cancelled()

            processing_time = time.time() - start_time
            logger.debug(f"图片 {analysis.media.id} 处理完成，总耗时: {processing_time:.2f}s")

            # 设置任务结果
            cancellable_task.set_result(results)

            return {
                'success': len(results) > 0,
                'result': results,
                'failed_tasks': failed_tasks,
                'total_tasks': len(results) + len(failed_tasks),
                'completed_tasks': len(results),
                'processing_time_ms': int(processing_time * 1000)
            }

        except TaskCancelledException:
            logger.info(f"🚫 图片 {analysis.media.id} 处理被取消")
            # 修复：使用状态管理器标记取消
            from .state_manager import state_manager
            state_manager.update_analysis_status(
                analysis_id=analysis.id,
                from_status=None,  # 允许从任何状态转换为取消
                to_status='cancelled',
                error_message="任务已被取消"
            )
            return {
                'success': False,
                'result': {},
                'failed_tasks': ["任务已被取消"],
                'total_tasks': 0,
                'completed_tasks': 0,
                'processing_time_ms': int((time.time() - start_time) * 1000),
                'cancelled': True
            }
        except Exception as e:
            logger.error(f"❌ 图片 {analysis.media.id} 处理异常: {str(e)}")
            # 修复：使用状态管理器标记失败
            try:
                from .state_manager import state_manager
                state_manager.update_analysis_status(
                    analysis_id=analysis.id,
                    from_status=None,  # 允许从任何状态转换为失败
                    to_status='failed',
                    error_message=str(e)
                )
            except:
                pass

            return {
                'success': False,
                'result': {},
                'failed_tasks': [f"处理异常: {str(e)}"],
                'total_tasks': 0,
                'completed_tasks': 0,
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }
        finally:
            # 清理任务
            cancellation_manager.remove_task(cancellable_task.task_id)

    def __del__(self):
        """析构函数"""
        try:
            self.shutdown()
        except:
            pass


# 全局并发管理器实例
concurrency_manager = ConcurrencyManager()