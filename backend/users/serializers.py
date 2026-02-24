from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """用户序列化器"""
    avatar_url = serializers.SerializerMethodField(read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'phone', 'avatar', 'avatar_url', 'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_avatar_url(self, obj):
        """安全地获取头像 URL"""
        try:
            return obj.avatar.url if obj.avatar else None
        except (AttributeError, ValueError):
            return None


class AvatarUploadSerializer(serializers.Serializer):
    """头像上传序列化器"""
    avatar = serializers.ImageField(required=True, help_text='头像图片文件')


class RegisterSerializer(serializers.ModelSerializer):
    """注册序列化器"""

    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm', 'phone']
        extra_kwargs = {
            'password': {'write_only': True, 'validators': [validate_password]},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': '两次输入的密码不一致'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """登录序列化器"""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class UpdatePasswordSerializer(serializers.Serializer):
    """修改密码序列化器"""

    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': '两次输入的密码不一致'})
        return attrs

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('原密码错误')
        return value


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """用户资料更新序列化器"""

    class Meta:
        model = User
        fields = ['username', 'phone']
        extra_kwargs = {
            'username': {'required': False},
            'phone': {'required': False},
        }
