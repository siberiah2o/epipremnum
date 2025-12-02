"""
数据库连接池管理
优化SQLite连接重用，减少连接创建开销
"""

import threading
import time
import logging
from contextlib import contextmanager
from django.db import connections

logger = logging.getLogger(__name__)


class ConnectionPoolManager:
    """数据库连接池管理器"""

    def __init__(self):
        self._lock = threading.RLock()
        self._connection_pool = {}
        self._last_used = {}
        self.max_idle_time = 300  # 5分钟空闲超时
        self.cleanup_interval = 60  # 60秒清理一次

    def get_connection(self, db_alias='default'):
        """获取数据库连接（优先使用连接池）"""
        with self._lock:
            current_time = time.time()

            # 清理过期连接
            self._cleanup_expired_connections(current_time)

            # 尝试从连接池获取
            if db_alias in self._connection_pool:
                conn = self._connection_pool.pop(db_alias)
                self._last_used.pop(db_alias, None)

                # 检查连接是否仍然有效
                try:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT 1")
                    logger.debug(f"🔗 [POOL] 重用数据库连接: {db_alias}")
                    return conn
                except Exception as e:
                    logger.warning(f"⚠️ [POOL] 连接无效，创建新连接: {db_alias}, error={str(e)}")
                    # 连接无效，继续创建新连接

            # 创建新连接
            conn = connections[db_alias]
            logger.debug(f"🔗 [POOL] 创建新数据库连接: {db_alias}")
            return conn

    def release_connection(self, conn, db_alias='default'):
        """释放数据库连接到连接池"""
        with self._lock:
            try:
                # 检查连接是否仍然有效
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1")

                # 放回连接池
                self._connection_pool[db_alias] = conn
                self._last_used[db_alias] = time.time()
                logger.debug(f"🔗 [POOL] 释放数据库连接到连接池: {db_alias}")

            except Exception as e:
                logger.warning(f"⚠️ [POOL] 连接无效，直接关闭: {db_alias}, error={str(e)}")
                try:
                    conn.close()
                except:
                    pass

    def _cleanup_expired_connections(self, current_time):
        """清理过期的连接"""
        expired_aliases = []

        for db_alias, last_used in self._last_used.items():
            if current_time - last_used > self.max_idle_time:
                expired_aliases.append(db_alias)

        for db_alias in expired_aliases:
            if db_alias in self._connection_pool:
                try:
                    conn = self._connection_pool.pop(db_alias)
                    conn.close()
                    logger.debug(f"🧹 [POOL] 清理过期数据库连接: {db_alias}")
                except Exception as e:
                    logger.warning(f"⚠️ [POOL] 清理连接失败: {db_alias}, error={str(e)}")

            self._last_used.pop(db_alias, None)

    def close_all_connections(self):
        """关闭所有连接"""
        with self._lock:
            for db_alias, conn in self._connection_pool.items():
                try:
                    conn.close()
                    logger.debug(f"🔒 [POOL] 关闭数据库连接: {db_alias}")
                except Exception as e:
                    logger.warning(f"⚠️ [POOL] 关闭连接失败: {db_alias}, error={str(e)}")

            self._connection_pool.clear()
            self._last_used.clear()


# 全局连接池管理器实例
connection_pool_manager = ConnectionPoolManager()


@contextmanager
def managed_connection(db_alias='default'):
    """
    管理数据库连接的上下文管理器
    自动从连接池获取和释放连接
    """
    conn = None
    try:
        conn = connection_pool_manager.get_connection(db_alias)
        yield conn
    finally:
        if conn:
            connection_pool_manager.release_connection(conn, db_alias)


def optimize_connection_settings(conn):
    """优化连接设置"""
    try:
        with conn.cursor() as cursor:
            # 设置优化的SQLite参数
            optimizations = [
                "PRAGMA journal_mode=WAL",
                "PRAGMA synchronous=NORMAL",
                "PRAGMA cache_size=-256000",
                "PRAGMA temp_store=memory",
                "PRAGMA busy_timeout=30000",
                "PRAGMA wal_autocheckpoint=200",
                "PRAGMA mmap_size=536870912",
                "PRAGMA locking_mode=NORMAL",
                "PRAGMA auto_vacuum=INCREMENTAL",
                "PRAGMA journal_size_limit=134217728",
                "PRAGMA wal_checkpoint_mode=RESTART",
                "PRAGMA page_size=4096",
                "PRAGMA foreign_keys=ON",
            ]

            for pragma in optimizations:
                try:
                    cursor.execute(pragma)
                except Exception as e:
                    logger.debug(f"⚠️ [CONN-OPT] Failed to set {pragma}: {e}")

        logger.debug("✅ [CONN-OPT] 数据库连接优化完成")

    except Exception as e:
        logger.warning(f"⚠️ [CONN-OPT] 连接优化失败: {str(e)}")


# 已从文件开头导入