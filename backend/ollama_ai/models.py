import uuid
from django.db import models
from django.contrib.auth import get_user_model
from media.models import Media, Category, Tag

User = get_user_model()


class OllamaEndpoint(models.Model):
    """Ollama服务端点配置模型"""

    name = models.CharField(
        max_length=100,
        verbose_name='端点名称'
    )

    url = models.URLField(
        verbose_name='服务端点URL'
    )

    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='描述'
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name='是否激活'
    )

    is_default = models.BooleanField(
        default=False,
        verbose_name='是否为默认端点'
    )

    timeout = models.IntegerField(
        default=300,
        verbose_name='超时时间（秒）'
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_endpoints',
        verbose_name='创建者'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'Ollama服务端点'
        verbose_name_plural = 'Ollama服务端点'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.url})"

    def save(self, *args, **kwargs):
        # 确保只有一个默认端点
        if self.is_default:
            OllamaEndpoint.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    @classmethod
    def get_default_endpoint(cls):
        """获取默认端点"""
        endpoint = cls.objects.filter(is_active=True, is_default=True).first()
        if not endpoint:
            endpoint = cls.objects.filter(is_active=True).first()
        return endpoint

    def test_connection(self):
        """测试连接"""
        try:
            from .services import OllamaClient
            client = OllamaClient(base_url=self.url, timeout=self.timeout)
            models = client.list_models()
            return {
                'success': True,
                'models_count': len(models),
                'models': [model.get('name', '') for model in models[:5]]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


class AIAnalysis(models.Model):
    """AI分析结果模型"""

    # 分析状态选择
    STATUS_CHOICES = [
        ('pending', '等待分析'),
        ('processing', '分析中'),
        ('completed', '分析完成'),
        ('failed', '分析失败'),
    ]

    # 与媒体文件关联
    media = models.OneToOneField(
        Media,
        on_delete=models.CASCADE,
        related_name='ai_analysis',
        verbose_name='媒体文件'
    )

    # 分析状态
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='分析状态'
    )

    # AI生成的内容
    ai_title = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        verbose_name='AI生成标题'
    )

    ai_description = models.TextField(
        blank=True,
        null=True,
        verbose_name='AI生成描述'
    )

    ai_prompt = models.TextField(
        blank=True,
        null=True,
        verbose_name='AI生成提示词'
    )

    # 分析时使用的模型
    model_used = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='使用的AI模型'
    )

    # 分析结果（JSON格式，存储详细的AI响应）
    analysis_result = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='分析结果详情'
    )

    # 错误信息
    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name='错误信息'
    )

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    analyzed_at = models.DateTimeField(null=True, blank=True, verbose_name='分析完成时间')

    class Meta:
        verbose_name = 'AI分析'
        verbose_name_plural = 'AI分析'

    def __str__(self):
        return f"AI分析 - {self.media.title or self.media.file.name}"

    def mark_completed(self, model_name=None):
        """标记分析完成"""
        from django.utils import timezone
        self.status = 'completed'
        self.analyzed_at = timezone.now()
        if model_name:
            self.model_used = model_name
        self.save()

    def mark_failed(self, error_message):
        """标记分析失败"""
        from django.utils import timezone
        self.status = 'failed'
        self.error_message = error_message
        self.analyzed_at = timezone.now()
        self.save()


class SuggestedCategory(models.Model):
    """AI建议的分类模型"""

    ai_analysis = models.ForeignKey(
        AIAnalysis,
        on_delete=models.CASCADE,
        related_name='suggested_categories',
        verbose_name='AI分析'
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='ai_suggestions',
        verbose_name='分类'
    )

    confidence = models.FloatField(
        default=0.0,
        verbose_name='置信度'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '建议分类'
        verbose_name_plural = '建议分类'
        unique_together = ['ai_analysis', 'category']

    def __str__(self):
        return f"{self.category.name} (置信度: {self.confidence:.2f})"


class SuggestedTag(models.Model):
    """AI建议的标签模型"""

    ai_analysis = models.ForeignKey(
        AIAnalysis,
        on_delete=models.CASCADE,
        related_name='suggested_tags',
        verbose_name='AI分析'
    )

    tag = models.ForeignKey(
        Tag,
        on_delete=models.CASCADE,
        related_name='ai_suggestions',
        verbose_name='标签'
    )

    confidence = models.FloatField(
        default=0.0,
        verbose_name='置信度'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '建议标签'
        verbose_name_plural = '建议标签'
        unique_together = ['ai_analysis', 'tag']

    def __str__(self):
        return f"{self.tag.name} (置信度: {self.confidence:.2f})"


class OllamaModel(models.Model):
    """Ollama模型配置"""

    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name='模型名称'
    )

    display_name = models.CharField(
        max_length=100,
        verbose_name='显示名称'
    )

    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='模型描述'
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name='是否启用'
    )

    is_vision_capable = models.BooleanField(
        default=False,
        verbose_name='是否支持视觉分析'
    )

    model_size = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='模型大小'
    )

    api_endpoint = models.URLField(
        default='http://115.190.140.100:31434',
        verbose_name='API端点'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'Ollama模型'
        verbose_name_plural = 'Ollama模型'

    def __str__(self):
        return f"{self.display_name} ({self.name})"

    @classmethod
    def get_active_vision_models(cls):
        """获取所有支持视觉的活跃模型"""
        return cls.objects.filter(is_active=True, is_vision_capable=True)


class BatchAnalysisJob(models.Model):
    """批量分析任务模型"""

    STATUS_CHOICES = [
        ('pending', '等待中'),
        ('running', '进行中'),
        ('completed', '已完成'),
        ('failed', '失败'),
        ('cancelled', '已取消'),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='batch_analysis_jobs',
        verbose_name='创建者'
    )

    model = models.ForeignKey(
        OllamaModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='使用的模型'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='状态'
    )

    total_files = models.IntegerField(
        default=0,
        verbose_name='总文件数'
    )

    processed_files = models.IntegerField(
        default=0,
        verbose_name='已处理文件数'
    )

    failed_files = models.IntegerField(
        default=0,
        verbose_name='失败文件数'
    )

    media_files = models.ManyToManyField(
        Media,
        related_name='batch_analysis_jobs',
        verbose_name='媒体文件'
    )

    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name='错误信息'
    )

    progress_percentage = models.FloatField(
        default=0.0,
        verbose_name='完成百分比'
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='开始时间'
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='完成时间'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '批量分析任务'
        verbose_name_plural = '批量分析任务'
        ordering = ['-created_at']

    def __str__(self):
        return f"批量分析 - {self.user.username} ({self.get_status_display()})"

    def update_progress(self):
        """更新进度"""
        if self.total_files > 0:
            self.progress_percentage = (self.processed_files / self.total_files) * 100
        else:
            self.progress_percentage = 0.0
        self.save()

    def start_job(self):
        """开始任务"""
        from django.utils import timezone
        self.status = 'running'
        self.started_at = timezone.now()
        self.save()

    def complete_job(self):
        """完成任务"""
        from django.utils import timezone
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.progress_percentage = 100.0
        self.save()

    def fail_job(self, error_message):
        """任务失败"""
        from django.utils import timezone
        self.status = 'failed'
        self.error_message = error_message
        self.completed_at = timezone.now()
        self.save()
