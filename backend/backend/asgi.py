"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import llm.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# 初始化 Django ASGI 应用
django_asgi_app = get_asgi_application()

# WebSocket 路由配置
application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AuthMiddlewareStack(
        URLRouter(
            llm.routing.websocket_urlpatterns
        )
    ),
})
