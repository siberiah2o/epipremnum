"""
项目媒体服务

提供项目-媒体关联相关的业务逻辑
"""

import logging
from django.db import transaction
from ..models import Project, ProjectMedia
from media.models import Media
from utils.exceptions import ResourceNotFound, ValidationError

logger = logging.getLogger(__name__)


class ProjectMediaService:
    """项目媒体服务"""

    @staticmethod
    def add_media_to_project(project: Project, media_ids: list, notes: str = '') -> dict:
        """
        添加媒体到项目

        Args:
            project: 项目对象
            media_ids: 媒体 ID 列表
            notes: 备注

        Returns:
            dict: 添加结果
        """
        # 获取当前用户的媒体文件
        media_list = Media.objects.filter(
            id__in=media_ids,
            owner=project.owner
        )

        if not media_list.exists():
            raise ValidationError('未找到有效的媒体文件')

        created_count = 0
        skipped_count = 0

        for media in media_list:
            _, created = ProjectMedia.objects.get_or_create(
                project=project,
                media=media,
                defaults={'notes': notes}
            )
            if created:
                created_count += 1
            else:
                skipped_count += 1

        logger.info(f"媒体添加到项目: project_id={project.id}, created={created_count}, skipped={skipped_count}")
        return {'created': created_count, 'skipped': skipped_count}

    @staticmethod
    def remove_media_from_project(project: Project, media_id: int) -> bool:
        """
        从项目移除媒体

        Args:
            project: 项目对象
            media_id: 媒体 ID

        Returns:
            bool: 是否成功
        """
        try:
            project_media = ProjectMedia.objects.get(
                project=project,
                media_id=media_id
            )
            project_media.delete()
            logger.info(f"媒体从项目移除: project_id={project.id}, media_id={media_id}")
            return True
        except ProjectMedia.DoesNotExist:
            raise ResourceNotFound('该媒体文件不在项目中')

    @staticmethod
    def batch_remove_media(project: Project, media_ids: list) -> int:
        """
        批量从项目移除媒体

        Args:
            project: 项目对象
            media_ids: 媒体 ID 列表

        Returns:
            int: 删除数量
        """
        deleted_count, _ = ProjectMedia.objects.filter(
            project=project,
            media_id__in=media_ids
        ).delete()

        logger.info(f"批量移除媒体: project_id={project.id}, deleted={deleted_count}")
        return deleted_count

    @staticmethod
    def reorder_media(project: Project, order_data: list) -> bool:
        """
        重新排序项目中的媒体

        Args:
            project: 项目对象
            order_data: 排序数据 [{'media_id': 1, 'order': 0}, ...]

        Returns:
            bool: 是否成功
        """
        with transaction.atomic():
            for item in order_data:
                if not isinstance(item, dict) or 'media_id' not in item or 'order' not in item:
                    continue
                try:
                    project_media = ProjectMedia.objects.get(
                        project=project,
                        media_id=item['media_id']
                    )
                    project_media.order = item['order']
                    project_media.save()
                except ProjectMedia.DoesNotExist:
                    continue

        logger.info(f"媒体重新排序: project_id={project.id}")
        return True

    @staticmethod
    def update_media_notes(project: Project, media_id: int, notes: str) -> bool:
        """
        更新媒体备注

        Args:
            project: 项目对象
            media_id: 媒体 ID
            notes: 备注内容

        Returns:
            bool: 是否成功
        """
        try:
            project_media = ProjectMedia.objects.get(
                project=project,
                media_id=media_id
            )
            project_media.notes = notes
            project_media.save()
            logger.info(f"更新媒体备注: project_id={project.id}, media_id={media_id}")
            return True
        except ProjectMedia.DoesNotExist:
            raise ResourceNotFound('该媒体文件不在项目中')
