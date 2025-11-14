from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'media'

# 创建 ViewSet 路由器
router = DefaultRouter()
router.register(r'categories', views.CategoryViewSet, basename='categories')
router.register(r'tags', views.TagViewSet, basename='tags')
router.register(r'', views.MediaViewSet, basename='media')

urlpatterns = [
    # ViewSet 路由
    path('', include(router.urls)),
]