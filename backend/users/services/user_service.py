"""
用户服务

提供用户相关的业务逻辑
"""

import logging
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from utils.exceptions import BusinessException, ResourceNotFound, ValidationError

User = get_user_model()
logger = logging.getLogger(__name__)


class UserService:
    """用户服务"""

    @staticmethod
    def register(email: str, username: str, password: str, **extra_fields) -> User:
        """
        注册用户

        Args:
            email: 邮箱
            username: 用户名
            password: 密码
            **extra_fields: 其他字段

        Returns:
            User: 创建的用户对象

        Raises:
            ValidationError: 验证失败
        """
        # 检查邮箱是否已存在
        if User.objects.filter(email=email).exists():
            raise ValidationError('该邮箱已被注册')

        # 检查用户名是否已存在
        if User.objects.filter(username=username).exists():
            raise ValidationError('该用户名已被使用')

        # 创建用户
        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            **extra_fields
        )

        logger.info(f"用户注册成功: email={email}")
        return user

    @staticmethod
    def login(email: str, password: str, request=None) -> dict:
        """
        用户登录

        Args:
            email: 邮箱
            password: 密码
            request: 请求对象（可选）

        Returns:
            dict: 包含 token 和用户信息

        Raises:
            ValidationError: 登录失败
        """
        user = authenticate(request, username=email, password=password)

        if user is None:
            raise ValidationError('邮箱或密码错误')

        if not user.is_active:
            raise ValidationError('账户已被禁用')

        # 生成 JWT token
        refresh = RefreshToken.for_user(user)

        logger.info(f"用户登录成功: email={email}")
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user,
        }

    @staticmethod
    def update_profile(user: User, **update_fields) -> User:
        """
        更新用户资料

        Args:
            user: 用户对象
            **update_fields: 要更新的字段

        Returns:
            User: 更新后的用户对象
        """
        # 不允许通过此方法更新的字段
        protected_fields = {'password', 'is_superuser', 'is_staff', 'is_active'}

        for field, value in update_fields.items():
            if field not in protected_fields and hasattr(user, field):
                setattr(user, field, value)

        user.save()
        logger.info(f"用户资料更新: user_id={user.id}")
        return user

    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> bool:
        """
        修改密码

        Args:
            user: 用户对象
            old_password: 旧密码
            new_password: 新密码

        Returns:
            bool: 是否成功

        Raises:
            ValidationError: 验证失败
        """
        if not user.check_password(old_password):
            raise ValidationError('原密码错误')

        user.set_password(new_password)
        user.save()

        logger.info(f"用户密码修改: user_id={user.id}")
        return True

    @staticmethod
    def upload_avatar(user: User, avatar_file) -> User:
        """
        上传头像

        Args:
            user: 用户对象
            avatar_file: 头像文件

        Returns:
            User: 更新后的用户对象
        """
        # 删除旧头像
        if user.avatar:
            user.avatar.delete(save=False)

        # 保存新头像
        user.avatar = avatar_file
        user.save()

        logger.info(f"用户头像上传: user_id={user.id}")
        return user

    @staticmethod
    def delete_avatar(user: User) -> User:
        """
        删除头像

        Args:
            user: 用户对象

        Returns:
            User: 更新后的用户对象
        """
        if user.avatar:
            user.avatar.delete(save=False)
            user.avatar = None
            user.save()

        logger.info(f"用户头像删除: user_id={user.id}")
        return user
