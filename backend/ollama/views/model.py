"""
Model management view handlers
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from ..models import OllamaAIModel, OllamaEndpoint
from ..serializers import OllamaAIModelSerializer
from .base import BaseResponseHandler, BaseViewSetMixin


class ModelCRUDHandler(BaseViewSetMixin):
    """Handler for model read operations"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request
        self.kwargs = viewset_instance.kwargs

    def list(self):
        """List models with filtering options"""
        queryset = self.viewset.get_queryset()

        # Apply filters
        queryset = self._apply_filters(queryset)

        serializer = self.viewset.get_serializer(queryset, many=True)
        return BaseResponseHandler.success_response(
            message='获取模型列表成功',
            data=serializer.data
        )

    def _apply_filters(self, queryset):
        """Apply query filters to model queryset"""
        # Filter by endpoint
        endpoint_id = self.request.query_params.get('endpoint_id')
        if endpoint_id:
            queryset = queryset.filter(endpoint_id=endpoint_id)

        # Filter by default endpoint flag
        default_only = self.request.query_params.get('default_only')
        if default_only is not None and default_only.lower() == 'true':
            queryset = queryset.filter(endpoint__is_default=True)

        # Filter by vision capability
        vision_capable = self.request.query_params.get('vision_capable')
        if vision_capable is not None:
            queryset = queryset.filter(is_vision_capable=vision_capable.lower() == 'true')

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def retrieve(self):
        """Get single model details"""
        instance = self.viewset.get_object()
        self.validate_user_access(instance)
        serializer = self.viewset.get_serializer(instance)
        return BaseResponseHandler.success_response(
            message='获取模型详情成功',
            data=serializer.data
        )


class ModelManagementHandler(BaseViewSetMixin):
    """Handler for model management operations"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def set_default(self, pk=None):
        """Set model as default"""
        model = self.viewset.get_object()
        self.validate_user_access(model)

        # Remove default status from other models
        OllamaAIModel.objects.filter(
            endpoint__created_by=self.request.user,
            is_default=True
        ).update(is_default=False)

        # Set current model as default
        model.is_default = True
        model.save()

        serializer = self.viewset.get_serializer(model)
        return BaseResponseHandler.success_response(
            message='设置为默认模型成功',
            data=serializer.data
        )

    def set_vision_capable(self, pk=None):
        """Set model vision capability"""
        model = self.viewset.get_object()
        self.validate_user_access(model)

        is_vision_capable = self.request.data.get('is_vision_capable')
        if is_vision_capable is None:
            return BaseResponseHandler.error_response(
                message='缺少is_vision_capable参数'
            )

        model.is_vision_capable = bool(is_vision_capable)
        model.save()

        vision_text = '支持视觉' if model.is_vision_capable else '不支持视觉'
        serializer = self.viewset.get_serializer(model)
        return BaseResponseHandler.success_response(
            message=f'模型视觉能力设置为{vision_text}',
            data=serializer.data
        )

    def get_default(self):
        """Get default model"""
        try:
            default_model = self.viewset.get_queryset().get(is_default=True)
            serializer = self.viewset.get_serializer(default_model)
            return BaseResponseHandler.success_response(
                message='获取默认模型成功',
                data=serializer.data
            )
        except OllamaAIModel.DoesNotExist:
            return BaseResponseHandler.not_found_response(
                message='未找到默认模型'
            )

    def get_vision_models(self):
        """Get vision-capable models"""
        models = self.viewset.get_queryset().filter(is_vision_capable=True, is_active=True)
        serializer = self.viewset.get_serializer(models, many=True)
        return BaseResponseHandler.success_response(
            message='获取视觉模型列表成功',
            data=serializer.data
        )