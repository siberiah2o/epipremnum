"""
请求队列管理器
控制并发请求数量，避免数据库锁竞争
"""

import threading
import time
import logging
from typing import Callable, Any

logger = logging.getLogger(__name__)


class RequestQueueManager:
    """请求队列管理器"""

    def __init__(self, max_concurrent=5):
        self.max_concurrent = max_concurrent
        self._lock = threading.RLock()
        self._active_requests = 0
        self._waiting_requests = 0
        self._condition = threading.Condition(self._lock)

    def execute_with_throttle(self, func: Callable, *args, **kwargs) -> Any:
        """
        带限流的执行函数
        如果当前活跃请求超过限制，等待直到有空闲位置
        """
        with self._lock:
            self._waiting_requests += 1
            logger.debug(f"📥 请求进入队列: 等待中 {self._waiting_requests}, 活跃中 {self._active_requests}")

        try:
            # 等待直到有空闲位置
            with self._condition:
                while self._active_requests >= self.max_concurrent:
                    logger.debug(f"⏳ 请求等待中: 活跃 {self._active_requests}/{self.max_concurrent}")
                    self._condition.wait(timeout=0.1)

                # 获取执行权限
                with self._lock:
                    self._waiting_requests -= 1
                    self._active_requests += 1
                    logger.debug(f"🚀 请求开始执行: 活跃 {self._active_requests}/{self.max_concurrent}")

            # 执行函数
            try:
                return func(*args, **kwargs)
            finally:
                # 释放执行权限
                with self._lock:
                    self._active_requests -= 1
                    logger.debug(f"✅ 请求执行完成: 活跃 {self._active_requests}/{self.max_concurrent}")

                # 通知等待的请求
                with self._condition:
                    self._condition.notify_all()

        except Exception as e:
            # 确保在异常情况下也释放资源
            with self._lock:
                self._active_requests = max(0, self._active_requests - 1)
                logger.debug(f"❌ 请求执行异常: 活跃 {self._active_requests}/{self.max_concurrent}")

            with self._condition:
                self._condition.notify_all()
            raise

    def get_stats(self) -> dict:
        """获取队列统计信息"""
        with self._lock:
            return {
                'max_concurrent': self.max_concurrent,
                'active_requests': self._active_requests,
                'waiting_requests': self._waiting_requests,
                'utilization': self._active_requests / self.max_concurrent if self.max_concurrent > 0 else 0
            }


# 全局请求队列管理器实例
# 针对数据库写操作进行限流
db_write_queue = RequestQueueManager(max_concurrent=3)


def throttle_db_write(func: Callable):
    """数据库写操作限流装饰器"""
    def wrapper(*args, **kwargs):
        return db_write_queue.execute_with_throttle(func, *args, **kwargs)
    return wrapper


# 针对批量操作的特殊队列
batch_queue = RequestQueueManager(max_concurrent=2)


def throttle_batch_operation(func: Callable):
    """批量操作限流装饰器"""
    def wrapper(*args, **kwargs):
        return batch_queue.execute_with_throttle(func, *args, **kwargs)
    return wrapper