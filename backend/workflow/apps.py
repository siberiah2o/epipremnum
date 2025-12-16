from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class WorkflowConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'workflow'

    def ready(self):
        """应用启动时初始化"""
        # 避免在迁移时运行
        import sys
        if 'migrate' in sys.argv or 'makemigrations' in sys.argv:
            return

        try:
            # 初始化工作流相关组件
            logger.info("✅ Workflow应用启动成功")
        except Exception as e:
            logger.warning(f"⚠️ Workflow应用启动初始化失败: {str(e)}")
