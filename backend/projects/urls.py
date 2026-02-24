"""
项目模块 URL 路由配置

API 端点:
- /api/projects/                - 项目管理
- /api/projects/{id}/media/     - 项目媒体管理
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
]
