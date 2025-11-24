"""
Endpoint management view handlers
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from ..models import OllamaEndpoint
from ..serializers import (
    OllamaEndpointSerializer,
    OllamaEndpointCreateSerializer,
    OllamaEndpointUpdateSerializer
)
from .base import BaseResponseHandler, BaseViewSetMixin


class EndpointCRUDHandler(BaseViewSetMixin):
    """Handler for endpoint CRUD operations"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request
        self.kwargs = viewset_instance.kwargs

    def create(self):
        """Create a new endpoint"""
        serializer = self.viewset.get_serializer(data=self.request.data)
        serializer.is_valid(raise_exception=True)
        self._perform_create(serializer)
        headers = self.viewset.get_success_headers(serializer.data)
        return BaseResponseHandler.created_response(
            message='端点创建成功',
            data=serializer.data,
            headers=headers
        )

    def _perform_create(self, serializer):
        """Perform endpoint creation with user assignment"""
        serializer.save(created_by=self.request.user)

    def list(self):
        """List user's endpoints"""
        queryset = self.viewset.get_queryset()
        serializer = self.viewset.get_serializer(queryset, many=True)
        return BaseResponseHandler.success_response(
            message='获取端点列表成功',
            data=serializer.data
        )

    def retrieve(self):
        """Get single endpoint details"""
        instance = self.viewset.get_object()
        self.validate_user_access(instance)
        serializer = self.viewset.get_serializer(instance)
        return BaseResponseHandler.success_response(
            message='获取端点详情成功',
            data=serializer.data
        )

    def update(self):
        """Update endpoint"""
        partial = self.kwargs.pop('partial', False)
        instance = self.viewset.get_object()
        self.validate_user_access(instance)
        serializer = self.viewset.get_serializer(
            instance, data=self.request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.viewset.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return BaseResponseHandler.success_response(
            message='端点更新成功',
            data=serializer.data
        )

    def destroy(self):
        """Delete endpoint"""
        instance = self.viewset.get_object()
        self.validate_user_access(instance)
        instance.delete()
        return BaseResponseHandler.success_response(
            message='端点删除成功',
            data=None
        )


class EndpointManagementHandler(BaseViewSetMixin):
    """Handler for endpoint management operations"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def set_default(self, pk=None):
        """Set endpoint as default"""
        endpoint = self.viewset.get_object()
        self.validate_user_access(endpoint)

        # Remove default status from other endpoints
        OllamaEndpoint.objects.filter(
            created_by=self.request.user,
            is_default=True
        ).update(is_default=False)

        # Set current endpoint as default
        endpoint.is_default = True
        endpoint.save()

        serializer = self.viewset.get_serializer(endpoint)
        return BaseResponseHandler.success_response(
            message='设置为默认端点成功',
            data=serializer.data
        )

    def get_default(self):
        """Get default endpoint"""
        try:
            default_endpoint = self.viewset.get_queryset().get(is_default=True)
            serializer = self.viewset.get_serializer(default_endpoint)
            return BaseResponseHandler.success_response(
                message='获取默认端点成功',
                data=serializer.data
            )
        except OllamaEndpoint.DoesNotExist:
            return BaseResponseHandler.not_found_response(
                message='未找到默认端点'
            )