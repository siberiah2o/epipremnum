"""
用户模块 URL 路由配置

API 端点:
- POST /api/users/auth/register/    # 注册
- POST /api/users/auth/login/       # 登录
- GET  /api/users/profile/me/       # 获取用户信息
- PUT  /api/users/profile/update/   # 更新用户信息
- POST /api/users/profile/password/ # 修改密码
- POST /api/users/avatar/           # 上传头像
- DELETE /api/users/avatar/         # 删除头像
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AuthViewSet, ProfileViewSet, AvatarViewSet

app_name = 'users'

# 创建路由器
router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'profile', ProfileViewSet, basename='profile')
router.register(r'avatar', AvatarViewSet, basename='avatar')

urlpatterns = [
    path('users/', include(router.urls)),
]
