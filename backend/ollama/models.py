from django.db import models
from django.contrib.auth import get_user_model
from media.models import Media
from django.db import transaction

User = get_user_model()

# Create your models here.

class OllamaEndpoint(models.Model):
    name = models.CharField(max_length=100, verbose_name='端点名称')
    url = models.URLField(verbose_name='服务端点URL')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    is_default = models.BooleanField(default=False, verbose_name='是否为默认端点')
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name='创建者',
        related_name='ollama_app_endpoints',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'Ollama服务端点'
        verbose_name_plural = 'Ollama服务端点'
        ordering = ['-is_default', '-created_at']
        unique_together = ['created_by', 'url']

    def __str__(self):
        return f"{self.name} ({self.url})"
        
    def save(self, *args, **kwargs):
        # 确保只有一个默认端点
        if self.is_default:
            OllamaEndpoint.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

class OllamaAIModel(models.Model):
    """Ollama模型配置 - 从Ollama端点拉取的模型信息"""

    VISION_CAPABILITIES = [
        (False, '否 - 仅支持文本'),
        (True, '是 - 支持图像和文本'),
    ]

    name = models.CharField(
        max_length=100,
        verbose_name='模型名称',
        help_text='Ollama中的模型标识，如: llama2:7b'
    )

    endpoint = models.ForeignKey(
        OllamaEndpoint,
        on_delete=models.CASCADE,
        related_name='ai_models',
        verbose_name='所属端点'
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name='是否启用'
    )

    is_vision_capable = models.BooleanField(
        default=False,
        choices=VISION_CAPABILITIES,
        verbose_name='是否支持视觉分析',
        help_text='模型是否能够处理图像输入'
    )

    is_default = models.BooleanField(
        default=False,
        verbose_name='是否为默认分析模型',
        help_text='用户创建分析任务时的默认选择'
    )

    # Ollama API返回的模型信息
    model_size = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='模型大小',
        help_text='从Ollama API获取的模型大小信息'
    )

    digest = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='模型摘要',
        help_text='Ollama模型的唯一标识'
    )

    modified_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='修改时间',
        help_text='Ollama模型的最后修改时间'
    )

    # 用于存储Ollama API返回的完整信息（JSON格式）
    ollama_info = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Ollama详细信息',
        help_text='从Ollama API获取的完整模型信息'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'Ollama模型'
        verbose_name_plural = 'Ollama模型'
        ordering = ['-is_default', 'name']
        unique_together = ['name', 'endpoint']  # 同一端点下模型名称唯一
        indexes = [
            models.Index(fields=['is_active', 'is_vision_capable']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.endpoint.name})"

    def save(self, *args, **kwargs):
        # 确保只有一个默认模型
        if self.is_default:
            OllamaAIModel.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class OllamaImageAnalysis(models.Model):
    """Ollama图片分析任务状态记录模型"""

    STATUS_CHOICES = [
        ('pending', '等待中'),
        ('processing', '处理中'),
        ('completed', '已完成'),
        ('failed', '失败'),
        ('cancelled', '已取消'),
    ]

    # 关联的媒体文件
    media = models.ForeignKey(
        Media,
        on_delete=models.CASCADE,
        related_name='ollama_analyses',
        verbose_name='媒体文件'
    )

    # 使用的模型
    model = models.ForeignKey(
        OllamaAIModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
        verbose_name='使用的模型'
    )

    # 任务状态
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='任务状态',
        db_index=True
    )

    # 异步任务ID
    task_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='异步任务ID',
        help_text='后台异步任务的唯一标识',
        db_index=True
    )

    # 分析选项
    analysis_options = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='分析选项',
        help_text='图片分析的配置参数'
    )

    # 使用的提示词
    prompt = models.TextField(
        blank=True,
        null=True,
        verbose_name='分析提示词'
    )

    # 错误信息
    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name='错误信息'
    )

    # 重试次数
    retry_count = models.IntegerField(
        default=0,
        verbose_name='重试次数'
    )

    # 处理时间（毫秒）
    processing_time = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='处理时间(毫秒)'
    )

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    started_at = models.DateTimeField(null=True, blank=True, verbose_name='开始处理时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')

    class Meta:
        verbose_name = 'Ollama分析任务状态'
        verbose_name_plural = 'Ollama分析任务状态'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['media', 'status']),
            models.Index(fields=['task_id']),
        ]

    def __str__(self):
        return f"分析任务 - {self.media.title or self.media.file.name} ({self.status})"

    @property
    def is_task_running(self):
        """检查任务是否正在运行"""
        if not self.task_id:
            return False
        try:
            from django_async_manager.models import Task
            task = Task.objects.get(id=self.task_id)
            return task.status == 'in_progress'
        except:
            return False

    @property
    def task_progress(self):
        """获取任务进度百分比"""
        progress_map = {
            'pending': 0,
            'processing': 50,
            'completed': 100,
            'failed': 0,
            'cancelled': 0,
        }
        return progress_map.get(self.status, 0)

    def get_processing_duration(self):
        """获取处理耗时（秒）"""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def can_retry(self):
        """判断是否可以重试"""
        return (
            self.status in ['failed', 'cancelled'] and
            self.retry_count < 3
        )

    def mark_as_started(self):
        """标记任务开始"""
        from django.utils import timezone
        self.status = 'processing'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])

    def mark_as_completed(self, processing_time_ms=None):
        """标记任务完成"""
        from django.utils import timezone
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.processing_time = processing_time_ms
        self.save()

    def mark_as_failed(self, error_message=None):
        """标记任务失败"""
        from django.utils import timezone
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = timezone.now()
        self.save()

    def increment_retry(self):
        """增加重试次数"""
        self.retry_count += 1
        self.status = 'pending'
        self.error_message = None
        self.task_id = None
        self.started_at = None
        self.completed_at = None
        self.save()

    def update_media_with_analysis_result(self, result_data):
        """将分析结果更新到媒体模型字段上"""
        if not self.media:
            return

        # 更新媒体模型的AI分析相关字段
        from django.utils import timezone

        # 假设Media模型有这些字段，根据实际字段名调整
        if hasattr(self.media, 'ai_title') and 'title' in result_data:
            self.media.ai_title = result_data['title']
        if hasattr(self.media, 'ai_description') and 'description' in result_data:
            self.media.ai_description = result_data['description']
        if hasattr(self.media, 'ai_tags') and 'tags' in result_data:
            # 处理标签逻辑
            pass
        if hasattr(self.media, 'ai_categories') and 'categories' in result_data:
            # 处理分类逻辑
            pass
        if hasattr(self.media, 'ai_prompt') and 'prompt' in result_data:
            self.media.ai_prompt = result_data['prompt']

        # 标记AI分析完成时间
        if hasattr(self.media, 'ai_analyzed_at'):
            self.media.ai_analyzed_at = timezone.now()

        # 保存媒体模型更新
        self.media.save()