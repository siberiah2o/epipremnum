from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OllamaEndpointViewSet, OllamaAIModelViewSet, OllamaAnalysisViewSet
from .views.concurrency import ConcurrencyStatusView

# 创建路由器并注册 ViewSet
router = DefaultRouter()
router.register(r'endpoints', OllamaEndpointViewSet, basename='ollama-endpoints')
router.register(r'models', OllamaAIModelViewSet, basename='ollama-models')
router.register(r'analyze', OllamaAnalysisViewSet, basename='ollama-analyze')

app_name = 'ollama'

urlpatterns = [
    path('', include(router.urls)),
    path('concurrency/status/', ConcurrencyStatusView.as_view(), name='concurrency-status'),
]