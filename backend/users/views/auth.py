"""
用户认证视图

提供注册、登录、用户资料管理等功能
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated

from utils.responses import SuccessResponse, CreatedResponse, BadRequestResponse
from utils.exceptions import ValidationError
from utils.viewsets import BaseModelViewSet

from ..services import UserService
from ..serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    UpdatePasswordSerializer,
    ProfileUpdateSerializer,
    AvatarUploadSerializer,
)


class AuthViewSet(viewsets.ViewSet):
    """
    认证视图集

    API 端点:
    - POST /api/users/auth/register/   # 注册
    - POST /api/users/auth/login/      # 登录
    """

    # 注册和登录不需要认证
    permission_classes_by_action = {
        'register': [AllowAny],
        'login': [AllowAny],
    }

    def get_permissions(self):
        """根据 action 返回权限类"""
        return [permission() for permission in self.permission_classes_by_action.get(
            self.action, [IsAuthenticated]
        )]

    @action(detail=False, methods=['post'])
    def register(self, request):
        """
        用户注册

        POST /api/users/auth/register/
        Body: { "email": "...", "username": "...", "password": "..." }
        """
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = UserService.register(
                email=serializer.validated_data['email'],
                username=serializer.validated_data['username'],
                password=serializer.validated_data['password']
            )
            return CreatedResponse(
                data=UserSerializer(user).data,
                message='注册成功'
            )
        except ValidationError as e:
            return BadRequestResponse(message=str(e))

    @action(detail=False, methods=['post'])
    def login(self, request):
        """
        用户登录

        POST /api/users/auth/login/
        Body: { "email": "...", "password": "..." }
        """
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            result = UserService.login(
                email=serializer.validated_data['email'],
                password=serializer.validated_data['password'],
                request=request
            )
            return SuccessResponse(
                data={
                    'access': result['access'],
                    'refresh': result['refresh'],
                    'user': UserSerializer(result['user']).data,
                },
                message='登录成功'
            )
        except ValidationError as e:
            return BadRequestResponse(message=str(e))


class ProfileViewSet(viewsets.ViewSet):
    """
    用户资料视图集

    API 端点:
    - GET  /api/users/profile/me/       # 获取用户信息
    - PUT  /api/users/profile/edit/     # 更新用户信息
    - POST /api/users/profile/password/ # 修改密码
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        获取当前用户信息

        GET /api/users/profile/me/
        """
        serializer = UserSerializer(request.user)
        return SuccessResponse(data=serializer.data, message='获取用户信息成功')

    @action(detail=False, methods=['put', 'patch'])
    def edit(self, request):
        """
        更新用户信息

        PUT/PATCH /api/users/profile/edit/
        """
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=request.method == 'PATCH'
        )
        serializer.is_valid(raise_exception=True)

        user = UserService.update_profile(
            request.user,
            **serializer.validated_data
        )
        return SuccessResponse(
            data=UserSerializer(user).data,
            message='更新用户信息成功'
        )

    @action(detail=False, methods=['post'])
    def password(self, request):
        """
        修改密码

        POST /api/users/profile/password/
        Body: { "old_password": "...", "new_password": "..." }
        """
        serializer = UpdatePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        try:
            UserService.change_password(
                user=request.user,
                old_password=serializer.validated_data['old_password'],
                new_password=serializer.validated_data['new_password']
            )
            return SuccessResponse(message='密码修改成功')
        except ValidationError as e:
            return BadRequestResponse(message=str(e))


class AvatarViewSet(viewsets.ViewSet):
    """
    头像视图集

    API 端点:
    - POST   /api/users/avatar/   # 上传头像
    - DELETE /api/users/avatar/   # 删除头像
    """

    permission_classes = [IsAuthenticated]

    def create(self, request):
        """
        上传头像

        POST /api/users/avatar/
        Body: multipart/form-data { "avatar": <file> }
        """
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = UserService.upload_avatar(
            request.user,
            serializer.validated_data['avatar']
        )
        return SuccessResponse(
            data=UserSerializer(user).data,
            message='头像上传成功'
        )

    def destroy(self, request):
        """
        删除头像

        DELETE /api/users/avatar/
        """
        UserService.delete_avatar(request.user)
        return SuccessResponse(message='头像删除成功')
