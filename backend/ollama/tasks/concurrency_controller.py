"""
并发分析控制器
控制图片分析任务的并发执行
"""

import threading
import time
import logging
from typing import Dict, Any, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class ConcurrencyController:
    """并发分析控制器"""

    def __init__(self):
        self.global_semaphore = None
        self.user_semaphores = {}  # 用户级别的并发控制
        self.active_threads = {}   # 跟踪活跃的线程
        self._lock = threading.Lock()

    def get_semaphore(self, user_id: int, analysis_options: Dict[str, Any]) -> threading.Semaphore:
        """获取对应的信号量"""
        # 获取用户设置的并发数
        max_concurrent = analysis_options.get('max_concurrent', self.get_default_concurrency())

        # 全局并发限制
        global_max = getattr(settings, 'OLLAMA_GLOBAL_MAX_CONCURRENT', 10)
        max_concurrent = min(max_concurrent, global_max)

        with self._lock:
            # 为每个用户创建独立的信号量
            if user_id not in self.user_semaphores:
                self.user_semaphores[user_id] = threading.Semaphore(max_concurrent)

            return self.user_semaphores[user_id]

    def get_default_concurrency(self) -> int:
        """获取默认并发数"""
        return getattr(settings, 'OLLAMA_DEFAULT_CONCURRENT', 3)

    def execute_tasks_concurrently(
        self,
        tasks: List[Tuple[str, str]],
        analysis,
        executor_callback
    ) -> Dict[str, Any]:
        """并发执行分析任务"""
        user_id = analysis.user.id if hasattr(analysis, 'user') else None
        options = analysis.analysis_options

        # 获取并发控制信号量
        semaphore = self.get_semaphore(user_id, options)

        results = {}
        failed_tasks = []

        # 确定实际并发数
        max_workers = min(len(tasks), options.get('max_concurrent', self.get_default_concurrency()))

        logger.info(f"开始并发执行 {len(tasks)} 个任务，最大并发数: {max_workers}")

        def execute_single_task(task_info):
            """执行单个任务的包装函数"""
            task_name, task_prompt = task_info
            thread_id = threading.get_ident()

            # 获取信号量许可
            semaphore.acquire()

            try:
                # 记录活跃线程
                with self._lock:
                    self.active_threads[thread_id] = {
                        'task_name': task_name,
                        'user_id': user_id,
                        'start_time': time.time()
                    }

                logger.info(f"开始执行任务 {task_name} (线程: {thread_id})")
                start_time = time.time()

                # 执行实际的任务
                data = executor_callback(analysis, task_prompt)
                api_result = self._call_api_with_timeout(analysis.model.endpoint.url, analysis.model.name, data)

                if api_result['success']:
                    # 处理结果（这里需要传入处理器）
                    from .analyzer import OllamaImageAnalyzer
                    analyzer = OllamaImageAnalyzer()
                    task_result = analyzer._process_single_result(api_result['response'], task_name)

                    processing_time = time.time() - start_time
                    logger.info(f"任务 {task_name} 完成，耗时: {processing_time:.2f}s")

                    return task_name, task_result, None
                else:
                    error_msg = api_result['error']
                    logger.error(f"任务 {task_name} 失败: {error_msg}")
                    return task_name, None, error_msg

            except Exception as e:
                error_msg = f"任务 {task_name} 异常: {str(e)}"
                logger.error(error_msg)
                return task_name, None, error_msg
            finally:
                # 释放信号量并清理线程记录
                semaphore.release()
                with self._lock:
                    if thread_id in self.active_threads:
                        del self.active_threads[thread_id]

        # 使用线程池执行任务
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            future_to_task = {
                executor.submit(execute_single_task, task): task
                for task in tasks
            }

            # 收集结果
            for future in as_completed(future_to_task):
                task_name, task_result, error = future.result()

                if task_result is not None:
                    results[task_name] = task_result
                else:
                    failed_tasks.append(f"{task_name}: {error}")

        return {
            'results': results,
            'failed_tasks': failed_tasks,
            'total_tasks': len(tasks),
            'completed_tasks': len(results)
        }

    def _call_api_with_timeout(self, endpoint_url: str, model_name: str, data: Dict) -> Dict:
        """调用API（带超时控制）"""
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
            response = requests.post(
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
            return {'success': False, 'error': f"API调用异常: {str(e)}"}

    def get_active_tasks_info(self) -> Dict[str, Any]:
        """获取当前活跃任务信息"""
        with self._lock:
            return {
                'active_threads': len(self.active_threads),
                'thread_details': dict(self.active_threads),
                'user_semaphores': {
                    user_id: semaphore._value
                    for user_id, semaphore in self.user_semaphores.items()
                }
            }

    def cleanup_user_resources(self, user_id: int):
        """清理用户资源"""
        with self._lock:
            if user_id in self.user_semaphores:
                del self.user_semaphores[user_id]

            # 清理该用户的活跃线程
            threads_to_remove = [
                thread_id for thread_id, info in self.active_threads.items()
                if info.get('user_id') == user_id
            ]
            for thread_id in threads_to_remove:
                del self.active_threads[thread_id]

        logger.info(f"已清理用户 {user_id} 的并发控制资源")


# 全局并发控制器实例
concurrency_controller = ConcurrencyController()