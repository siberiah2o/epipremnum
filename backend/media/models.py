import os
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.utils import timezone

User = get_user_model()


def user_media_path(instance, filename):
    """
    生成用户媒体文件的存储路径
    格式: media/images/{user_id}/{year}/{month}/{uuid}_{ext} 或 media/videos/{user_id}/{year}/{month}/{uuid}_{ext}
    """
    now = timezone.now()
    file_type = 'images' if instance.file_type == 'image' else 'videos'

    # 生成唯一的文件名
    file_extension = os.path.splitext(filename)[1]  # 获取文件扩展名
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"  # 使用UUID生成唯一文件名

    return os.path.join(
        file_type,
        str(instance.user.id),
        str(now.year),
        str(now.month),
        unique_filename
    )


def thumbnail_path(instance, filename):
    """
    生成视频缩略图的存储路径
    格式: media/videos/{user_id}/{year}/{month}/thumbnails/{uuid}_{ext}
    """
    now = timezone.now()

    # 生成唯一的缩略图文件名
    file_extension = os.path.splitext(filename)[1]  # 获取文件扩展名
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"  # 使用UUID生成唯一文件名

    return os.path.join(
        'videos',
        str(instance.user.id),
        str(now.year),
        str(now.month),
        'thumbnails',
        unique_filename
    )


class Category(models.Model):
    """媒体内容分类模型"""
    name = models.CharField(max_length=100, verbose_name='分类名称')
    description = models.TextField(blank=True, null=True, verbose_name='分类描述')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_categories', verbose_name='创建者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        unique_together = ['user', 'name']  # 同一用户下分类名称唯一

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Tag(models.Model):
    """媒体内容标签模型"""
    name = models.CharField(max_length=50, verbose_name='标签名称')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_tags', verbose_name='创建者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '标签'
        verbose_name_plural = '标签'
        unique_together = ['user', 'name']  # 同一用户下标签名称唯一

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Media(models.Model):
    """媒体内容模型"""
    FILE_TYPE_CHOICES = [
        ('image', '图片'),
        ('video', '视频'),
    ]

    title = models.CharField(max_length=200, blank=True, null=True, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    prompt = models.TextField(blank=True, null=True, verbose_name='提示词')  # 仅对图片有效
    file = models.FileField(upload_to=user_media_path, verbose_name='文件')
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, verbose_name='文件类型')
    file_size = models.BigIntegerField(verbose_name='文件大小(字节)')
    thumbnail = models.FileField(upload_to=thumbnail_path, blank=True, null=True, verbose_name='缩略图')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_files', verbose_name='上传者')
    categories = models.ManyToManyField(Category, blank=True, related_name='media_files', verbose_name='分类')
    tags = models.ManyToManyField(Tag, blank=True, related_name='media_files', verbose_name='标签')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '媒体文件'
        verbose_name_plural = '媒体文件'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title or self.file.name}"

    def save(self, *args, **kwargs):
        # 保存文件大小
        if self.file and not self.file_size:
            self.file_size = self.file.size
        
        # 根据文件扩展名自动设置文件类型
        if self.file and not self.file_type:
            file_extension = os.path.splitext(self.file.name)[1].lower()
            if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                self.file_type = 'image'
            elif file_extension in ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']:
                self.file_type = 'video'
            else:
                raise ValueError('不支持的文件类型')

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # 删除文件和缩略图
        if self.file:
            if default_storage.exists(self.file.name):
                default_storage.delete(self.file.name)
        
        if self.thumbnail:
            if default_storage.exists(self.thumbnail.name):
                default_storage.delete(self.thumbnail.name)
        
        super().delete(*args, **kwargs)

    @property
    def file_url(self):
        """获取文件URL"""
        return self.file.url if self.file else None

    @property
    def thumbnail_url(self):
        """获取缩略图URL"""
        return self.thumbnail.url if self.thumbnail else None
