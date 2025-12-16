from rest_framework import serializers
from .models import OllamaEndpoint, OllamaAIModel


class OllamaEndpointSerializer(serializers.ModelSerializer):
    """AI端点序列化器"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    auth_type_display = serializers.CharField(source='get_auth_type_display', read_only=True)

    # 不直接返回API Key，只返回是否已设置
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = OllamaEndpoint
        fields = (
            'id', 'name', 'provider', 'provider_display', 'url', 'api_key', 'has_api_key',
            'auth_type', 'auth_type_display', 'description', 'is_active', 'is_default',
            'created_by', 'created_by_username', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')
        extra_kwargs = {
            'api_key': {'write_only': True, 'required': False}  # 只写，不在响应中返回
        }

    def get_has_api_key(self, obj):
        """检查是否已设置API Key"""
        return bool(obj.api_key)


class OllamaEndpointCreateSerializer(serializers.ModelSerializer):
    """创建AI端点序列化器"""
    timeout = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = OllamaEndpoint
        fields = ('name', 'provider', 'url', 'api_key', 'auth_type', 'description', 'is_default', 'timeout')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'is_default': {'default': False},
            'api_key': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        """验证配置"""
        provider = attrs.get('provider', 'ollama')
        auth_type = attrs.get('auth_type', 'none')
        api_key = attrs.get('api_key', '')

        # 根据供应商类型验证必要字段
        if provider != 'ollama' and not api_key:
            raise serializers.ValidationError({
                'api_key': f'{provider} 需要提供 API Key'
            })

        # 自动设置认证类型
        if provider != 'ollama' and not auth_type or auth_type == 'none':
            attrs['auth_type'] = 'api_key'

        return attrs

    def create(self, validated_data):
        """处理创建时移除timeout字段"""
        # timeout字段只是用于客户端配置，不在模型中存储
        validated_data.pop('timeout', None)
        return super().create(validated_data)


class OllamaEndpointUpdateSerializer(serializers.ModelSerializer):
    """更新AI端点序列化器"""
    timeout = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = OllamaEndpoint
        fields = ('name', 'provider', 'url', 'api_key', 'auth_type', 'description', 'is_active', 'is_default', 'timeout')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'is_default': {'default': False},
            'api_key': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        """验证配置"""
        instance = self.instance

        # 获取更新后的值，如果没有更新则使用实例的值
        provider = attrs.get('provider', instance.provider if instance else 'ollama')
        auth_type = attrs.get('auth_type', instance.auth_type if instance else 'none')

        # 检查API Key
        api_key = attrs.get('api_key')
        if api_key is None and instance:
            # 更新时如果没有提供api_key字段，保持原有值
            api_key = instance.api_key
        elif api_key is None:
            # 创建时如果没有提供api_key字段，设为空字符串
            api_key = ''

        # 根据供应商类型验证必要字段
        # 只在创建新端点时才验证API Key必填
        if provider != 'ollama' and not api_key and not instance:
            raise serializers.ValidationError({
                'api_key': f'{provider} 需要提供 API Key'
            })

        return attrs

    def update(self, instance, validated_data):
        """处理更新时移除timeout字段"""
        # timeout字段只是用于客户端配置，不在模型中存储
        validated_data.pop('timeout', None)
        return super().update(instance, validated_data)


class OllamaAIModelSerializer(serializers.ModelSerializer):
    """Ollama模型序列化器"""
    endpoint_name = serializers.CharField(source='endpoint.name', read_only=True)

    class Meta:
        model = OllamaAIModel
        fields = (
            'id', 'name', 'endpoint', 'endpoint_name', 'is_active', 'is_vision_capable',
            'is_default', 'model_size', 'digest', 'modified_at', 'ollama_info',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'digest', 'modified_at', 'created_at', 'updated_at')


class OllamaAIModelCreateSerializer(serializers.ModelSerializer):
    """创建Ollama模型序列化器"""
    class Meta:
        model = OllamaAIModel
        fields = ('name', 'endpoint', 'is_active', 'is_vision_capable', 'is_default', 'ollama_info')
        extra_kwargs = {
            'ollama_info': {'required': False, 'default': dict}
        }


class OllamaAIModelUpdateSerializer(serializers.ModelSerializer):
    """更新Ollama模型序列化器"""
    class Meta:
        model = OllamaAIModel
        fields = ('is_active', 'is_vision_capable', 'is_default')