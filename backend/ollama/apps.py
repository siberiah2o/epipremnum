from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class OllamaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ollama'

    def ready(self):
        """应用启动时初始化"""
        # 避免在迁移时运行
        import sys
        if 'migrate' in sys.argv or 'makemigrations' in sys.argv:
            return

        try:
            # 导入后台任务确保它们被注册
            from . import tasks  # noqa: F401

            # 初始化数据库连接优化
            from utils.db_utils import optimize_sqlite_connection
            optimize_sqlite_connection()
            logger.info("✅ Ollama应用启动，数据库连接已优化")

            # 初始化连接池
            from utils.connection_pool import connection_pool_manager
            logger.info("✅ 数据库连接池管理器已初始化")

        except Exception as e:
            logger.warning(f"⚠️ Ollama应用启动初始化失败: {str(e)}")
