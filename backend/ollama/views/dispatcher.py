"""
Unified View Dispatcher

This module provides the main ViewSets that dispatch to specialized handlers.
It maintains the same API interface as the original views.py while using
abstracted handlers internally.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from ..models import OllamaEndpoint, OllamaAIModel
from ..serializers import (
    OllamaEndpointSerializer,
    OllamaEndpointCreateSerializer,
    OllamaEndpointUpdateSerializer,
    OllamaAIModelSerializer
)
from .base import BaseViewSetMixin
from .endpoint import EndpointCRUDHandler, EndpointManagementHandler
from .model import ModelCRUDHandler, ModelManagementHandler
from .connection import ConnectionTestHandler
from .sync import ModelSyncHandler
from .analysis import AnalysisTaskHandler, AnalysisBatchHandler


class OllamaEndpointViewSet(BaseViewSetMixin, viewsets.ModelViewSet):
    """
    Ollama端点管理 ViewSet
    提供完整的增删改查功能

    This ViewSet dispatches operations to specialized handlers:
    - CRUD operations: EndpointCRUDHandler
    - Management operations: EndpointManagementHandler
    - Connection testing: ConnectionTestHandler
    - Model synchronization: ModelSyncHandler
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = OllamaEndpoint.objects.all()

    def get_queryset(self):
        """只获取当前用户的端点"""
        return OllamaEndpoint.objects.filter(created_by=self.request.user)

    def get_serializer_class(self):
        """根据操作选择不同的序列化器"""
        serializer_mapping = {
            'create': OllamaEndpointCreateSerializer,
            'update': OllamaEndpointUpdateSerializer,
            'partial_update': OllamaEndpointUpdateSerializer,
            'default': OllamaEndpointSerializer
        }
        return self.get_serializer_class_by_action(serializer_mapping)

    def perform_create(self, serializer):
        """创建端点时设置创建者"""
        serializer.save(created_by=self.request.user)

    # CRUD Operations - dispatched to EndpointCRUDHandler
    def create(self, request, *args, **kwargs):
        """创建端点 (CREATE)"""
        handler = EndpointCRUDHandler(self)
        return handler.create()

    def list(self, request, *args, **kwargs):
        """获取端点列表 (READ - List)"""
        handler = EndpointCRUDHandler(self)
        return handler.list()

    def retrieve(self, request, *args, **kwargs):
        """获取单个端点详情 (READ - Detail)"""
        handler = EndpointCRUDHandler(self)
        return handler.retrieve()

    def update(self, request, *args, **kwargs):
        """更新端点 (UPDATE)"""
        handler = EndpointCRUDHandler(self)
        return handler.update()

    def destroy(self, request, *args, **kwargs):
        """删除端点 (DELETE)"""
        handler = EndpointCRUDHandler(self)
        return handler.destroy()

    # Management Operations - dispatched to EndpointManagementHandler
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """设置为默认端点"""
        handler = EndpointManagementHandler(self)
        return handler.set_default(pk)

    @action(detail=False, methods=['get'])
    def default(self, request):
        """获取默认端点"""
        handler = EndpointManagementHandler(self)
        return handler.get_default()

    # Connection Testing - dispatched to ConnectionTestHandler
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试端点连接"""
        handler = ConnectionTestHandler(self)
        return handler.test_connection(pk)

    # Model Synchronization - dispatched to ModelSyncHandler
    @action(detail=True, methods=['post'])
    def pull_models(self, request, pk=None):
        """从端点拉取所有模型"""
        handler = ModelSyncHandler(self)
        return handler.pull_models(pk)


class OllamaAIModelViewSet(BaseViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    Ollama模型管理 ViewSet
    只提供查询功能，模型数据完全来自Ollama API

    This ViewSet dispatches operations to specialized handlers:
    - Read operations: ModelCRUDHandler
    - Management operations: ModelManagementHandler
    - Synchronization: ModelSyncHandler
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = OllamaAIModel.objects.all()

    def get_queryset(self):
        """只获取当前用户端点的模型"""
        return OllamaAIModel.objects.filter(
            endpoint__created_by=self.request.user
        ).select_related('endpoint')

    def get_serializer_class(self):
        """只使用基础序列化器"""
        return OllamaAIModelSerializer

    # Read Operations - dispatched to ModelCRUDHandler
    def list(self, request, *args, **kwargs):
        """获取模型列表 (READ - List)"""
        handler = ModelCRUDHandler(self)
        return handler.list()

    def retrieve(self, request, *args, **kwargs):
        """获取单个模型详情 (READ - Detail)"""
        handler = ModelCRUDHandler(self)
        return handler.retrieve()

    # Management Operations - dispatched to ModelManagementHandler
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """设置为默认模型"""
        handler = ModelManagementHandler(self)
        return handler.set_default(pk)

    @action(detail=True, methods=['post'])
    def set_vision_capable(self, request, pk=None):
        """设置模型视觉能力"""
        handler = ModelManagementHandler(self)
        return handler.set_vision_capable(pk)

    @action(detail=False, methods=['get'])
    def default(self, request):
        """获取默认模型"""
        handler = ModelManagementHandler(self)
        return handler.get_default()

    @action(detail=False, methods=['get'])
    def vision_models(self, request):
        """获取支持视觉的模型"""
        handler = ModelManagementHandler(self)
        return handler.get_vision_models()

    # Synchronization - dispatched to ModelSyncHandler
    @action(detail=False, methods=['post'])
    def refresh_all(self, request):
        """刷新所有端点的模型数据"""
        handler = ModelSyncHandler(self)
        return handler.refresh_all_models()


class OllamaAnalysisViewSet(BaseViewSetMixin, viewsets.GenericViewSet):
    """
    Ollama图片分析任务 ViewSet
    提供图片分析任务的创建、查询、管理等功能

    This ViewSet dispatches operations to specialized handlers:
    - Task operations: AnalysisTaskHandler
    - Batch operations: AnalysisBatchHandler
    """
    permission_classes = [permissions.IsAuthenticated]

    # Task Operations - dispatched to AnalysisTaskHandler
    def create(self, request, *args, **kwargs):
        """创建图片分析任务"""
        handler = AnalysisTaskHandler(self)
        return handler.create_task()

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """获取分析任务状态"""
        handler = AnalysisTaskHandler(self)
        return handler.get_task_status(pk)

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """重试失败的分析任务"""
        handler = AnalysisTaskHandler(self)
        return handler.retry_task(pk)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """取消正在进行的分析任务"""
        handler = AnalysisTaskHandler(self)
        return handler.cancel_task(pk)

    @action(detail=False, methods=['get'])
    def list_tasks(self, request):
        """获取用户的任务列表"""
        handler = AnalysisTaskHandler(self)
        return handler.list_tasks()

    # Batch Operations - dispatched to AnalysisBatchHandler
    @action(detail=False, methods=['post'])
    def batch_analyze(self, request):
        """批量创建分析任务"""
        handler = AnalysisBatchHandler(self)
        return handler.batch_create_tasks()

    @action(detail=False, methods=['post'])
    def batch_cancel(self, request):
        """批量取消任务"""
        handler = AnalysisBatchHandler(self)
        return handler.batch_cancel_tasks()