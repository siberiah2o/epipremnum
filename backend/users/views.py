from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserSerializer
)

User = get_user_model()


class AuthViewSet(viewsets.GenericViewSet):
    """认证相关 ViewSet"""
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        """根据 action 选择序列化器"""
        if self.action == 'register':
            return UserRegistrationSerializer
        elif self.action == 'login':
            return UserLoginSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=['post'])
    def register(self, request):
        """用户注册"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # 为新注册用户生成 JWT token
        refresh = RefreshToken.for_user(user)

        return Response({
            'code': 201,
            'message': '注册成功',
            'data': {
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def login(self, request):
        """用户登录"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        return Response({
            'code': 200,
            'message': '登录成功',
            'data': {
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        """用户登出"""
        refresh_token = request.data.get("refresh")
        try:
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({
                'code': 200,
                'message': '成功退出登录',
                'data': None
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'code': 400,
                'message': '退出登录失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def refresh(self, request):
        """刷新令牌"""
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({
                'code': 400,
                'message': 'refresh token 不能为空',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            return Response({
                'code': 200,
                'message': '令牌刷新成功',
                'data': {
                    'access': str(token.access_token),
                    'refresh': str(token)  # 返回新的 refresh token
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'code': 400,
                'message': '令牌刷新失败',
                'data': None
            }, status=status.HTTP_400_BAD_REQUEST)


class UserViewSet(viewsets.GenericViewSet):
    """用户管理 ViewSet"""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        """根据 action 选择序列化器"""
        if self.action == 'me':
            return UserSerializer
        elif self.action == 'profile':
            return UserProfileSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=['get'])
    def me(self, request):
        """获取当前用户基本信息"""
        serializer = self.get_serializer(request.user)
        return Response({
            'code': 200,
            'message': '获取用户信息成功',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def profile(self, request):
        """获取当前用户详细资料"""
        serializer = self.get_serializer(request.user)
        return Response({
            'code': 200,
            'message': '获取用户资料成功',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def update_profile(self, request):
        """更新用户资料"""
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)

        if not serializer.is_valid():
            return Response({
                'code': 400,
                'message': '数据验证失败',
                'data': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()

        return Response({
            'code': 200,
            'message': '更新用户资料成功',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


