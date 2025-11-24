"""
数据库连接管理器
处理SQLite连接优化
"""

import logging
from django.db import connection

logger = logging.getLogger(__name__)

def get_database_connection():
    """获取数据库连接（简化版本）"""
    return connection

def optimize_database_connection():
    """优化数据库连接设置"""
    try:
        with connection.cursor() as cursor:
            optimizations = [
                "PRAGMA busy_timeout=30000",     # 30秒超时
                "PRAGMA journal_mode=WAL",        # WAL模式
                "PRAGMA synchronous=NORMAL",      # 平衡性能和安全
                "PRAGMA cache_size=-64000",       # 64MB缓存
                "PRAGMA temp_store=memory",       # 临时表存储在内存
                "PRAGMA wal_autocheckpoint=500",  # 检查点频率
                "PRAGMA locking_mode=NORMAL",     # 普通锁定模式
            ]

            for pragma in optimizations:
                try:
                    cursor.execute(pragma)
                    result = cursor.fetchone()
                    if result:
                        logger.debug(f"✅ [DB-OPT] {pragma} = {result[0]}")
                except Exception as e:
                    logger.warning(f"⚠️ [DB-OPT] 优化失败 {pragma}: {str(e)}")

            logger.debug("🔧 [DB-OPT] 数据库连接优化完成")
            return True

    except Exception as e:
        logger.error(f"❌ [DB-OPT] 数据库优化失败: {str(e)}")
        return False