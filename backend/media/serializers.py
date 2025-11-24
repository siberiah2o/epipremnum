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

    class Meta:
        model = Media
        fields = (
            'id', 'title', 'description', 'prompt', 'file', 'file_type', 'file_size',
            'thumbnail', 'file_url', 'thumbnail_url', 'user', 'categories', 'tags',
            'category_ids', 'tag_ids', 'created_at', 'updated_at'
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

    def validate(self, data):
        """验证数据"""
        if 'file' in data and not data['file']:
            raise serializers.ValidationError(ErrorMessages.FILE_REQUIRED)
        return data


class MediaListSerializer(serializers.ModelSerializer):
    """媒体文件列表序列化器（简化版）"""
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = (
            'id', 'title', 'description', 'file_type', 'file_size', 'file_url', 'thumbnail_url',
            'created_at'
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


class MediaUploadSerializer(serializers.ModelSerializer):
    """媒体文件上传序列化器"""
    class Meta:
        model = Media
        fields = ('file', 'title', 'description', 'prompt', 'category_ids', 'tag_ids')

    def validate(self, data):
        """验证上传数据"""
        if 'file' not in data or not data['file']:
            raise serializers.ValidationError(ErrorMessages.FILE_REQUIRED)
        return data