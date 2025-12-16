from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OllamaEndpointViewSet, OllamaAIModelViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'endpoints', OllamaEndpointViewSet, basename='endpoint')
router.register(r'models', OllamaAIModelViewSet, basename='model')

app_name = 'endpoint'

urlpatterns = [
    path('', include(router.urls)),
]