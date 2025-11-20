from django.apps import AppConfig


class LlmsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'llms'
    verbose_name = 'AI分析系统 v2'

    def ready(self):
        """在应用启动时导入任务模块以注册后台任务"""
        import llms.tasks