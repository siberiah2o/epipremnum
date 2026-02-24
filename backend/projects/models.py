from django.db import models
from django.conf import settings


class Project(models.Model):
    """项目模型"""

    # 基础信息
    name = models.CharField(max_length=200, verbose_name='项目名称')
    description = models.TextField(blank=True, verbose_name='项目描述')

    # 封面图片（可选）
    cover_image = models.ForeignKey(
        'media.Media',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cover_for_projects',
        verbose_name='封面图片'
    )

    # 所属用户
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
        verbose_name='所有者'
    )

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '项目'
        verbose_name_plural = '项目'
        ordering = ['-updated_at', '-created_at']
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['created_at']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['updated_at']),
        ]

    def __str__(self):
        return self.name

    @property
    def media_count(self):
        """获取项目中的媒体数量"""
        return self.project_media.count()


class ProjectMedia(models.Model):
    """项目-媒体关联模型（多对多关系的中间表）"""

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='project_media',
        verbose_name='项目'
    )

    media = models.ForeignKey(
        'media.Media',
        on_delete=models.CASCADE,
        related_name='project_media',
        verbose_name='媒体文件'
    )

    # 在项目中的排序顺序
    order = models.IntegerField(default=0, verbose_name='排序顺序')

    # 备注信息
    notes = models.TextField(blank=True, verbose_name='备注')

    # 添加时间
    added_at = models.DateTimeField(auto_now_add=True, verbose_name='添加时间')

    class Meta:
        verbose_name = '项目媒体'
        verbose_name_plural = '项目媒体'
        ordering = ['order', '-added_at']
        unique_together = [['project', 'media']]
        indexes = [
            models.Index(fields=['project']),
            models.Index(fields=['media']),
            models.Index(fields=['order']),
        ]

    def __str__(self):
        return f"{self.project.name} - {self.media.filename}"
