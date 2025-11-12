from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView
from . import views

app_name = 'users'

# 创建 ViewSet 路由器
router = DefaultRouter()
router.register(r'auth', views.AuthViewSet, basename='auth')
router.register(r'users', views.UserViewSet, basename='users')

urlpatterns = [
    # ViewSet 路由
    path('', include(router.urls)),

    # REST Framework 登录视图（可选）
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
]