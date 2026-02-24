"""
公共 ViewSet Mixin

提供统一的 CRUD 操作，减少重复代码
"""

from rest_framework import status, viewsets

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
)


class ReadOnlyModelMixin:
    """
    只读 Model Mixin

    提供 list 和 retrieve 操作的标准实现
    """

    def list(self, request, *args, **kwargs):
        """列表"""
        queryset = self.filter_queryset(self.get_queryset())

        # 分页
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.paginator.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return SuccessResponse(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        """详情"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return SuccessResponse(serializer.data)


class CreateModelMixin:
    """
    创建 Model Mixin
    """

    def create(self, request, *args, **kwargs):
        """创建"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return CreatedResponse(serializer.data, headers=headers)

    def perform_create(self, serializer):
        """创建时的额外操作"""
        serializer.save()


class UpdateModelMixin:
    """
    更新 Model Mixin
    """

    def update(self, request, *args, **kwargs):
        """更新"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return SuccessResponse(serializer.data)

    def perform_update(self, serializer):
        """更新时的额外操作"""
        serializer.save()


class DestroyModelMixin:
    """
    删除 Model Mixin
    """

    def destroy(self, request, *args, **kwargs):
        """删除"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return NoContentResponse()

    def perform_destroy(self, instance):
        """删除时的额外操作"""
        instance.delete()


class BaseModelViewSet(
    CreateModelMixin,
    ReadOnlyModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    基础 Model ViewSet

    提供完整的 CRUD 操作，子类只需定义:
    - queryset
    - serializer_class
    - (可选) permission_classes, filter_backends 等

    示例:
        class MyViewSet(BaseModelViewSet):
            queryset = MyModel.objects.all()
            serializer_class = MySerializer
    """
    pass


class ReadOnlyViewSet(ReadOnlyModelMixin, viewsets.GenericViewSet):
    """
    只读 ViewSet

    只提供 list 和 retrieve 操作
    """
    pass
