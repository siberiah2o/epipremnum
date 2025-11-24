"""
数据库优化中间件
为每个请求优化数据库连接和监控数据库健康状态
"""
import logging
import time
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache
from .db_utils import optimize_sqlite_connection, health_monitor

logger = logging.getLogger(__name__)


class DatabaseOptimizationMiddleware(MiddlewareMixin):
    """
    数据库优化中间件
    在每个请求开始时优化数据库连接
    """

    def process_request(self, request):
        """处理请求前优化数据库连接"""
        try:
            from django.db import connection
            if connection.vendor == 'sqlite':
                # 检查是否需要优化（避免频繁优化）
                last_optimize = cache.get('db_last_optimize')
                current_time = time.time()

                if not last_optimize or (current_time - last_optimize) > 60:  # 60秒优化一次
                    optimize_sqlite_connection()
                    cache.set('db_last_optimize', current_time, 300)  # 5分钟过期
                    logger.debug("🔧 [MIDDLEWARE] 请求开始时优化数据库连接")

        except Exception as e:
            logger.warning(f"⚠️ [MIDDLEWARE] 数据库优化失败: {str(e)}")

    def process_response(self, request, response):
        """处理响应后进行数据库维护"""
        try:
            from django.db import connection
            if connection.vendor == 'sqlite' and connection.connection:
                # 检查WAL文件大小，必要时执行检查点
                with connection.cursor() as cursor:
                    cursor.execute("PRAGMA wal_checkpoint(PASSIVE)")
                    result = cursor.fetchone()
                    logger.debug(f"🔧 [MIDDLEWARE] WAL检查点完成: {result}")

                    # 如果WAL文件过大，执行完整检查点
                    if result and result[0] > 5000000:  # 5MB
                        cursor.execute("PRAGMA wal_checkpoint(FULL)")
                        logger.info(f"💾 [MIDDLEWARE] 执行WAL完整检查点: {result}")

        except Exception as e:
            logger.warning(f"⚠️ [MIDDLEWARE] WAL检查点失败: {str(e)}")

        return response


class DatabaseHealthMiddleware(MiddlewareMixin):
    """
    数据库健康监控中间件
    定期检查数据库健康状态并在问题时发出警告
    """

    def process_request(self, request):
        """检查数据库健康状态"""
        try:
            # 每100个请求检查一次健康状态
            request_count = cache.get('health_check_count', 0)
            request_count += 1
            cache.set('health_check_count', request_count, 3600)  # 1小时过期

            if request_count % 100 == 0:
                health_report = health_monitor.get_health_report()
                health_score = health_report.get('health_score', 100)

                if health_score < 70:
                    logger.error(f"🚨 [MIDDLEWARE] 数据库健康分数过低: {health_score}/100")
                    logger.error(f"🚨 [MIDDLEWARE] 健康问题: {health_report.get('issues', [])}")
                elif health_score < 85:
                    logger.warning(f"⚠️ [MIDDLEWARE] 数据库健康分数偏低: {health_score}/100")

                # 如果有严重问题，尝试自动修复
                if health_score < 60:
                    logger.info("🔧 [MIDDLEWARE] 尝试自动修复数据库问题...")
                    from .db_utils import optimize_sqlite_connection, cleanup_database
                    try:
                        optimize_sqlite_connection()
                        cleanup_database()
                        logger.info("🔧 [MIDDLEWARE] 自动修复完成")
                    except Exception as e:
                        logger.error(f"❌ [MIDDLEWARE] 自动修复失败: {e}")

        except Exception as e:
            logger.warning(f"⚠️ [MIDDLEWARE] 健康检查失败: {str(e)}")

    def process_response(self, request, response):
        """响应处理完成后的清理"""
        return response