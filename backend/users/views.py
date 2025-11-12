from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth import get_user_model
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserSerializer
)
from .exceptions import (
    TokenInvalidException,
    InvalidCredentialsException
)
from .constants import ErrorMessages
from utils.responses import (
    success_response,
    error_response,
    validation_error_response,
    unauthorized_response,
    conflict_response
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

        return success_response(
            data={
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            message='注册成功',
            status_code=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['post'])
    def login(self, request):
        """用户登录"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        return success_response(
            data={
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            message='登录成功'
        )

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        """用户登出"""
        refresh_token = request.data.get("refresh")
        try:
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return success_response(message='成功退出登录', data=None)
        except (TokenError, ValueError) as e:
            raise TokenInvalidException(ErrorMessages.TOKEN_BLACKLISTED)
        except Exception as e:
            # 对于其他未预期的异常，让全局异常处理器处理
            raise

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def refresh(self, request):
        """刷新令牌"""
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return error_response(
                message='refresh token 不能为空',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            return success_response(
                data={
                    'access': str(token.access_token),
                    'refresh': str(token)  # 返回新的 refresh token
                },
                message='令牌刷新成功'
            )
        except (TokenError, ValueError):
            raise TokenInvalidException(ErrorMessages.TOKEN_REFRESH_FAILED)
        except Exception as e:
            # 对于其他未预期的异常，让全局异常处理器处理
            raise


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
        return success_response(
            data=serializer.data,
            message='获取用户信息成功'
        )

    @action(detail=False, methods=['get'])
    def profile(self, request):
        """获取当前用户详细资料"""
        serializer = self.get_serializer(request.user)
        return success_response(
            data=serializer.data,
            message='获取用户资料成功'
        )

    @action(detail=False, methods=['post'])
    def update_profile(self, request):
        """更新用户资料"""
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return success_response(
            data=serializer.data,
            message='更新用户资料成功'
        )


