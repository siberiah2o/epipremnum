from rest_framework import serializers
from .models import AIAnalysis, AIModel, OllamaEndpoint
from media.models import Media, Category, Tag


class OllamaEndpointSerializer(serializers.ModelSerializer):
    """Ollama端点序列化器"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = OllamaEndpoint
        fields = (
            'id', 'name', 'url', 'description', 'is_active', 'is_default', 'timeout',
            'created_by', 'created_by_username', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')


class OllamaEndpointCreateSerializer(serializers.ModelSerializer):
    """创建Ollama端点序列化器"""
    class Meta:
        model = OllamaEndpoint
        fields = ('name', 'url', 'description', 'is_default', 'timeout')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'is_default': {'default': False},
            'timeout': {'default': 300}
        }


class AIModelSerializer(serializers.ModelSerializer):
    """AI模型序列化器"""
    endpoint_name = serializers.CharField(source='endpoint.name', read_only=True)
    endpoint_url = serializers.CharField(source='endpoint.url', read_only=True)

    class Meta:
        model = AIModel
        fields = (
            'id', 'name', 'display_name', 'description', 'endpoint', 'endpoint_name', 'endpoint_url',
            'is_active', 'is_vision_capable', 'is_default', 'model_size',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class AIAnalysisSerializer(serializers.ModelSerializer):
    """重构后的AI分析序列化器"""
    media_info = serializers.SerializerMethodField()
    suggested_categories_data = serializers.SerializerMethodField()
    suggested_tags_data = serializers.SerializerMethodField()
    task_progress = serializers.ReadOnlyField()
    is_task_running = serializers.ReadOnlyField()
    applied_to_media = serializers.BooleanField(read_only=True)
    title = serializers.SerializerMethodField()  # 改为方法字段以处理同步逻辑

    class Meta:
        model = AIAnalysis
        fields = (
            'id', 'media', 'media_info', 'task_id', 'status', 'model_used',
            'title', 'description', 'prompt',
            'suggested_categories', 'suggested_categories_data',
            'suggested_tags', 'suggested_tags_data',
            'error_message', 'applied_to_media',
            'task_progress', 'is_task_running',
            'created_at', 'updated_at', 'analyzed_at'
        )
        read_only_fields = ('id', 'task_id', 'created_at', 'updated_at', 'analyzed_at', 'applied_to_media')

    def get_title(self, obj):
        """获取标题，确保与媒体文件同步"""
        # 如果已应用到媒体文件，返回媒体文件的当前标题
        # 否则返回AI分析生成的原始标题
        if obj.applied_to_media and obj.media:
            return obj.media.title
        return obj.title

    def get_media_info(self, obj):
        """获取媒体文件基本信息"""
        if obj.media:
            return {
                'id': obj.media.id,
                'title': obj.media.title,  # 总是显示媒体文件的当前标题
                'file_type': obj.media.file_type,
                'file_url': obj.media.file.url if obj.media.file else None
            }
        return None

    def get_suggested_categories_data(self, obj):
        """获取建议的分类数据"""
        categories = obj.suggested_categories.all()
        return [
            {
                'id': cat.id,
                'name': cat.name,
                'description': cat.description
            }
            for cat in categories
        ]

    def get_suggested_tags_data(self, obj):
        """获取建议的标签数据"""
        tags = obj.suggested_tags.all()
        return [
            {
                'id': tag.id,
                'name': tag.name
            }
            for tag in tags
        ]


class AIAnalysisListSerializer(serializers.ModelSerializer):
    """AI分析列表序列化器（简化版）"""
    media_title = serializers.CharField(source='media.title', read_only=True)
    media_file_type = serializers.CharField(source='media.file_type', read_only=True)

    class Meta:
        model = AIAnalysis
        fields = (
            'id', 'media', 'media_title', 'media_file_type', 'status',
            'model_used', 'created_at', 'analyzed_at'
        )


class SingleAnalysisRequestSerializer(serializers.Serializer):
    """简化的单图分析请求序列化器"""
    media_id = serializers.IntegerField(
        required=True,
        help_text="媒体文件ID"
    )
    model_name = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="使用的模型名称（可选，不指定则使用默认模型）"
    )




