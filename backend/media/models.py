import hashlib
from django.db import models
from django.conf import settings


class Category(models.Model):
    """媒体分类模型"""
    name = models.CharField(max_length=100, unique=True, verbose_name='分类名称')
    description = models.TextField(blank=True, verbose_name='分类描述')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ['name']

    def __str__(self):
        return self.name


class Media(models.Model):
    """媒体文件模型（图片）"""

    class MediaType(models.TextChoices):
        IMAGE = 'image', '图片'

    # 基础信息
    type = models.CharField(
        max_length=10,
        choices=MediaType.choices,
        default=MediaType.IMAGE,
        verbose_name='媒体类型'
    )
    file = models.FileField(upload_to='media/%Y/%m/', verbose_name='文件路径')
    filename = models.CharField(max_length=255, verbose_name='原始文件名')
    file_hash = models.CharField(max_length=64, unique=True, null=True, blank=True, verbose_name='文件哈希(SHA256)')
    file_size = models.BigIntegerField(verbose_name='文件大小(字节)')
    mime_type = models.CharField(max_length=100, verbose_name='MIME类型')

    # 图片属性
    width = models.IntegerField(null=True, blank=True, verbose_name='宽度(像素)')
    height = models.IntegerField(null=True, blank=True, verbose_name='高度(像素)')

    # 缩略图
    thumbnail = models.FileField(
        upload_to='media/thumbnails/%Y/%m/',
        null=True,
        blank=True,
        verbose_name='缩略图'
    )

    # 组织结构
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='media_files',
        verbose_name='分类'
    )

    # 所属用户
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='media_files',
        verbose_name='所有者'
    )

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '媒体文件'
        verbose_name_plural = '媒体文件'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['owner']),
            models.Index(fields=['created_at']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['file_hash']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'file_hash'],
                name='unique_owner_file_hash',
                violation_error_message='该图片已存在'
            )
        ]

    def __str__(self):
        return f"{self.get_type_display()}: {self.filename}"

    @property
    def file_url(self):
        """获取文件访问URL"""
        return self.file.url if self.file else None

    @property
    def thumbnail_url(self):
        """获取缩略图访问URL"""
        return self.thumbnail.url if self.thumbnail else None

    def delete(self, *args, **kwargs):
        """删除媒体文件时同时删除物理文件"""
        # 删除缩略图
        if self.thumbnail:
            self.thumbnail.delete(save=False)
        # 删除主文件
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)

    @staticmethod
    def calculate_file_hash(file):
        """
        计算文件的 SHA256 哈希值

        Args:
            file: 文件对象（可以是 UploadedFile 或文件路径）

        Returns:
            str: 十六进制的 SHA256 哈希值
        """
        sha256_hash = hashlib.sha256()

        # 如果是 Django UploadedFile，需要先重置指针
        if hasattr(file, 'seek'):
            file.seek(0)
            for chunk in iter(lambda: file.read(8192), b''):
                sha256_hash.update(chunk)
            file.seek(0)  # 重置指针以便后续读取
        else:
            # 处理文件路径
            with open(file, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    sha256_hash.update(chunk)

        return sha256_hash.hexdigest()
