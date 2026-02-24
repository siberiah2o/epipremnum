"""
LLM 模块序列化器
"""

from rest_framework import serializers
from .models import Endpoint, AIModel, ImageAnalysis, AnalysisStatus


# ============ 任务相关序列化器 ============

class TaskStatusSerializer(serializers.Serializer):
    """任务状态序列化器"""
    id = serializers.CharField()
    name = serializers.CharField()
    func = serializers.CharField()
    started = serializers.DateTimeField(allow_null=True)
    stopped = serializers.DateTimeField(allow_null=True)
    success = serializers.BooleanField(allow_null=True)
    result = serializers.JSONField(allow_null=True)
    exception = serializers.CharField(allow_null=True)


class GroupStatusSerializer(serializers.Serializer):
    """任务组状态序列化器"""
    group = serializers.CharField()
    total = serializers.IntegerField()
    success = serializers.IntegerField()
    failed = serializers.IntegerField()
    pending = serializers.IntegerField()


# ============ 分析请求序列化器 ============

class CreateAnalysisSerializer(serializers.Serializer):
    """创建分析任务序列化器"""
    media_id = serializers.IntegerField()
    model_id = serializers.IntegerField()


class BatchAnalyzeSerializer(serializers.Serializer):
    """批量分析请求序列化器"""
    media_ids = serializers.ListField(child=serializers.IntegerField())
    model_id = serializers.IntegerField()


class BatchAnalysisActionSerializer(serializers.Serializer):
    """批量分析操作序列化器"""
    analysis_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="分析记录ID列表，为空时处理所有符合条件的记录"
    )


class SyncModelsSerializer(serializers.Serializer):
    """模型同步请求序列化器"""
    endpoint_id = serializers.IntegerField()


# ============ 模型序列化器 ============

class AIModelSerializer(serializers.ModelSerializer):
    """AI模型序列化器"""

    class Meta:
        model = AIModel
        fields = ['id', 'endpoint', 'name', 'is_default', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AIModelCreateSerializer(serializers.ModelSerializer):
    """创建模型序列化器"""

    class Meta:
        model = AIModel
        fields = ['endpoint', 'name']


class AIModelUpdateSerializer(serializers.ModelSerializer):
    """更新模型序列化器"""

    class Meta:
        model = AIModel
        fields = ['endpoint', 'name', 'is_default']


# ============ 端点序列化器 ============

class EndpointSerializer(serializers.ModelSerializer):
    """API端点序列化器"""

    owner_name = serializers.CharField(source='owner.username', read_only=True)
    models = AIModelSerializer(many=True, read_only=True)
    provider_type_display = serializers.CharField(source='get_provider_type_display', read_only=True)
    # 使用脱敏后的 API Key
    api_key = serializers.CharField(read_only=True, source='get_masked_api_key')
    model_count = serializers.SerializerMethodField()

    class Meta:
        model = Endpoint
        fields = [
            'id', 'name', 'provider_type', 'provider_type_display',
            'base_url', 'api_key', 'is_default', 'owner', 'owner_name',
            'models', 'model_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

    def get_model_count(self, obj):
        """获取模型数量"""
        return obj.models.count()


class EndpointCreateSerializer(serializers.ModelSerializer):
    """创建端点序列化器"""

    class Meta:
        model = Endpoint
        fields = ['name', 'provider_type', 'base_url', 'api_key']

    def create(self, validated_data):
        """创建时使用 property setter 自动加密"""
        # api_key 会通过模型的 property setter 自动加密
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """更新时使用 property setter 自动加密"""
        return super().update(instance, validated_data)


# ============ 分析结果序列化器 ============

class ImageAnalysisSerializer(serializers.ModelSerializer):
    """图片分析序列化器"""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    error_type_display = serializers.CharField(source='get_error_type_display', read_only=True)
    media_filename = serializers.CharField(source='media.filename', read_only=True)
    media_thumbnail = serializers.CharField(source='media.thumbnail_url', read_only=True)
    media_category = serializers.SerializerMethodField()
    model_name = serializers.CharField(source='model.name', read_only=True)
    endpoint_name = serializers.CharField(source='endpoint.name', read_only=True)
    can_retry = serializers.SerializerMethodField()

    class Meta:
        model = ImageAnalysis
        fields = [
            'id',
            'media',
            'media_filename',
            'media_thumbnail',
            'media_category',
            'model',
            'model_name',
            'endpoint',
            'endpoint_name',
            'user',
            'status',
            'status_display',
            'description',
            'method',
            'tokens_used',
            'error_type',
            'error_type_display',
            'error_message',
            'error_details',
            'retry_count',
            'max_retries',
            'last_retry_at',
            'can_retry',
            'created_at',
            'updated_at',
            'completed_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'status',
            'description',
            'method',
            'tokens_used',
            'error_type',
            'error_message',
            'error_details',
            'retry_count',
            'last_retry_at',
            'created_at',
            'updated_at',
            'completed_at',
        ]

    def get_media_category(self, obj):
        """获取媒体文件的分类"""
        if obj.media and obj.media.category:
            return {
                'id': obj.media.category.id,
                'name': obj.media.category.name
            }
        return None

    def get_can_retry(self, obj):
        """判断是否可以重试"""
        return obj.can_retry()


class ImageAnalysisUpdateSerializer(serializers.ModelSerializer):
    """更新分析描述序列化器"""

    class Meta:
        model = ImageAnalysis
        fields = ['description']

    def validate_description(self, value):
        """验证描述不能为空"""
        if value is not None and len(value.strip()) == 0:
            raise serializers.ValidationError("描述不能为空字符串")
        return value
