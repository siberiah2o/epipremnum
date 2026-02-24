"""
AI 模型视图

管理 AI 模型的 CRUD 操作
"""

import logging
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    ErrorResponse,
)
from llm.models import Endpoint, AIModel
from llm.serializers import (
    AIModelSerializer,
    AIModelCreateSerializer,
    AIModelUpdateSerializer,
)

logger = logging.getLogger(__name__)


class AIModelViewSet(viewsets.ModelViewSet):
    """
    AI 模型视图集

    API 端点:
    - GET    /api/llm/models/              # 列表
    - POST   /api/llm/models/              # 创建
    - GET    /api/llm/models/{id}/         # 详情
    - PUT    /api/llm/models/{id}/         # 完整更新
    - PATCH  /api/llm/models/{id}/         # 部分更新
    - DELETE /api/llm/models/{id}/         # 删除
    - POST   /api/llm/models/{id}/set_default/  # 设置/取消默认
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['endpoint']
    search_fields = ['name']
    ordering_fields = ['endpoint', 'name', 'created_at']
    ordering = ['endpoint', 'name']

    def get_queryset(self):
        """只返回当前用户拥有的端点关联的模型"""
        user_endpoints = Endpoint.objects.filter(owner=self.request.user)
        return AIModel.objects.filter(endpoint__in=user_endpoints).select_related('endpoint')

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return AIModelCreateSerializer
        if self.action in ['update', 'partial_update']:
            return AIModelUpdateSerializer
        return AIModelSerializer

    def list(self, request, *args, **kwargs):
        """列表"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return SuccessResponse(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        """详情"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return SuccessResponse(serializer.data)

    def create(self, request, *args, **kwargs):
        """创建"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return CreatedResponse(serializer.data, headers=headers)

    def update(self, request, *args, **kwargs):
        """更新"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return SuccessResponse(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """删除"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return NoContentResponse()

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """
        设置/取消默认模型

        POST /api/llm/models/{id}/set_default/
        """
        instance = self.get_object()
        user_endpoints = Endpoint.objects.filter(owner=request.user)

        # 检查权限
        if instance.endpoint not in user_endpoints:
            return ErrorResponse('无权操作此模型')

        # 切换默认状态
        new_status = not instance.is_default

        if new_status:
            # 设置为默认时，先取消其他模型的默认状态
            AIModel.objects.filter(
                endpoint__in=user_endpoints
            ).update(is_default=False)
            instance.is_default = True
            instance.save()
            return SuccessResponse({'message': '已设为默认模型', 'is_default': True})
        else:
            # 取消默认
            instance.is_default = False
            instance.save()
            return SuccessResponse({'message': '已取消默认', 'is_default': False})
