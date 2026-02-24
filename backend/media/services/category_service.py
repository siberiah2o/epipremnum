"""
分类服务

提供分类相关的业务逻辑
"""

import logging
from ..models import Category
from utils.exceptions import ResourceNotFound, ValidationError, DuplicateError

logger = logging.getLogger(__name__)


class CategoryService:
    """分类服务"""

    @staticmethod
    def create_category(name: str, description: str = '') -> Category:
        """
        创建分类

        Args:
            name: 分类名称
            description: 分类描述

        Returns:
            Category: 创建的分类对象

        Raises:
            DuplicateError: 分类已存在
        """
        if Category.objects.filter(name=name).exists():
            raise DuplicateError(f'分类 "{name}" 已存在')

        category = Category.objects.create(
            name=name,
            description=description
        )

        logger.info(f"分类创建成功: category_id={category.id}, name={name}")
        return category

    @staticmethod
    def update_category(
        category: Category,
        name: str = None,
        description: str = None
    ) -> Category:
        """
        更新分类

        Args:
            category: 分类对象
            name: 新名称
            description: 新描述

        Returns:
            Category: 更新后的分类对象

        Raises:
            DuplicateError: 名称已存在
        """
        if name is not None and name != category.name:
            if Category.objects.filter(name=name).exists():
                raise DuplicateError(f'分类 "{name}" 已存在')
            category.name = name

        if description is not None:
            category.description = description

        category.save()
        logger.info(f"分类更新: category_id={category.id}")
        return category

    @staticmethod
    def delete_category(category: Category) -> bool:
        """
        删除分类

        Args:
            category: 分类对象

        Returns:
            bool: 是否成功
        """
        category_id = category.id
        category.delete()
        logger.info(f"分类删除: category_id={category_id}")
        return True

    @staticmethod
    def get_or_create(name: str, description: str = '') -> tuple[Category, bool]:
        """
        获取或创建分类

        Args:
            name: 分类名称
            description: 分类描述（仅创建时使用）

        Returns:
            tuple: (分类对象, 是否新建)
        """
        category, created = Category.objects.get_or_create(
            name=name,
            defaults={'description': description}
        )

        if created:
            logger.info(f"分类创建: name={name}")

        return category, created
