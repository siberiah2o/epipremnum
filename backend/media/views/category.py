"""
分类视图

提供分类的 CRUD 操作
"""

import logging
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    BadRequestResponse,
)
from utils.pagination import StandardPagination
from utils.viewsets import BaseModelViewSet
from utils.exceptions import DuplicateError

from ..models import Category
from ..serializers import CategorySerializer, CategoryCreateSerializer
from ..services import CategoryService

logger = logging.getLogger(__name__)


class CategoryViewSet(BaseModelViewSet):
    """
    分类视图集

    API 端点:
    - GET    /api/categories/      # 列表
    - POST   /api/categories/      # 创建
    - GET    /api/categories/{id}/ # 详情
    - PUT    /api/categories/{id}/ # 更新
    - DELETE /api/categories/{id}/ # 删除
    """

    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        """返回所有分类（全局共享）"""
        return Category.objects.all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return CategoryCreateSerializer
        return CategorySerializer

    def create(self, request, *args, **kwargs):
        """创建分类"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            category = CategoryService.create_category(
                name=serializer.validated_data['name'],
                description=serializer.validated_data.get('description', '')
            )
            return CreatedResponse(CategorySerializer(category).data)

        except DuplicateError as e:
            return BadRequestResponse(message=str(e))

    def update(self, request, *args, **kwargs):
        """更新分类"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        try:
            category = CategoryService.update_category(
                category=instance,
                name=serializer.validated_data.get('name'),
                description=serializer.validated_data.get('description')
            )
            return SuccessResponse(CategorySerializer(category).data)

        except DuplicateError as e:
            return BadRequestResponse(message=str(e))

    def destroy(self, request, *args, **kwargs):
        """删除分类"""
        instance = self.get_object()
        CategoryService.delete_category(instance)
        return NoContentResponse()
