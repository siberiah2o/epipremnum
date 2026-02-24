"""
项目服务

提供项目相关的业务逻辑
"""

import logging
from ..models import Project
from utils.exceptions import ResourceNotFound, ValidationError

logger = logging.getLogger(__name__)


class ProjectService:
    """项目服务"""

    @staticmethod
    def create_project(name: str, owner, description: str = '', cover_image_id: int = None) -> Project:
        """
        创建项目

        Args:
            name: 项目名称
            owner: 所有者
            description: 项目描述
            cover_image_id: 封面图片 ID

        Returns:
            Project: 创建的项目对象
        """
        from media.models import Media

        cover_image = None
        if cover_image_id:
            try:
                cover_image = Media.objects.get(id=cover_image_id, owner=owner)
            except Media.DoesNotExist:
                pass

        project = Project.objects.create(
            name=name,
            description=description,
            cover_image=cover_image,
            owner=owner
        )

        logger.info(f"项目创建成功: project_id={project.id}, name={name}")
        return project

    @staticmethod
    def update_project(
        project: Project,
        name: str = None,
        description: str = None,
        cover_image_id: int = None
    ) -> Project:
        """
        更新项目

        Args:
            project: 项目对象
            name: 新名称
            description: 新描述
            cover_image_id: 新封面图片 ID

        Returns:
            Project: 更新后的项目对象
        """
        from media.models import Media

        if name is not None:
            project.name = name

        if description is not None:
            project.description = description

        if cover_image_id is not None:
            try:
                project.cover_image = Media.objects.get(id=cover_image_id, owner=project.owner)
            except Media.DoesNotExist:
                project.cover_image = None

        project.save()
        logger.info(f"项目更新: project_id={project.id}")
        return project

    @staticmethod
    def delete_project(project: Project) -> bool:
        """
        删除项目

        Args:
            project: 项目对象

        Returns:
            bool: 是否成功
        """
        project_id = project.id
        project.delete()
        logger.info(f"项目删除: project_id={project_id}")
        return True
