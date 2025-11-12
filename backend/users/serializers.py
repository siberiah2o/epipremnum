from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User
from .constants import ErrorMessages


class UserRegistrationSerializer(serializers.ModelSerializer):
    """用户注册序列化器"""
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        min_length=8,
        error_messages={
            'min_length': ErrorMessages.PASSWORD_TOO_WEAK
        }
    )
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'phone')

    def validate_email(self, value):
        """验证邮箱是否已存在"""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(ErrorMessages.EMAIL_ALREADY_EXISTS)
        return value

    def validate(self, attrs):
        """验证两次密码是否一致"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': ErrorMessages.PASSWORD_INCORRECT})
        return attrs

    def create(self, validated_data):
        """创建用户"""
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """用户登录序列化器"""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        """验证用户凭据"""
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )

            if not user:
                raise serializers.ValidationError(ErrorMessages.INVALID_CREDENTIALS)

            if not user.is_active:
                raise serializers.ValidationError(ErrorMessages.USER_NOT_FOUND)

            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError(ErrorMessages.BAD_REQUEST)


class UserProfileSerializer(serializers.ModelSerializer):
    """用户资料序列化器"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone', 'avatar', 'created_at', 'updated_at')
        read_only_fields = ('id', 'email', 'created_at', 'updated_at')


class UserSerializer(serializers.ModelSerializer):
    """基础用户序列化器"""
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'avatar')
        read_only_fields = ('id', 'email')