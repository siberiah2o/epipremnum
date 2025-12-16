"""
Base viewsets for endpoint app
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from .mixins import StandardResponseMixin, UserFilteredQuerysetMixin, UserPermissionMixin


class BaseOwnerViewSet(
    StandardResponseMixin,
    UserFilteredQuerysetMixin,
    UserPermissionMixin,
    viewsets.ModelViewSet
):
    """
    Base ViewSet for models owned by users
    """
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        """Set owner on creation"""
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Override create to use standard response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return self.created_response(
            message='创建成功',
            data=serializer.data,
            headers=headers
        )

    def list(self, request, *args, **kwargs):
        """Override list to use standard response"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(
                self.success_response(
                    message='获取列表成功',
                    data=serializer.data
                ).data
            )

        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(
            message='获取列表成功',
            data=serializer.data
        )

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to use standard response"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response(
            message='获取详情成功',
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        """Override update to use standard response"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return self.success_response(
            message='更新成功',
            data=serializer.data
        )

    def destroy(self, request, *args, **kwargs):
        """Override destroy to use standard response"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response(
            message='删除成功',
            data=None
        )


class BaseReadOnlyOwnerViewSet(
    StandardResponseMixin,
    UserFilteredQuerysetMixin,
    UserPermissionMixin,
    viewsets.ReadOnlyModelViewSet
):
    """
    Base ReadOnly ViewSet for models owned by users
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Override list to use standard response"""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(
                self.success_response(
                    message='获取列表成功',
                    data=serializer.data
                ).data
            )

        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(
            message='获取列表成功',
            data=serializer.data
        )

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to use standard response"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response(
            message='获取详情成功',
            data=serializer.data
        )