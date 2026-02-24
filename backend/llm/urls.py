"""
LLM 模块 URL 路由配置

API 端点:
- /api/llm/endpoints/    - API 端点管理
- /api/llm/models/       - AI 模型管理
- /api/llm/analyses/     - 图片分析（合并原 tasks 和 analyses）
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from llm.views import (
    EndpointViewSet,
    AIModelViewSet,
    AnalysisViewSet,
)

# 创建路由器
router = DefaultRouter()
router.register(r'endpoints', EndpointViewSet, basename='endpoint')
router.register(r'models', AIModelViewSet, basename='model')
router.register(r'analyses', AnalysisViewSet, basename='analysis')
# 注意：移除了 tasks 路由，功能已合并到 analyses

urlpatterns = [
    path('', include(router.urls)),
]
