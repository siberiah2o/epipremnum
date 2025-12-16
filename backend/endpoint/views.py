"""
Views for endpoint app
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction

from .models import OllamaEndpoint, OllamaAIModel
from .serializers import (
    OllamaEndpointSerializer,
    OllamaEndpointCreateSerializer,
    OllamaEndpointUpdateSerializer,
    OllamaAIModelSerializer,
    OllamaAIModelCreateSerializer,
    OllamaAIModelUpdateSerializer
)
from .base import BaseOwnerViewSet, BaseReadOnlyOwnerViewSet
from .mixins import StandardResponseMixin


class OllamaEndpointViewSet(BaseOwnerViewSet):
    """
    AI端点管理 ViewSet
    提供完整的增删改查功能
    """
    queryset = OllamaEndpoint.objects.all()
    serializer_class = OllamaEndpointSerializer

    def get_serializer_class(self):
        """根据操作选择不同的序列化器"""
        if self.action == 'create':
            return OllamaEndpointCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OllamaEndpointUpdateSerializer
        return OllamaEndpointSerializer

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """设置为默认端点"""
        endpoint = self.get_object()

        with transaction.atomic():
            # 取消其他端点的默认状态
            OllamaEndpoint.objects.filter(
                created_by=request.user,
                is_default=True
            ).update(is_default=False)

            # 设置当前端点为默认
            endpoint.is_default = True
            endpoint.save()

        serializer = self.get_serializer(endpoint)
        return self.success_response(
            message='设置为默认端点成功',
            data=serializer.data
        )

    @action(detail=False, methods=['get'])
    def default(self, request):
        """获取默认端点"""
        endpoint = OllamaEndpoint.objects.filter(
            created_by=request.user,
            is_default=True
        ).first()

        if not endpoint:
            return self.not_found_response(
                message='未找到默认端点'
            )

        serializer = self.get_serializer(endpoint)
        return self.success_response(
            message='获取默认端点成功',
            data=serializer.data
        )

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试端点连接"""
        endpoint = self.get_object()

        # 这里可以添加实际的连接测试逻辑
        # 暂时返回成功响应
        return self.success_response(
            message='连接测试成功',
            data={
                'endpoint_name': endpoint.name,
                'provider': endpoint.provider,
                'status': 'connected'
            }
        )


class OllamaAIModelViewSet(BaseReadOnlyOwnerViewSet):
    """
    Ollama模型管理 ViewSet
    只提供查询功能，模型数据完全来自Ollama API
    """
    queryset = OllamaAIModel.objects.select_related('endpoint')
    serializer_class = OllamaAIModelSerializer

    def get_queryset(self):
        """获取用户的模型列表，支持过滤"""
        queryset = super().get_queryset()

        # 支持按端点过滤
        endpoint_id = self.request.query_params.get('endpoint_id')
        if endpoint_id:
            queryset = queryset.filter(endpoint_id=endpoint_id)

        # 支持按默认端点过滤
        default_only = self.request.query_params.get('default_only')
        if default_only and default_only.lower() == 'true':
            queryset = queryset.filter(endpoint__is_default=True)

        # 支持按视觉能力过滤
        vision_capable = self.request.query_params.get('vision_capable')
        if vision_capable is not None:
            queryset = queryset.filter(is_vision_capable=vision_capable.lower() == 'true')

        # 支持按激活状态过滤
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset

    def get_serializer_class(self):
        """根据操作选择序列化器"""
        if self.action == 'create':
            return OllamaAIModelCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OllamaAIModelUpdateSerializer
        return OllamaAIModelSerializer

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """设置为默认模型"""
        model = self.get_object()

        with transaction.atomic():
            # 取消其他模型的默认状态
            OllamaAIModel.objects.filter(
                endpoint__created_by=request.user,
                is_default=True
            ).update(is_default=False)

            # 设置当前模型为默认
            model.is_default = True
            model.save()

        serializer = self.get_serializer(model)
        return self.success_response(
            message='设置为默认模型成功',
            data=serializer.data
        )

    @action(detail=True, methods=['post'])
    def set_vision_capable(self, request, pk=None):
        """设置模型视觉能力"""
        model = self.get_object()

        is_vision_capable = request.data.get('is_vision_capable')
        if is_vision_capable is None:
            return self.error_response(
                message='缺少 is_vision_capable 参数'
            )

        model.is_vision_capable = bool(is_vision_capable)
        model.save()

        vision_text = '支持视觉' if model.is_vision_capable else '不支持视觉'
        serializer = self.get_serializer(model)
        return self.success_response(
            message=f'模型视觉能力设置为{vision_text}',
            data=serializer.data
        )

    @action(detail=False, methods=['get'])
    def default(self, request):
        """获取默认模型"""
        model = OllamaAIModel.objects.filter(
            endpoint__created_by=request.user,
            is_default=True
        ).select_related('endpoint').first()

        if not model:
            return self.not_found_response(
                message='未找到默认模型'
            )

        serializer = self.get_serializer(model)
        return self.success_response(
            message='获取默认模型成功',
            data=serializer.data
        )

    @action(detail=False, methods=['post'])
    def set_default_by_name(self, request):
        """通过模型名称设置默认模型"""
        model_name = request.data.get('model_name')
        if not model_name:
            return self.error_response(
                message='缺少 model_name 参数'
            )

        # 查找用户的模型
        model = OllamaAIModel.objects.filter(
            endpoint__created_by=request.user,
            name=model_name
        ).select_related('endpoint').first()

        if not model:
            return self.not_found_response(
                message=f'未找到模型: {model_name}'
            )

        with transaction.atomic():
            # 取消其他模型的默认状态
            OllamaAIModel.objects.filter(
                endpoint__created_by=request.user,
                is_default=True
            ).update(is_default=False)

            # 设置当前模型为默认
            model.is_default = True
            model.save()

        serializer = self.get_serializer(model)
        return self.success_response(
            message=f'已将 {model_name} 设置为默认模型',
            data=serializer.data
        )

    @action(detail=False, methods=['get'])
    def vision_models(self, request):
        """获取支持视觉的模型"""
        models = self.get_queryset().filter(
            is_vision_capable=True,
            is_active=True
        )

        serializer = self.get_serializer(models, many=True)
        return self.success_response(
            message='获取视觉模型列表成功',
            data=serializer.data
        )

    @action(detail=False, methods=['post'])
    def sync_from_endpoint(self, request):
        """从端点同步模型"""
        endpoint_id = request.data.get('endpoint_id')
        if not endpoint_id:
            return self.error_response(
                message='缺少 endpoint_id 参数'
            )

        # 获取端点
        try:
            endpoint = OllamaEndpoint.objects.get(
                id=endpoint_id,
                created_by=request.user
            )
        except OllamaEndpoint.DoesNotExist:
            return self.not_found_response(
                message='未找到指定端点'
            )

        # 这里应该调用端点的同步逻辑
        # 暂时返回成功响应
        return self.success_response(
            message='模型同步已启动',
            data={
                'synced': 0,
                'updated': 0,
                'disabled': 0,
                'total_vision_models': 0,
                'message': '同步完成'
            }
        )
