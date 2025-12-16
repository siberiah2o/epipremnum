from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OllamaAnalysisViewSet
from .views.concurrency import ConcurrencyStatusView

# 创建路由器并注册 ViewSet
# 端点和模型管理已迁移到 endpoint 应用
router = DefaultRouter()
router.register(r'analyze', OllamaAnalysisViewSet, basename='ollama-analyze')

app_name = 'ollama'

urlpatterns = [
    path('', include(router.urls)),
    path('concurrency/status/', ConcurrencyStatusView.as_view(), name='concurrency-status'),
]