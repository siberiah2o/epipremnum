"""
可取消任务框架
支持真正的任务中断和状态管理
"""

import threading
import logging
from typing import Any, Optional, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskCancelledException(Exception):
    """任务被取消异常"""
    pass


class CancellableTask:
    """可取消任务基类"""

    def __init__(self, task_id: str, user_id: int):
        self.task_id = task_id
        self.user_id = user_id
        self.status = TaskStatus.PENDING
        self._cancel_event = threading.Event()
        self._pause_event = threading.Event()
        self._result = None
        self._error = None
        self._lock = threading.RLock()
        self._cleanup_callbacks = []

        # 设置初始状态
        self._pause_event.set()  # 默认不暂停

    def start(self) -> None:
        """启动任务"""
        with self._lock:
            if self.status != TaskStatus.PENDING:
                raise ValueError(f"任务状态错误: {self.status}")
            self.status = TaskStatus.RUNNING

        logger.info(f"🚀 任务 {self.task_id} 开始执行")

    def cancel(self) -> bool:
        """取消任务"""
        with self._lock:
            if self.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.FAILED]:
                logger.warning(f"⚠️ 任务 {self.task_id} 已完成，无法取消: {self.status}")
                return False

            if self.status == TaskStatus.CANCELLING:
                logger.info(f"🔄 任务 {self.task_id} 正在取消中")
                return True

            self.status = TaskStatus.CANCELLED  # 直接设置为已取消状态
            self._cancel_event.set()

        logger.info(f"🚫 任务 {self.task_id} 已被取消")
        return True

    def pause(self) -> bool:
        """暂停任务"""
        with self._lock:
            if self.status != TaskStatus.RUNNING:
                return False
            self._pause_event.clear()
        return True

    def resume(self) -> bool:
        """恢复任务"""
        with self._lock:
            if self.status != TaskStatus.RUNNING:
                return False
            self._pause_event.set()
        return True

    def is_cancelled(self) -> bool:
        """检查任务是否被取消"""
        return self._cancel_event.is_set()

    def is_paused(self) -> bool:
        """检查任务是否被暂停"""
        return not self._pause_event.is_set()

    def check_cancelled(self) -> None:
        """检查取消状态，如果被取消则抛出异常"""
        if self.is_cancelled():
            self.status = TaskStatus.CANCELLED
            raise TaskCancelledException(f"任务 {self.task_id} 已被取消")

    def check_paused(self) -> None:
        """检查暂停状态，如果被暂停则阻塞"""
        if self.is_paused():
            logger.info(f"⏸️ 任务 {self.task_id} 已暂停")
            self._pause_event.wait()
            logger.info(f"▶️ 任务 {self.task_id} 已恢复")

    def add_cleanup_callback(self, callback: Callable[[], None]) -> None:
        """添加清理回调函数"""
        self._cleanup_callbacks.append(callback)

    def _cleanup(self) -> None:
        """执行清理操作"""
        logger.debug(f"🧹 清理任务 {self.task_id}")
        for callback in self._cleanup_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"清理回调执行失败: {str(e)}")

    def set_result(self, result: Any) -> None:
        """设置任务结果"""
        with self._lock:
            if self.status == TaskStatus.RUNNING:
                self._result = result
                self.status = TaskStatus.COMPLETED
                logger.info(f"✅ 任务 {self.task_id} 执行完成")

    def set_error(self, error: Exception) -> None:
        """设置任务错误"""
        with self._lock:
            if self.status == TaskStatus.RUNNING:
                self._error = error
                self.status = TaskStatus.FAILED
                logger.error(f"❌ 任务 {self.task_id} 执行失败: {str(error)}")

    def get_status(self) -> TaskStatus:
        """获取任务状态"""
        with self._lock:
            return self.status

    def get_result(self) -> Optional[Any]:
        """获取任务结果"""
        with self._lock:
            return self._result

    def get_error(self) -> Optional[Exception]:
        """获取任务错误"""
        with self._lock:
            return self._error

    def execute_with_cancellation_check(self, func: Callable, *args, **kwargs) -> Any:
        """执行函数并支持取消检查"""
        try:
            self.check_cancelled()
            self.check_paused()

            # 执行实际函数
            if callable(func):
                return func(*args, **kwargs)
            else:
                raise ValueError("参数不是可调用对象")

        except TaskCancelledException:
            self._cleanup()
            raise
        except Exception as e:
            self.set_error(e)
            self._cleanup()
            raise


class CancellableTaskManager:
    """可取消任务管理器"""

    def __init__(self):
        self.tasks: dict[str, CancellableTask] = {}
        self._lock = threading.RLock()

    def create_task(self, task_id: str, user_id: int) -> CancellableTask:
        """创建可取消任务"""
        with self._lock:
            if task_id in self.tasks:
                logger.warning(f"⚠️ 任务 {task_id} 已存在")
                return self.tasks[task_id]

            task = CancellableTask(task_id, user_id)
            self.tasks[task_id] = task
            logger.info(f"📝 创建可取消任务: {task_id}")
            return task

    def get_task(self, task_id: str) -> Optional[CancellableTask]:
        """获取任务"""
        with self._lock:
            return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                return task.cancel()
            return False

    def cancel_user_tasks(self, user_id: int) -> int:
        """取消用户所有任务"""
        cancelled_count = 0
        with self._lock:
            for task_id, task in list(self.tasks.items()):
                if task.user_id == user_id and task.cancel():
                    cancelled_count += 1

        logger.info(f"🚫 用户 {user_id} 的 {cancelled_count} 个任务已取消")
        return cancelled_count

    def remove_task(self, task_id: str) -> None:
        """移除任务"""
        with self._lock:
            if task_id in self.tasks:
                task = self.tasks[task_id]
                task._cleanup()  # 执行清理
                del self.tasks[task_id]
                logger.debug(f"🗑️ 移除任务: {task_id}")

    def get_user_task_count(self, user_id: int) -> dict:
        """获取用户任务数量统计"""
        count = {
            'pending': 0,
            'running': 0,
            'cancelled': 0,
            'completed': 0,
            'failed': 0
        }

        with self._lock:
            for task in self.tasks.values():
                if task.user_id == user_id:
                    status = task.get_status().value
                    if status in count:
                        count[status] += 1

        return count

    def cleanup_completed_tasks(self) -> int:
        """清理已完成的任务"""
        cleaned_count = 0
        with self._lock:
            tasks_to_remove = []
            for task_id, task in self.tasks.items():
                status = task.get_status()
                if status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.FAILED]:
                    tasks_to_remove.append(task_id)

            for task_id in tasks_to_remove:
                self.remove_task(task_id)
                cleaned_count += 1

        if cleaned_count > 0:
            logger.info(f"🧹 清理了 {cleaned_count} 个已完成的任务")

        return cleaned_count


# 全局任务管理器实例
task_manager = CancellableTaskManager()