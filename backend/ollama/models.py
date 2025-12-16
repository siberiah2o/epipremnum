from django.db import models
from django.contrib.auth import get_user_model
from media.models import Media
from django.db import transaction

# 导入已迁移的模型
from endpoint.models import OllamaEndpoint, OllamaAIModel

User = get_user_model()

# Create your models here.


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

    # 分析结果
    analysis_results = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='分析结果',
        help_text='图片分析的结果数据'
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
        """标记任务开始（使用原子状态管理）"""
        from .tasks.state_manager import state_manager
        state_manager.update_analysis_status(
            analysis_id=self.id,
            from_status='pending',
            to_status='processing'
        )

    def mark_as_completed(self, processing_time_ms=None):
        """标记任务完成（使用原子状态管理）"""
        from .tasks.state_manager import state_manager
        state_manager.update_analysis_status(
            analysis_id=self.id,
            from_status='processing',
            to_status='completed',
            processing_time=processing_time_ms
        )

    def mark_as_failed(self, error_message=None):
        """标记任务失败（使用原子状态管理）"""
        from .tasks.state_manager import state_manager
        state_manager.update_analysis_status(
            analysis_id=self.id,
            from_status=None,  # 允许从任何状态转换为失败
            to_status='failed',
            error_message=error_message
        )

    def increment_retry(self):
        """增加重试次数（使用原子状态管理）"""
        from .tasks.state_manager import state_manager
        state_manager.increment_retry_count(self.id)

    def update_media_with_analysis_result(self, result_data):
        """将分析结果更新到媒体模型字段上（使用原子状态管理）"""
        if not self.media:
            return

        # 使用原子状态管理器更新媒体
        from .tasks.state_manager import state_manager
        state_manager.update_media_with_analysis_result(self, result_data)