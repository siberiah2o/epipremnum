from django.db import models
from django.contrib.auth import get_user_model
from media.models import Media, Category, Tag
from django.db import transaction

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
        related_name='ollama_endpoints',
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

    def test_connection(self):
        """测试端点连接，返回可用模型列表"""
        try:
            from .services import OllamaClient
            client = OllamaClient(base_url=self.url, timeout=self.timeout)
            models = client.list_models()
            return {
                'success': True,
                'models_count': len(models),
                'models': [model.get('name', '') for model in models[:10]]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


class AIModel(models.Model):
    """AI模型配置"""

    name = models.CharField(
        max_length=100,
        verbose_name='模型名称'
    )

    display_name = models.CharField(
        max_length=100,
        verbose_name='显示名称'
    )

    endpoint = models.ForeignKey(
        OllamaEndpoint,
        on_delete=models.CASCADE,
        related_name='models',
        verbose_name='所属端点'
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name='是否启用'
    )

    is_vision_capable = models.BooleanField(
        default=False,
        verbose_name='是否支持视觉'
    )

    is_default = models.BooleanField(
        default=False,
        verbose_name='是否为默认模型'
    )

    model_size = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name='模型大小'
    )

    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='模型描述'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = 'AI模型'
        verbose_name_plural = 'AI模型'
        ordering = ['-is_default', 'display_name']
        unique_together = ['name', 'endpoint']  # 同一端点下模型名称唯一

    def __str__(self):
        return f"{self.display_name} ({self.endpoint.name})"

    def save(self, *args, **kwargs):
        # 确保只有一个默认模型
        if self.is_default:
            AIModel.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    @classmethod
    def get_default_model(cls):
        """获取默认模型"""
        return cls.objects.filter(
            is_active=True,
            is_default=True,
            is_vision_capable=True
        ).first()

    @classmethod
    def get_active_vision_models(cls):
        """获取所有支持视觉的活跃模型"""
        return cls.objects.filter(is_active=True, is_vision_capable=True)


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

  # 任务ID（用于跟踪异步任务状态）
    task_id = models.CharField(
        max_length=32,
        blank=True,
        null=True,
        verbose_name='任务ID',
        help_text='异步任务ID，用于跟踪任务状态'
    )

    # 分析状态
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        verbose_name='分析状态'
    )

    # 分析时使用的模型
    model_used = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='使用的AI模型'
    )

    # 分析选项（JSON格式存储）
    analysis_options = models.JSONField(
        blank=True,
        null=True,
        verbose_name='分析选项',
        help_text='分析时使用的配置选项'
    )

    # 分析结果
    title = models.TextField(
        blank=True,
        null=True,
        verbose_name='生成标题'
    )

    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='生成描述'
    )

    prompt = models.TextField(
        blank=True,
        null=True,
        verbose_name='生成提示词'
    )

    # 建议的分类和标签
    suggested_categories = models.ManyToManyField(
        Category,
        blank=True,
        verbose_name='建议分类'
    )

    suggested_tags = models.ManyToManyField(
        Tag,
        blank=True,
        verbose_name='建议标签'
    )

    # 错误信息
    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name='错误信息'
    )

    # 是否已应用到素材库
    applied_to_media = models.BooleanField(
        default=False,
        verbose_name='是否已应用到素材库'
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

    @property
    def is_task_running(self):
        """检查任务是否正在运行"""
        if not self.task_id:
            return False

        try:
            from django_async_manager.models import AsyncTask
            task = AsyncTask.objects.get(id=self.task_id)
            return task.status == 'RUNNING'
        except:
            return False

    @property
    def task_progress(self):
        """获取任务进度"""
        if self.status == 'pending':
            return 0
        elif self.status == 'processing':
            return 50
        elif self.status == 'completed':
            return 100
        elif self.status == 'failed':
            return 0
        return 0

    def save(self, *args, **kwargs):
        """
        重写保存方法，添加 model_used 字段保护
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # 如果是更新操作且状态为处理中，检查 model_used 是否被修改
        if self.pk and self.status == 'processing':
            try:
                # 获取数据库中的原始记录
                old_instance = AIAnalysis.objects.get(pk=self.pk)
                old_model_used = old_instance.model_used
                
                # 如果 model_used 被修改且不是显式更新，记录警告
                if old_model_used != self.model_used and 'model_used' not in kwargs.get('update_fields', []):
                    logger.warning(f"🚨 [SAVE] 检测到 model_used 字段在处理状态下被意外修改: {old_model_used} -> {self.model_used}")
                    logger.warning(f"🚨 [SAVE] 调用栈信息:", exc_info=True)
                    
                    # 恢复原始模型名称
                    self.model_used = old_model_used
                    logger.info(f"🔧 [SAVE] 已恢复原始模型名称: {old_model_used}")
            except AIAnalysis.DoesNotExist:
                # 新记录，不需要检查
                pass
            except Exception as e:
                logger.error(f"❌ [SAVE] 检查 model_used 字段时出错: {str(e)}")
        
        # 调用父类保存方法
        super().save(*args, **kwargs)
    
    def apply_to_media(self):
        """将分析结果应用到媒体文件"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔧 [APPLY] 开始应用分析结果到媒体文件: analysis_id={self.id}, media_id={self.media.id}")
        
        if self.status != 'completed':
            logger.warning(f"🔧 [APPLY] 分析状态未完成，无法应用: status={self.status}")
            return False

        try:
            with transaction.atomic():
                # 记录原始媒体文件数据
                logger.info(f"🔧 [APPLY] 原始媒体文件数据: title='{self.media.title}', has_description={bool(self.media.description)}, has_prompt={bool(self.media.prompt)}")
                
                # 记录分析结果数据
                logger.info(f"🔧 [APPLY] 分析结果数据: title='{self.title}', has_description={bool(self.description)}, has_prompt={bool(self.prompt)}")
                logger.info(f"🔧 [APPLY] 分类数量: {self.suggested_categories.count()}, 标签数量: {self.suggested_tags.count()}")
                
                # 应用标题
                if self.title:
                    logger.info(f"🔧 [APPLY] 应用标题: '{self.media.title}' -> '{self.title}'")
                    self.media.title = self.title
                else:
                    logger.info(f"🔧 [APPLY] 标题为空，不更新")

                # 应用描述
                if self.description:
                    logger.info(f"🔧 [APPLY] 应用描述: {bool(self.media.description)} -> True")
                    self.media.description = self.description
                else:
                    logger.info(f"🔧 [APPLY] 描述为空，不更新")

                # 应用提示词
                if self.prompt:
                    logger.info(f"🔧 [APPLY] 应用提示词: {bool(self.media.prompt)} -> True")
                    self.media.prompt = self.prompt
                else:
                    logger.info(f"🔧 [APPLY] 提示词为空，不更新")

                # 应用分类和标签
                if self.suggested_categories.exists():
                    categories = list(self.suggested_categories.all())
                    category_names = [cat.name for cat in categories]
                    logger.info(f"🔧 [APPLY] 应用分类: {category_names}")
                    self.media.categories.add(*categories)
                else:
                    logger.info(f"🔧 [APPLY] 没有建议分类")

                if self.suggested_tags.exists():
                    tags = list(self.suggested_tags.all())
                    tag_names = [tag.name for tag in tags]
                    logger.info(f"🔧 [APPLY] 应用标签: {tag_names}")
                    self.media.tags.add(*tags)
                else:
                    logger.info(f"🔧 [APPLY] 没有建议标签")

                # 保存媒体文件
                logger.info(f"🔧 [APPLY] 保存媒体文件...")
                self.media.save()
                
                # 记录更新后的媒体文件数据
                logger.info(f"🔧 [APPLY] 更新后媒体文件数据: title='{self.media.title}', has_description={bool(self.media.description)}, has_prompt={bool(self.media.prompt)}")
                logger.info(f"🔧 [APPLY] 更新后分类数量: {self.media.categories.count()}, 标签数量: {self.media.tags.count()}")
                
                # 标记分析结果已应用
                self.applied_to_media = True
                self.save(update_fields=['applied_to_media'])
                
                logger.info(f"🔧 [APPLY] 分析结果应用完成: analysis_id={self.id}, applied_to_media={self.applied_to_media}")
                return True
                
        except Exception as e:
            logger.error(f"🔧 [APPLY] 应用分析结果失败: {str(e)}", exc_info=True)
            return False