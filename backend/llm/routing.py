"""
WebSocket URL 路由配置
"""

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/analysis/$', consumers.AnalysisStatusConsumer.as_asgi()),
]
