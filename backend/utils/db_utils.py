import time
import random
from contextlib import contextmanager
from django.db import connections, transaction
from django.db.utils import OperationalError
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

@contextmanager
def sqlite_write_tx(db_alias='default', max_retries=8, base_delay=0.002):
    """
    SQLite 写事务上下文管理器，支持自动重试和短事务

    Args:
        db_alias: 数据库别名
        max_retries: 最大重试次数
        base_delay: 基础延迟时间（秒）
    """
    retries = 0
    last_exception = None
    start_time = time.time()

    while retries < max_retries:
        try:
            conn = connections[db_alias]
            with transaction.atomic():
                yield conn
            return

        except OperationalError as e:
            current_time = time.time()
            if current_time - start_time > 10:  # 总超时10秒
                logger.error(f"SQLite transaction timeout after {current_time - start_time:.2f}s")
                raise

            if "database is locked" in str(e).lower():
                last_exception = e
                retries += 1

                if retries < max_retries:
                    delay = base_delay * (2 ** (retries - 1))
                    jitter = random.uniform(0.001, 0.003)
                    total_delay = delay + jitter
                    logger.warning(f"SQLite locked, retry {retries}/{max_retries} after {total_delay:.3f}s")
                    time.sleep(total_delay)
                else:
                    logger.error(f"SQLite locked after {max_retries} retries, total time: {time.time() - start_time:.2f}s")
                    raise
            else:
                logger.error(f"SQLite operational error: {e}")
                raise
        except Exception as e:
            logger.error(f"Database transaction failed: {e}")
            raise

    if last_exception:
        raise last_exception


def optimize_sqlite_connection(db_alias='default'):
    """优化 SQLite 连接设置"""
    conn = connections[db_alias]

    optimizations = [
        "PRAGMA journal_mode=WAL",           # WAL模式提高并发性能
        "PRAGMA synchronous=NORMAL",         # 平衡性能和数据安全
        "PRAGMA cache_size=-64000",          # 64MB缓存
        "PRAGMA temp_store=memory",          # 临时表存储在内存
        "PRAGMA busy_timeout=30000",         # 增加忙等待超时到30秒
        "PRAGMA wal_autocheckpoint=500",     # 减少自动检查点频率
        "PRAGMA mmap_size=134217728",        # 增加内存映射大小到128MB
        "PRAGMA foreign_keys=ON",            # 启用外键约束
        "PRAGMA locking_mode=NORMAL",        # 使用正常锁定模式，允许并发访问
        "PRAGMA auto_vacuum=INCREMENTAL",    # 增量自动清理
    ]

    with conn.cursor() as cursor:
        for pragma in optimizations:
            try:
                cursor.execute(pragma)
                result = cursor.fetchone()
                if result:
                    logger.debug(f"✅ [DB-OPT] {pragma} = {result[0]}")
                else:
                    logger.debug(f"✅ [DB-OPT] {pragma} 设置成功")
            except Exception as e:
                logger.warning(f"⚠️ [DB-OPT] Failed to set {pragma}: {e}")

    # WAL文件检查
    try:
        with conn.cursor() as cursor:
            cursor.execute("PRAGMA wal_checkpoint(PASSIVE)")
            result = cursor.fetchone()
            if result:
                log_size, checkpointed, not_checkpointed = result
                logger.info(f"📊 [DB-OPT] WAL状态 - 日志大小:{log_size}, 已检查点:{checkpointed}, 未检查点:{not_checkpointed}")

                if log_size > 1000000:  # 1MB阈值
                    cursor.execute("PRAGMA wal_checkpoint(FULL)")
                    logger.info(f"💾 [DB-OPT] 执行WAL完整检查点")
    except Exception as e:
        logger.warning(f"⚠️ [DB-OPT] WAL检查失败: {e}")


def cleanup_database():
    """清理数据库"""
    try:
        conn = connections['default']
        with conn.cursor() as cursor:
            cursor.execute("PRAGMA incremental_vacuum")
            cursor.execute("PRAGMA shrink_memory")
            logger.info("🧹 [DB-CLEAN] 数据库清理完成")
    except Exception as e:
        logger.error(f"❌ [DB-CLEAN] 数据库清理失败: {e}")


def check_database_health():
    """检查数据库健康状态"""
    try:
        conn = connections['default']
        with conn.cursor() as cursor:
            # 基本连接测试
            cursor.execute("SELECT 1")

            # 检查WAL状态
            cursor.execute("PRAGMA journal_mode")
            journal_mode = cursor.fetchone()[0]

            # 返回健康状态
            is_healthy = journal_mode == 'wal'
            if not is_healthy:
                logger.warning(f"⚠️ [HEALTH] 数据库不在WAL模式: {journal_mode}")

            return is_healthy
    except Exception as e:
        logger.error(f"❌ [HEALTH] 数据库健康检查失败: {e}")
        return False


class SimpleHealthMonitor:
    """简化的健康监控器"""

    def __init__(self):
        self._last_check = 0
        self._cached_score = 100
        self._issues = []

    def get_health_report(self):
        """获取健康报告"""
        current_time = time.time()

        # 缓存30秒
        if current_time - self._last_check > 30:
            self._update_health_check()
            self._last_check = current_time

        return {
            'health_score': self._cached_score,
            'issues': self._issues.copy(),
            'timestamp': self._last_check
        }

    def _update_health_check(self):
        """更新健康检查"""
        try:
            if check_database_health():
                self._cached_score = 100
                self._issues = []
            else:
                self._cached_score = 60
                self._issues = ["数据库健康检查失败"]
        except Exception as e:
            self._cached_score = 50
            self._issues = [f"健康检查异常: {str(e)}"]


# 全局健康监控实例
health_monitor = SimpleHealthMonitor()


def get_comprehensive_db_stats():
    """获取数据库统计信息"""
    try:
        conn = connections['default']
        with conn.cursor() as cursor:
            # 获取基本统计
            cursor.execute("PRAGMA page_count")
            page_count = cursor.fetchone()[0]

            cursor.execute("PRAGMA freelist_count")
            freelist_count = cursor.fetchone()[0]

            return {
                'connection_stats': {
                    'page_count': page_count,
                    'freelist_count': freelist_count,
                },
                'pool_stats': {},
                'bulk_writer_stats': {}
            }
    except Exception as e:
        logger.error(f"获取数据库统计失败: {e}")
        return {
            'connection_stats': {},
            'pool_stats': {},
            'bulk_writer_stats': {}
        }