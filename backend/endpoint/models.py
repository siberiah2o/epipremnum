from django.db import models
from django.contrib.auth import get_user_model
from media.models import Media
from django.db import transaction

User = get_user_model()


class OllamaEndpoint(models.Model):
    """AI模型端点配置 - 支持多种供应商"""

    PROVIDER_CHOICES = [
        ('ollama', 'Ollama - 本地部署'),
        ('zhipu', '智谱AI'),
        ('openai', 'OpenAI'),
        ('azure', 'Azure OpenAI'),
        ('anthropic', 'Anthropic Claude'),
        ('custom', '自定义API'),
    ]

    AUTH_TYPE_CHOICES = [
        ('none', '无需认证'),
        ('api_key', 'API Key'),
        ('bearer_token', 'Bearer Token'),
    ]

    name = models.CharField(max_length=100, verbose_name='端点名称')
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default='ollama',
        verbose_name='供应商类型'
    )
    url = models.URLField(verbose_name='服务端点URL')
    api_key = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name='API Key',
        help_text='智谱AI等云服务需要提供API Key'
    )
    auth_type = models.CharField(
        max_length=20,
        choices=AUTH_TYPE_CHOICES,
        default='none',
        verbose_name='认证类型'
    )
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    is_default = models.BooleanField(default=False, verbose_name='是否为默认端点')
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name='创建者',
        related_name='endpoint_app_endpoints',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'AI模型端点'
        verbose_name_plural = 'AI模型端点'
        ordering = ['-is_default', '-created_at']
        unique_together = ['created_by', 'url']

    def __str__(self):
        return f"{self.name} ({self.get_provider_display()})"

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
