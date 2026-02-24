"""
图片分析服务

提供图片分析的核心业务逻辑，包括：
- 创建分析任务
- 执行分析
- 保存结果
- 发送通知
"""

import base64
import logging
from typing import Optional

from django.utils import timezone

from .providers import get_provider
from llm.models import (
    ImageAnalysis,
    AIModel,
    AnalysisStatus,
    ErrorType,
)
from llm.exceptions import (
    LLMException,
    MediaNotFoundError,
    ModelNotFoundError,
    AnalysisAlreadyExistsError,
    FileReadError,
    classify_exception,
)
from llm.notifications import send_analysis_update, send_stats_update

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    分析服务

    提供图片分析的完整生命周期管理：
    1. 创建分析记录 (create_analysis)
    2. 执行分析 (execute_analysis)
    3. 获取统计 (get_stats)
    """

    @staticmethod
    def create_analysis(
        media_id: int,
        model_id: int,
        user_id: int
    ) -> ImageAnalysis:
        """
        创建分析任务

        只负责：验证 -> 创建记录 -> 返回

        Args:
            media_id: 媒体文件 ID
            model_id: AI 模型 ID
            user_id: 用户 ID

        Returns:
            ImageAnalysis: 创建的分析记录

        Raises:
            MediaNotFoundError: 媒体文件不存在或无权访问
            ModelNotFoundError: 模型不存在或无权访问
            AnalysisAlreadyExistsError: 已有待处理的分析任务
        """
        # 验证媒体文件
        media = AnalysisService._validate_media(media_id, user_id)

        # 验证模型
        model = AnalysisService._validate_model(model_id, user_id)

        # 检查是否有重复的待处理任务
        existing = ImageAnalysis.objects.filter(
            media=media,
            status__in=[AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]
        ).first()

        if existing:
            raise AnalysisAlreadyExistsError(
                f"该图片已有{existing.get_status_display()}的分析任务"
            )

        # 创建分析记录
        analysis = ImageAnalysis.objects.create(
            media=media,
            model=model,
            endpoint=model.endpoint,
            user_id=user_id,
            status=AnalysisStatus.PENDING
        )

        logger.info(f"创建分析任务: analysis_id={analysis.id}, media_id={media_id}, model_id={model_id}")
        return analysis

    @staticmethod
    def execute_analysis(analysis_id: int) -> ImageAnalysis:
        """
        执行分析任务

        只负责：获取记录 -> 调用 AI -> 保存结果 -> 发送通知

        Args:
            analysis_id: 分析记录 ID

        Returns:
            ImageAnalysis: 更新后的分析记录

        Raises:
            LLMException: 分析过程中的各种错误
        """
        # 获取分析记录
        try:
            analysis = ImageAnalysis.objects.select_related(
                'media', 'model', 'endpoint', 'user'
            ).get(id=analysis_id)
        except ImageAnalysis.DoesNotExist:
            raise MediaNotFoundError(f"分析记录不存在: analysis_id={analysis_id}")

        # 更新状态为处理中
        analysis.status = AnalysisStatus.PROCESSING
        analysis.save(update_fields=['status', 'updated_at'])

        # 发送处理中通知
        send_analysis_update(analysis.user_id, {
            'id': analysis.id,
            'status': AnalysisStatus.PROCESSING,
        })

        try:
            # 读取图片
            image_data, mime_type = AnalysisService._read_image(analysis.media)

            # 获取提供商并执行分析
            provider = get_provider(analysis.endpoint, analysis.model)

            # 记录请求信息
            logger.info(
                f"[分析请求] analysis_id={analysis_id}, "
                f"provider={analysis.endpoint.provider_type}, "
                f"endpoint={analysis.endpoint.name}, "
                f"model={analysis.model.name}, "
                f"base_url={analysis.endpoint.base_url}"
            )

            result = provider.analyze(image_data, mime_type)

            # 保存成功结果
            AnalysisService._save_success(analysis, result)

            logger.info(
                f"[分析完成] analysis_id={analysis_id}, "
                f"provider={analysis.endpoint.provider_type}, "
                f"model={analysis.model.name}, "
                f"tokens={result.tokens_used}"
            )
            return analysis

        except Exception as e:
            # 统一错误处理
            AnalysisService._save_error(analysis, e)
            raise

    @staticmethod
    def get_stats(user_id: int) -> dict:
        """
        获取用户分析统计

        Args:
            user_id: 用户 ID

        Returns:
            dict: 统计信息
        """
        from django.db.models import Count, Case, When, IntegerField

        # 使用单个聚合查询获取所有统计数据
        stats = ImageAnalysis.objects.filter(user_id=user_id).aggregate(
            total=Count('id'),
            pending=Count(Case(
                When(status=AnalysisStatus.PENDING, then=1),
                output_field=IntegerField()
            )),
            processing=Count(Case(
                When(status=AnalysisStatus.PROCESSING, then=1),
                output_field=IntegerField()
            )),
            completed=Count(Case(
                When(status=AnalysisStatus.COMPLETED, then=1),
                output_field=IntegerField()
            )),
            failed=Count(Case(
                When(status=AnalysisStatus.FAILED, then=1),
                output_field=IntegerField()
            )),
            cancelled=Count(Case(
                When(status=AnalysisStatus.CANCELLED, then=1),
                output_field=IntegerField()
            )),
        )

        return stats

    @staticmethod
    def retry_analysis(analysis_id: int, user_id: int) -> ImageAnalysis:
        """
        重试分析任务

        Args:
            analysis_id: 分析记录 ID
            user_id: 用户 ID（用于权限验证）

        Returns:
            ImageAnalysis: 重置后的分析记录

        Raises:
            ValidationError: 状态不允许重试
        """
        try:
            analysis = ImageAnalysis.objects.get(id=analysis_id, user_id=user_id)
        except ImageAnalysis.DoesNotExist:
            raise MediaNotFoundError(f"分析记录不存在")

        # 检查状态
        if analysis.status == AnalysisStatus.PROCESSING:
            raise AnalysisAlreadyExistsError("分析正在进行中，无需重试")

        if analysis.status == AnalysisStatus.PENDING:
            raise AnalysisAlreadyExistsError("任务已在队列中等待处理")

        # 检查重试次数
        if analysis.retry_count >= analysis.max_retries:
            raise AnalysisAlreadyExistsError(f"已达到最大重试次数 ({analysis.max_retries})")

        # 重置状态
        analysis.status = AnalysisStatus.PENDING
        analysis.retry_count += 1
        analysis.last_retry_at = timezone.now()
        analysis.error_message = ''
        analysis.error_details = {}
        analysis.save()

        logger.info(f"重试分析: analysis_id={analysis_id}, retry_count={analysis.retry_count}")
        return analysis

    @staticmethod
    def cancel_analysis(analysis_id: int, user_id: int) -> ImageAnalysis:
        """
        取消分析任务

        Args:
            analysis_id: 分析记录 ID
            user_id: 用户 ID

        Returns:
            ImageAnalysis: 取消后的分析记录
        """
        try:
            analysis = ImageAnalysis.objects.get(id=analysis_id, user_id=user_id)
        except ImageAnalysis.DoesNotExist:
            raise MediaNotFoundError(f"分析记录不存在")

        if analysis.status not in [AnalysisStatus.PENDING, AnalysisStatus.PROCESSING]:
            raise AnalysisAlreadyExistsError(f"无法取消状态为 {analysis.get_status_display()} 的任务")

        analysis.status = AnalysisStatus.CANCELLED
        analysis.error_message = '用户取消'
        analysis.save()

        return analysis

    @staticmethod
    def _validate_media(media_id: int, user_id: int):
        """验证媒体文件"""
        from media.models import Media

        try:
            media = Media.objects.get(id=media_id, owner_id=user_id)
        except Media.DoesNotExist:
            raise MediaNotFoundError(f"媒体文件不存在或无权访问: media_id={media_id}")

        if media.type != 'image':
            raise MediaNotFoundError(f"只能分析图片文件: media_type={media.type}")

        return media

    @staticmethod
    def _validate_model(model_id: int, user_id: int) -> AIModel:
        """验证 AI 模型"""
        try:
            model = AIModel.objects.select_related('endpoint').get(
                id=model_id,
                endpoint__owner_id=user_id
            )
        except AIModel.DoesNotExist:
            raise ModelNotFoundError(f"模型不存在或无权访问: model_id={model_id}")

        return model

    @staticmethod
    def _read_image(media) -> tuple[str, str]:
        """
        读取图片文件

        Args:
            media: Media 模型实例

        Returns:
            tuple[str, str]: (Base64 编码的图片数据, MIME 类型)

        Raises:
            FileReadError: 文件读取失败
        """
        try:
            with media.file.open('rb') as img_file:
                image_data = base64.b64encode(img_file.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"读取图片文件失败: media_id={media.id}, error={str(e)}")
            raise FileReadError(f"读取图片文件失败: {str(e)}")

        mime_type = media.mime_type or 'image/jpeg'
        return image_data, mime_type

    @staticmethod
    def _save_success(analysis: ImageAnalysis, result) -> None:
        """
        保存成功结果

        Args:
            analysis: 分析记录
            result: AnalysisResult 实例
        """
        from django.db import transaction

        with transaction.atomic():
            analysis.description = result.description
            analysis.method = result.method
            analysis.tokens_used = result.tokens_used
            analysis.status = AnalysisStatus.COMPLETED
            analysis.error_type = ErrorType.NONE
            analysis.error_message = ''
            analysis.error_details = {}
            analysis.completed_at = timezone.now()
            analysis.save()

            # 同步分类到 Media
            if result.categories:
                AnalysisService._sync_category(analysis.media, result.categories[0])

        # 发送完成通知
        send_analysis_update(analysis.user_id, {
            'id': analysis.id,
            'status': AnalysisStatus.COMPLETED,
            'description': result.description,
        })

        # 发送统计更新
        send_stats_update(analysis.user_id, AnalysisService.get_stats(analysis.user_id))

    @staticmethod
    def _save_error(analysis: ImageAnalysis, exc: Exception) -> None:
        """
        保存错误结果

        Args:
            analysis: 分析记录
            exc: 异常
        """
        analysis.status = AnalysisStatus.FAILED
        analysis.error_type = classify_exception(exc)
        analysis.error_message = str(exc)[:500]

        # 记录错误详情
        if isinstance(exc, LLMException):
            analysis.error_details = exc.details
        else:
            analysis.error_details = {'exception_type': type(exc).__name__}

        analysis.save()

        # 发送失败通知
        send_analysis_update(analysis.user_id, {
            'id': analysis.id,
            'status': AnalysisStatus.FAILED,
            'error_type': analysis.error_type,
            'error_message': analysis.error_message,
        })

        # 发送统计更新
        send_stats_update(analysis.user_id, AnalysisService.get_stats(analysis.user_id))

        logger.error(f"分析失败: analysis_id={analysis.id}, error={str(exc)}")

    @staticmethod
    def _sync_category(media, category_name: str) -> None:
        """
        同步分类到 Media

        Args:
            media: Media 实例
            category_name: 分类名称
        """
        from media.models import Category

        if not category_name or not category_name.strip():
            return

        category_name = category_name.strip()

        try:
            category, _ = Category.objects.get_or_create(
                name=category_name,
                defaults={'description': f'由 AI 分析自动创建: {category_name}'}
            )
            media.category = category
            media.save(update_fields=['category', 'updated_at'])
            logger.info(f"媒体 {media.id} 已设置分类: {category_name}")
        except Exception as e:
            logger.warning(f"同步分类失败: media_id={media.id}, error={str(e)}")
