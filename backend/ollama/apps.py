from django.apps import AppConfig


class OllamaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ollama'

    def ready(self):
        """Import tasks when Django app starts"""
        # Import background tasks to ensure they are registered
        from . import tasks  # noqa: F401
