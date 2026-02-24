"""
媒体服务

提供媒体文件相关的业务逻辑
"""

import logging
from typing import Optional
from PIL import Image
from io import BytesIO

from django.core.files.uploadedfile import UploadedFile
from django.core.files.base import ContentFile

from ..models import Media, Category
from utils.exceptions import ResourceNotFound, ValidationError, DuplicateError

logger = logging.getLogger(__name__)

# 文件大小限制（50MB）
MAX_FILE_SIZE = 50 * 1024 * 1024

# 允许的图片 MIME 类型
ALLOWED_IMAGE_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/bmp', 'image/tiff', 'image/svg+xml'
}


class MediaService:
    """媒体服务"""

    @staticmethod
    def create_media(
        file: UploadedFile,
        owner,
        filename: str = None,
        category_id: int = None,
    ) -> Media:
        """
        创建媒体文件

        Args:
            file: 上传的文件
            owner: 所有者
            filename: 文件名（可选，默认使用原文件名）
            category_id: 分类 ID（可选）

        Returns:
            Media: 创建的媒体对象

        Raises:
            ValidationError: 文件验证失败
            DuplicateError: 文件已存在
        """
        # 获取文件信息
        filename = filename or file.name
        file_size = file.size
        mime_type = file.content_type

        # 验证文件大小
        if file_size > MAX_FILE_SIZE:
            raise ValidationError(f'文件大小超出限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）')

        # 验证文件类型
        if mime_type not in ALLOWED_IMAGE_TYPES:
            raise ValidationError(f'不支持的文件类型: {mime_type}')

        # 计算文件哈希
        file_hash = Media.calculate_file_hash(file)

        # 检查是否重复
        if file_hash and Media.objects.filter(owner=owner, file_hash=file_hash).exists():
            raise DuplicateError('该图片已存在')

        # 确定媒体类型（目前仅支持图片）
        media_type = Media.MediaType.IMAGE
        if not mime_type.startswith('image/'):
            logger.warning(f"非图片类型文件上传: mime_type={mime_type}, filename={filename}")

        # 获取分类
        category = None
        if category_id:
            try:
                category = Category.objects.get(id=category_id)
            except Category.DoesNotExist:
                pass  # 忽略不存在的分类

        # 获取图片尺寸
        width, height = None, None
        if media_type == Media.MediaType.IMAGE:
            try:
                file.seek(0)
                img = Image.open(file)
                width, height = img.size
                file.seek(0)
            except Image.UnidentifiedImageError as e:
                logger.warning(f"无法识别图片格式: {e}")
            except Image.DecompressionBombError as e:
                logger.warning(f"图片文件过大（潜在安全问题）: {e}")
            except IOError as e:
                logger.warning(f"读取图片文件失败: {e}")

        # 创建媒体记录
        media = Media.objects.create(
            type=media_type,
            file=file,
            filename=filename,
            file_hash=file_hash,
            file_size=file_size,
            mime_type=mime_type,
            width=width,
            height=height,
            category=category,
            owner=owner,
        )

        # 生成缩略图
        MediaService._generate_thumbnail(media)

        logger.info(f"媒体文件创建成功: media_id={media.id}, filename={filename}")
        return media

    @staticmethod
    def update_media(
        media: Media,
        filename: str = None,
        category_id: int = None,
    ) -> Media:
        """
        更新媒体文件信息

        Args:
            media: 媒体对象
            filename: 新文件名
            category_id: 新分类 ID

        Returns:
            Media: 更新后的媒体对象
        """
        if filename is not None:
            media.filename = filename

        if category_id is not None:
            try:
                media.category = Category.objects.get(id=category_id)
            except Category.DoesNotExist:
                media.category = None

        media.save()
        logger.info(f"媒体文件更新: media_id={media.id}")
        return media

    @staticmethod
    def delete_media(media: Media) -> bool:
        """
        删除媒体文件

        Args:
            media: 媒体对象

        Returns:
            bool: 是否成功
        """
        media_id = media.id
        media.delete()
        logger.info(f"媒体文件删除: media_id={media_id}")
        return True

    @staticmethod
    def batch_delete(media_ids: list, user) -> dict:
        """
        批量删除媒体文件

        Args:
            media_ids: 媒体 ID 列表
            user: 用户对象

        Returns:
            dict: 删除结果
        """
        deleted = 0
        not_found = 0

        for media_id in media_ids:
            try:
                media = Media.objects.get(id=media_id, owner=user)
                media.delete()
                deleted += 1
            except Media.DoesNotExist:
                not_found += 1

        logger.info(f"批量删除媒体: deleted={deleted}, not_found={not_found}")
        return {'deleted': deleted, 'not_found': not_found}

    @staticmethod
    def _generate_thumbnail(media: Media, size: tuple = (200, 200)) -> None:
        """
        生成缩略图

        Args:
            media: 媒体对象
            size: 缩略图尺寸
        """
        if media.type != Media.MediaType.IMAGE:
            return

        try:
            media.file.open('rb')
            img = Image.open(media.file)
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # 保存缩略图到内存
            thumb_io = BytesIO()
            img_format = 'JPEG' if img.mode == 'RGB' else 'PNG'
            img.save(thumb_io, format=img_format, quality=85)

            # 生成缩略图文件名
            thumb_name = f"thumb_{media.filename}"

            # 保存缩略图
            media.thumbnail.save(
                thumb_name,
                ContentFile(thumb_io.getvalue()),
                save=True
            )

            media.file.close()
            logger.info(f"缩略图生成成功: media_id={media.id}")

        except Image.UnidentifiedImageError as e:
            logger.warning(f"缩略图生成失败 - 无法识别图片: media_id={media.id}, error={e}")
        except Image.DecompressionBombError as e:
            logger.warning(f"缩略图生成失败 - 图片过大: media_id={media.id}, error={e}")
        except IOError as e:
            logger.warning(f"缩略图生成失败 - IO错误: media_id={media.id}, error={e}")
        except Exception as e:
            logger.error(f"缩略图生成失败 - 未知错误: media_id={media.id}, error={e}")
            raise
