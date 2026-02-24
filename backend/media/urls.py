"""
媒体模块 URL 路由配置

API 端点:
- /api/media/           - 媒体文件管理
- /api/categories/      - 分类管理
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import MediaViewSet, CategoryViewSet

router = DefaultRouter()
router.register(r'media', MediaViewSet, basename='media')
router.register(r'categories', CategoryViewSet, basename='category')

urlpatterns = [
    path('', include(router.urls)),
]
