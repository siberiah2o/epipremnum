from rest_framework import serializers
from .models import Media, Category, Tag
from users.constants import ErrorMessages


class CategorySerializer(serializers.ModelSerializer):
    """分类序列化器"""
    class Meta:
        model = Category
        fields = ('id', 'name', 'description', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    class Meta:
        model = Tag
        fields = ('id', 'name', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class MediaSerializer(serializers.ModelSerializer):
    """媒体文件序列化器"""
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    category_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="分类ID列表"
    )
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="标签ID列表"
    )
    # AI相关字段
    ai_description = serializers.SerializerMethodField()
    ai_prompt = serializers.SerializerMethodField()
    ai_categories = serializers.SerializerMethodField()
    ai_tags = serializers.SerializerMethodField()
    ai_analyzed_at = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = (
            'id', 'title', 'description', 'prompt', 'file', 'file_type', 'file_size',
            'thumbnail', 'file_url', 'thumbnail_url', 'user', 'categories', 'tags',
            'category_ids', 'tag_ids', 'created_at', 'updated_at',
            'ai_description', 'ai_prompt', 'ai_categories', 'ai_tags', 'ai_analyzed_at'
        )
        read_only_fields = ('id', 'file_type', 'file_size', 'user', 'created_at', 'updated_at')

    def get_file_url(self, obj):
        """获取文件URL"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_thumbnail_url(self, obj):
        """获取缩略图URL"""
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None

    def get_ai_description(self, obj):
        """获取AI生成的描述"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            # 直接从description字段获取描述
            if ai_analysis and ai_analysis.description:
                return ai_analysis.description
            return None
        except:
            return None

    def get_ai_prompt(self, obj):
        """获取AI生成的提示词"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            # 直接从prompt字段获取提示词
            if ai_analysis and ai_analysis.prompt:
                return ai_analysis.prompt
            return None
        except:
            return None

    def get_ai_categories(self, obj):
        """获取AI建议的分类"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis:
                categories = ai_analysis.suggested_categories.all()
                return [{'id': cat.id, 'name': cat.name} for cat in categories]
            return []
        except:
            return []

    def get_ai_tags(self, obj):
        """获取AI建议的标签"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis:
                tags = ai_analysis.suggested_tags.all()
                return [{'id': tag.id, 'name': tag.name} for tag in tags]
            return []
        except:
            return []

    def get_ai_analyzed_at(self, obj):
        """获取AI分析时间"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis and ai_analysis.analyzed_at:
                return ai_analysis.analyzed_at.isoformat()
            return None
        except:
            return None

    def create(self, validated_data):
        """创建媒体文件"""
        # 提取分类和标签ID
        category_ids = validated_data.pop('category_ids', [])
        tag_ids = validated_data.pop('tag_ids', [])
        
        # 创建媒体文件
        media = Media.objects.create(**validated_data)
        
        # 添加分类
        if category_ids:
            categories = Category.objects.filter(id__in=category_ids, user=media.user)
            media.categories.set(categories)
        
        # 添加标签
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, user=media.user)
            media.tags.set(tags)
        
        return media

    def update(self, instance, validated_data):
        """更新媒体文件"""
        # 提取分类和标签ID
        category_ids = validated_data.pop('category_ids', None)
        tag_ids = validated_data.pop('tag_ids', None)
        
        # 更新媒体文件
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # 更新分类
        if category_ids is not None:
            if category_ids:  # 非空列表
                categories = Category.objects.filter(id__in=category_ids, user=instance.user)
                instance.categories.set(categories)
            else:  # 空列表，清空分类
                instance.categories.set([])
        
        # 更新标签
        if tag_ids is not None:
            if tag_ids:  # 非空列表
                tags = Tag.objects.filter(id__in=tag_ids, user=instance.user)
                instance.tags.set(tags)
            else:  # 空列表，清空标签
                instance.tags.set([])
        
        return instance


