from django.db import models
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class ProviderType(models.TextChoices):
    """API 提供商类型"""
    OLLAMA = 'ollama', 'Ollama'
    OPENAI = 'openai', 'OpenAI Compatible'
    ZHIPU = 'zhipu', '智谱 AI'


class AnalysisStatus(models.TextChoices):
    """分析状态"""
    PENDING = 'pending', '待处理'
    PROCESSING = 'processing', '分析中'
    COMPLETED = 'completed', '已完成'
    FAILED = 'failed', '失败'
    CANCELLED = 'cancelled', '已取消'


class ErrorType(models.TextChoices):
    """错误类型"""
    NONE = 'none', '无错误'
    NETWORK = 'network', '网络错误'
    API = 'api', 'API错误'
    PERMISSION = 'permission', '权限错误'
    VALIDATION = 'validation', '验证错误'
    TIMEOUT = 'timeout', '超时'
    RATE_LIMIT = 'rate_limit', '频率限制'
    UNKNOWN = 'unknown', '未知错误'


class Endpoint(models.Model):
    """
    API 端点模型

    API Key 会自动加密存储，读取时自动解密
    """

    name = models.CharField(max_length=100, verbose_name='名称')
    provider_type = models.CharField(
        max_length=20,
        choices=ProviderType.choices,
        default=ProviderType.OPENAI,
        verbose_name='提供商类型'
    )
    base_url = models.URLField(max_length=500, verbose_name='Base URL')

    # 内部存储字段（可能加密）
    _api_key = models.CharField(
        max_length=500,
        blank=True,
        db_column='api_key',
        verbose_name='API Key（加密存储）'
    )

    is_default = models.BooleanField(default=False, verbose_name='是否默认端点')

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='endpoints',
        verbose_name='所有者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'API端点'
        verbose_name_plural = 'API端点'
        ordering = ['-is_default', '-created_at']
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['-is_default']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return self.name

    @property
    def api_key(self) -> str:
        """
        获取解密后的 API Key

        Returns:
            str: 解密后的 API Key，如果解密失败返回空字符串
        """
        if not self._api_key:
            return ""

        from llm.encryption import EncryptionService

        try:
            service = EncryptionService.get_instance()
            return service.decrypt(self._api_key)
        except Exception as e:
            logger.warning(f"API Key 解密失败: endpoint_id={self.id}, error={str(e)}")
            return ""

    @api_key.setter
    def api_key(self, value: str):
        """
        设置并加密 API Key

        Args:
            value: 明文 API Key
        """
        if not value:
            self._api_key = ""
            return

        from llm.encryption import EncryptionService

        service = EncryptionService.get_instance()

        # 如果已经加密，直接存储
        if service.is_encrypted(value):
            self._api_key = value
        else:
            # 否则加密后存储
            self._api_key = service.encrypt(value)

    def save(self, *args, **kwargs):
        """保存时确保 API Key 已加密"""
        # 如果 _api_key 有值但未加密，进行加密
        if self._api_key:
            from llm.encryption import EncryptionService
            service = EncryptionService.get_instance()
            if not service.is_encrypted(self._api_key):
                self._api_key = service.encrypt(self._api_key)

        super().save(*args, **kwargs)

    def get_masked_api_key(self) -> str:
        """
        获取脱敏显示的 API Key

        Returns:
            str: 脱敏后的 API Key（如 sk-xxxx...xxxx）
        """
        if not self._api_key:
            return ""

        from llm.encryption import EncryptionService
        service = EncryptionService.get_instance()
        return service.mask(self._api_key)


class AIModel(models.Model):
    """AI 模型模型 - 简化版"""

    endpoint = models.ForeignKey(
        Endpoint,
        on_delete=models.CASCADE,
        related_name='models',
        verbose_name='API端点',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=100, verbose_name='模型名称')
    is_default = models.BooleanField(default=False, verbose_name='是否默认')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'AI模型'
        verbose_name_plural = 'AI模型'
        ordering = ['-is_default', 'endpoint', 'name']
        indexes = [
            models.Index(fields=['endpoint']),
            models.Index(fields=['-is_default']),
        ]

    def __str__(self):
        endpoint_name = self.endpoint.name if self.endpoint else "未知端点"
        return f"{endpoint_name} - {self.name}"


class ImageAnalysis(models.Model):
    """图片分析结果模型"""

    # 关联关系
    media = models.ForeignKey(
        'media.Media',
        on_delete=models.CASCADE,
        related_name='analyses',
        verbose_name='媒体文件'
    )
    model = models.ForeignKey(
        AIModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analyses',
        verbose_name='AI模型'
    )
    endpoint = models.ForeignKey(
        Endpoint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analyses',
        verbose_name='API端点'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='analyses',
        verbose_name='用户'
    )

    # 分析状态
    status = models.CharField(
        max_length=20,
        choices=AnalysisStatus.choices,
        default=AnalysisStatus.PENDING,
        verbose_name='状态'
    )

    # 分析结果
    description = models.TextField(blank=True, verbose_name='图片描述')
    # 分类和标签直接从 media 关联读取，不再单独存储

    # 元数据
    method = models.CharField(max_length=50, blank=True, verbose_name='分析方法')
    tokens_used = models.IntegerField(null=True, blank=True, verbose_name='Token消耗')

    # 错误处理
    error_type = models.CharField(
        max_length=20,
        choices=ErrorType.choices,
        default=ErrorType.NONE,
        verbose_name='错误类型'
    )
    error_message = models.TextField(blank=True, verbose_name='错误信息')
    error_details = models.JSONField(default=dict, blank=True, verbose_name='错误详情')

    # 重试管理
    retry_count = models.IntegerField(default=0, verbose_name='重试次数')
    max_retries = models.IntegerField(default=3, verbose_name='最大重试次数')
    last_retry_at = models.DateTimeField(null=True, blank=True, verbose_name='最后重试时间')

    # 时间戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='完成时间')

    class Meta:
        verbose_name = '图片分析'
        verbose_name_plural = '图片分析'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['media', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['error_type']),
            models.Index(fields=['-created_at']),
            # 复合索引优化常见查询
            models.Index(fields=['user', 'status']),
            models.Index(fields=['media', 'status']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['user', 'status', '-created_at']),
        ]

    def __str__(self):
        filename = self.media.filename if self.media else "未知文件"
        return f"分析 {filename} - {self.get_status_display()}"

    def can_retry(self) -> bool:
        """判断是否可以重试"""
        return (
            self.status in [AnalysisStatus.FAILED, AnalysisStatus.CANCELLED]
            and self.retry_count < self.max_retries
        )
