from rest_framework import serializers
from .models import OllamaEndpoint, OllamaAIModel, OllamaImageAnalysis


class OllamaEndpointSerializer(serializers.ModelSerializer):
    """Ollama端点序列化器"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = OllamaEndpoint
        fields = (
            'id', 'name', 'url', 'description', 'is_active', 'is_default',
            'created_by', 'created_by_username', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')


class OllamaEndpointCreateSerializer(serializers.ModelSerializer):
    """创建Ollama端点序列化器"""
    class Meta:
        model = OllamaEndpoint
        fields = ('name', 'url', 'description', 'is_default')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'is_default': {'default': False}
        }


class OllamaEndpointUpdateSerializer(serializers.ModelSerializer):
    """更新Ollama端点序列化器"""
    class Meta:
        model = OllamaEndpoint
        fields = ('name', 'url', 'description', 'is_active', 'is_default')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'is_default': {'default': False}
        }


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


# ==================== 图片分析相关序列化器 ====================

class OllamaImageAnalysisCreateSerializer(serializers.Serializer):
    """创建图片分析任务序列化器"""
    media_id = serializers.IntegerField(
        min_value=1,
        help_text="媒体文件ID"
    )
    model_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_null=True,
        help_text="使用的模型名称（可选，默认使用默认模型）"
    )
    options = serializers.JSONField(
        required=False,
        default=dict,
        help_text="分析选项配置，包括生成标题、描述、提示词、分类、标签等"
    )

    def validate_media_id(self, value):
        """验证媒体文件ID"""
        from media.models import Media
        try:
            media = Media.objects.get(id=value)
            # 检查文件是否为图片
            if not media.file:
                raise serializers.ValidationError("媒体文件不存在")

            # 支持的图片格式
            image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
            file_extension = media.file.name.lower().split('.')[-1]
            if f'.{file_extension}' not in image_extensions:
                raise serializers.ValidationError("只支持图片文件分析")

            return value
        except Media.DoesNotExist:
            raise serializers.ValidationError("媒体文件不存在")

    def validate_model_name(self, value):
        """验证模型名称"""
        if value is None:
            return None

        try:
            # 这里需要用户上下文，在视图层进行详细验证
            return value
        except Exception:
            raise serializers.ValidationError("无效的模型名称")

    def validate_options(self, value):
        """验证分析选项"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("分析选项必须是JSON对象")

        # 验证支持的字段
        allowed_fields = {
            'generate_title', 'generate_description', 'generate_prompt',
            'generate_categories', 'generate_tags', 'max_categories', 'max_tags',
            'temperature', 'top_p', 'max_tokens'
        }
        for field in value:
            if field not in allowed_fields:
                raise serializers.ValidationError(f"不支持的分析选项: {field}")

        # 验证布尔选项
        bool_fields = {'generate_title', 'generate_description', 'generate_prompt', 'generate_categories', 'generate_tags'}
        for field in bool_fields:
            if field in value and not isinstance(value[field], bool):
                raise serializers.ValidationError(f"{field} 必须是布尔值")

        # 验证数值选项
        if 'max_categories' in value:
            max_cats = value['max_categories']
            if not isinstance(max_cats, int) or not 1 <= max_cats <= 20:
                raise serializers.ValidationError("max_categories必须在1-20之间")

        if 'max_tags' in value:
            max_tags = value['max_tags']
            if not isinstance(max_tags, int) or not 1 <= max_tags <= 50:
                raise serializers.ValidationError("max_tags必须在1-50之间")

        if 'temperature' in value:
            temp = value['temperature']
            if not isinstance(temp, (int, float)) or not 0 <= temp <= 2:
                raise serializers.ValidationError("temperature必须在0-2之间")

        if 'top_p' in value:
            top_p = value['top_p']
            if not isinstance(top_p, (int, float)) or not 0 <= top_p <= 1:
                raise serializers.ValidationError("top_p必须在0-1之间")

        if 'max_tokens' in value:
            max_tokens = value['max_tokens']
            if not isinstance(max_tokens, int) or not 1 <= max_tokens <= 2000:
                raise serializers.ValidationError("max_tokens必须在1-2000之间")

        return value


class OllamaImageAnalysisSerializer(serializers.ModelSerializer):
    """图片分析任务序列化器"""
    media_title = serializers.CharField(source='media.title', read_only=True)
    media_file_name = serializers.CharField(source='media.file.name', read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)
    endpoint_name = serializers.CharField(source='model.endpoint.name', read_only=True)
    progress = serializers.IntegerField(read_only=True, source='task_progress')
    is_task_running = serializers.BooleanField(read_only=True, source='is_task_running')
    can_retry = serializers.BooleanField(read_only=True, source='can_retry')
    processing_duration = serializers.SerializerMethodField()

    class Meta:
        model = OllamaImageAnalysis
        fields = (
            'id', 'media', 'media_title', 'media_file_name', 'model', 'model_name',
            'endpoint_name', 'status', 'task_id', 'analysis_options', 'prompt',
            'error_message', 'retry_count', 'processing_time', 'progress',
            'is_task_running', 'can_retry', 'processing_duration',
            'created_at', 'updated_at', 'started_at', 'completed_at'
        )
        read_only_fields = (
            'id', 'status', 'task_id', 'error_message', 'retry_count',
            'processing_time', 'created_at', 'updated_at', 'started_at', 'completed_at'
        )

    def get_processing_duration(self, obj):
        """获取处理耗时"""
        duration = obj.get_processing_duration()
        return duration if duration is not None else None


class OllamaImageAnalysisTaskCreateSerializer(serializers.Serializer):
    """任务创建响应序列化器"""
    analysis_id = serializers.IntegerField()
    task_id = serializers.CharField(allow_null=True)
    media_id = serializers.IntegerField()
    model_name = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField()


class OllamaImageAnalysisTaskStatusSerializer(serializers.Serializer):
    """任务状态查询序列化器"""
    analysis_id = serializers.IntegerField(read_only=True)
    media_id = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    progress = serializers.IntegerField(read_only=True)
    model_name = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    started_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True)
    processing_time_ms = serializers.IntegerField(read_only=True)
    retry_count = serializers.IntegerField(read_only=True)
    can_retry = serializers.BooleanField(read_only=True)
    error_message = serializers.CharField(read_only=True, allow_null=True)
    async_task_status = serializers.CharField(read_only=True, allow_null=True)


class OllamaImageAnalysisTaskListSerializer(serializers.Serializer):
    """任务列表序列化器"""
    analysis_id = serializers.IntegerField(read_only=True)
    media_id = serializers.IntegerField(read_only=True)
    media_title = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    progress = serializers.IntegerField(read_only=True)
    model_name = serializers.CharField(read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    processing_time_ms = serializers.IntegerField(read_only=True, allow_null=True)
    retry_count = serializers.IntegerField(read_only=True)
    can_retry = serializers.BooleanField(read_only=True)
    error_message = serializers.CharField(read_only=True, allow_null=True)


class OllamaImageAnalysisTaskRetrySerializer(serializers.Serializer):
    """任务重试序列化器"""
    analysis_id = serializers.IntegerField(read_only=True)
    task_id = serializers.CharField(read_only=True)
    retry_count = serializers.IntegerField(read_only=True)


class OllamaImageAnalysisTaskCancelSerializer(serializers.Serializer):
    """任务取消序列化器"""
    analysis_id = serializers.IntegerField(read_only=True)
    task_id = serializers.CharField(read_only=True)