class MediaListSerializer(serializers.ModelSerializer):
    """媒体文件列表序列化器（简化版）"""
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    ai_description = serializers.SerializerMethodField()
    ai_prompt = serializers.SerializerMethodField()
    ai_categories = serializers.SerializerMethodField()
    ai_tags = serializers.SerializerMethodField()
    ai_analyzed_at = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = (
            'id', 'title', 'description', 'file_type', 'file_size', 'file_url', 'thumbnail_url',
            'created_at', 'ai_description', 'ai_prompt', 'ai_categories', 'ai_tags', 'ai_analyzed_at'
        )

    def get_file_url(self, obj):
        """获取文件URL"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_thumbnail_url(self, obj):
        """获取缩略图URL"""
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None

    def get_ai_description(self, obj):
        """获取AI生成的描述"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            # 直接从description字段获取描述
            if ai_analysis and ai_analysis.description:
                return ai_analysis.description
            return None
        except:
            return None

    def get_ai_prompt(self, obj):
        """获取AI生成的提示词"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            # 直接从prompt字段获取提示词
            if ai_analysis and ai_analysis.prompt:
                return ai_analysis.prompt
            return None
        except:
            return None

    def get_ai_categories(self, obj):
        """获取AI建议的分类"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis:
                categories = ai_analysis.suggested_categories.all()
                return [{'id': cat.id, 'name': cat.name} for cat in categories]
            return []
        except:
            return []

    def get_ai_tags(self, obj):
        """获取AI建议的标签"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis:
                tags = ai_analysis.suggested_tags.all()
                return [{'id': tag.id, 'name': tag.name} for tag in tags]
            return []
        except:
            return []

    def get_ai_analyzed_at(self, obj):
        """获取AI分析时间"""
        try:
            from llms.models import AIAnalysis
            ai_analysis = AIAnalysis.objects.filter(media=obj).first()
            if ai_analysis and ai_analysis.analyzed_at:
                return ai_analysis.analyzed_at.isoformat()
            return None
        except:
            return None


class MediaUploadSerializer(serializers.ModelSerializer):
    """媒体文件上传序列化器"""
    class Meta:
        model = Media
        fields = ('file', 'title', 'description', 'prompt', 'category_ids', 'tag_ids')
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'prompt': {'required': False, 'allow_blank': True},
        }

    category_ids = serializers.CharField(
        required=False,
        help_text="分类ID列表（JSON字符串）"
    )
    tag_ids = serializers.CharField(
        required=False,
        help_text="标签ID列表（JSON字符串）"
    )

    def validate_file(self, value):
        """验证上传的文件"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"验证文件: {value.name}, 大小: {value.size} bytes")
        
        # 检查文件大小（限制为100MB）
        max_size = 100 * 1024 * 1024  # 100MB
        if value.size > max_size:
            logger.error(f"文件太大: {value.size} > {max_size}")
            raise serializers.ValidationError(ErrorMessages.FILE_TOO_LARGE)

        # 检查文件类型
        file_extension = value.name.split('.')[-1].lower()
        allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']
        
        logger.info(f"文件扩展名: {file_extension}, 允许的扩展名: {allowed_extensions}")

        if file_extension not in allowed_extensions:
            logger.error(f"不支持的文件类型: {file_extension}")
            raise serializers.ValidationError(ErrorMessages.FILE_TYPE_NOT_SUPPORTED)

        logger.info("文件验证通过")
        return value

    def create(self, validated_data):
        """创建媒体文件"""
        import logging
        import json
        logger = logging.getLogger(__name__)

        logger.info(f"创建媒体文件，验证数据: {validated_data}")

        # 提取分类和标签ID
        category_ids_str = validated_data.pop('category_ids', '[]')
        tag_ids_str = validated_data.pop('tag_ids', '[]')

        # 解析JSON字符串
        try:
            category_ids = json.loads(category_ids_str) if category_ids_str else []
            tag_ids = json.loads(tag_ids_str) if tag_ids_str else []
        except json.JSONDecodeError as e:
            logger.error(f"解析分类/标签ID失败: {e}")
            category_ids = []
            tag_ids = []

        logger.info(f"分类ID: {category_ids}, 标签ID: {tag_ids}")

        # 创建媒体文件
        try:
            media = Media.objects.create(**validated_data)
            logger.info(f"媒体文件创建成功，ID: {media.id}")
        except Exception as e:
            logger.error(f"创建媒体文件失败: {str(e)}")
            raise

        # 添加分类
        if category_ids:
            categories = Category.objects.filter(id__in=category_ids, user=media.user)
            logger.info(f"找到分类: {categories}")
            media.categories.set(categories)

        # 添加标签
        if tag_ids:
            tags = Tag.objects.filter(id__in=tag_ids, user=media.user)
            logger.info(f"找到标签: {tags}")
            media.tags.set(tags)

        return media