import logging
import os
from io import BytesIO
from PIL import Image
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import Media, Category

logger = logging.getLogger(__name__)

# 缩略图尺寸
THUMBNAIL_SIZE = (300, 300)


def generate_thumbnail(image_file, size=THUMBNAIL_SIZE):
    """
    为上传的图片生成缩略图

    Args:
        image_file: 上传的图片文件
        size: 缩略图尺寸，默认为 300x300

    Returns:
        InMemoryUploadedFile: 生成的缩略图文件
    """
    img = Image.open(image_file)

    # 转换为 RGB 模式（处理 PNG 等）
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # 生成缩略图，保持宽高比
    img.thumbnail(size, Image.Resampling.LANCZOS)

    # 保存到内存
    thumb_io = BytesIO()
    img.save(thumb_io, format='JPEG', quality=85)
    thumb_io.seek(0)

    # 构造文件名
    name, ext = os.path.splitext(image_file.name)
    thumbnail_name = f'{name}_thumb.jpg'

    return InMemoryUploadedFile(
        thumb_io,
        None,
        thumbnail_name,
        'image/jpeg',
        thumb_io.getbuffer().nbytes,
        None
    )


class CategorySerializer(serializers.ModelSerializer):
    """分类序列化器"""
    media_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'media_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_media_count(self, obj):
        """获取该分类下的媒体数量"""
        return obj.media_files.count()


class CategoryCreateSerializer(serializers.ModelSerializer):
    """分类创建序列化器"""

    class Meta:
        model = Category
        fields = ['name', 'description']


class MediaSerializer(serializers.ModelSerializer):
    """媒体文件序列化器"""
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    file_url = serializers.CharField(read_only=True)
    thumbnail_url = serializers.CharField(read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    file_size_mb = serializers.SerializerMethodField()
    analysis_id = serializers.SerializerMethodField()
    analysis_status = serializers.SerializerMethodField()
    analysis_description = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = [
            'id', 'type', 'type_display',
            'file', 'file_url', 'filename', 'file_hash', 'file_size', 'file_size_mb', 'mime_type',
            'width', 'height',
            'thumbnail', 'thumbnail_url',
            'category', 'category_name',
            'owner', 'owner_name',
            'created_at', 'updated_at',
            'analysis_id', 'analysis_status', 'analysis_description',
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at', 'file_hash']

    def get_file_size_mb(self, obj):
        return round(obj.file_size / 1024 / 1024, 2)

    def _get_latest_analysis(self, obj):
        """获取最新分析记录（带缓存）"""
        # 使用对象级别的缓存避免重复查询
        cache_key = '_cached_latest_analysis'
        if not hasattr(obj, cache_key):
            setattr(obj, cache_key, obj.analyses.order_by('-created_at').first())
        return getattr(obj, cache_key)

    def get_analysis_id(self, obj):
        """获取最新分析记录的ID"""
        latest_analysis = self._get_latest_analysis(obj)
        return latest_analysis.id if latest_analysis else None

    def get_analysis_status(self, obj):
        """获取最新的分析状态"""
        latest_analysis = self._get_latest_analysis(obj)
        return latest_analysis.status if latest_analysis else None

    def get_analysis_description(self, obj):
        """获取最新的分析描述"""
        latest_analysis = self._get_latest_analysis(obj)
        return latest_analysis.description if latest_analysis else None


class MediaCreateSerializer(serializers.ModelSerializer):
    """媒体文件创建序列化器"""
    category_name = serializers.CharField(write_only=True, required=False, allow_null=True)
    # 从上传文件自动获取，不需要前端传递
    file_size = serializers.IntegerField(required=False)
    mime_type = serializers.CharField(required=False)

    class Meta:
        model = Media
        fields = [
            'file', 'filename', 'file_size', 'mime_type',
            'width', 'height', 'thumbnail',
            'category_name',
        ]

    def validate(self, attrs):
        """从上传的文件自动提取文件大小和MIME类型"""
        file = attrs.get('file')
        if file:
            # 自动设置文件大小
            if 'file_size' not in attrs or attrs['file_size'] is None:
                attrs['file_size'] = file.size
            # 自动设置MIME类型
            if 'mime_type' not in attrs or attrs['mime_type'] is None:
                attrs['mime_type'] = file.content_type or 'application/octet-stream'
        return attrs

    def create(self, validated_data):
        category_name = validated_data.pop('category_name', None)
        file = validated_data.get('file')
        request = self.context.get('request')

        # 处理分类
        category = None
        if category_name:
            category, _ = Category.objects.get_or_create(name=category_name)

        # 计算文件哈希并检查重复
        file_hash = None
        thumbnail_file = None
        if file:
            try:
                # 读取文件到内存
                file.seek(0)
                image_data = file.read()

                # 计算文件哈希
                file_hash = Media.calculate_file_hash(BytesIO(image_data))

                # 检查当前用户是否已有相同文件
                if request and request.user:
                    existing_media = Media.objects.filter(
                        owner=request.user,
                        file_hash=file_hash
                    ).first()
                    if existing_media:
                        # 文件已存在，直接返回
                        return existing_media

                validated_data['file_hash'] = file_hash

                # 从内存数据获取尺寸
                img = Image.open(BytesIO(image_data))
                validated_data['width'] = img.width
                validated_data['height'] = img.height
                img.close()

                # 生成缩略图
                thumbnail_file = generate_thumbnail(InMemoryUploadedFile(
                    BytesIO(image_data),
                    None,
                    file.name,
                    file.content_type,
                    len(image_data),
                    None
                ))
            except Exception as e:
                # 如果无法读取图片，设置为 None
                validated_data['width'] = None
                validated_data['height'] = None
                logger.warning(f"图片处理失败: {e}")

        # 创建媒体文件
        media = Media.objects.create(**validated_data, category=category)

        # 保存缩略图
        if thumbnail_file:
            try:
                media.thumbnail.save(thumbnail_file.name, thumbnail_file, save=True)
            except Exception as e:
                logger.warning(f"缩略图保存失败: {e}")

        return media


class MediaUpdateSerializer(serializers.ModelSerializer):
    """媒体文件更新序列化器"""
    category_name = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Media
        fields = [
            'filename', 'category', 'category_name',
        ]

    def update(self, instance, validated_data):
        category_name = validated_data.pop('category_name', None)

        # 更新基础字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 更新分类
        if category_name is not None:
            if category_name:
                category, _ = Category.objects.get_or_create(name=category_name)
                instance.category = category
            else:
                instance.category = None
            instance.save()

        return instance


class BatchDeleteSerializer(serializers.Serializer):
    """批量删除序列化器"""
    media_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text='要删除的媒体 ID 列表'
    )
