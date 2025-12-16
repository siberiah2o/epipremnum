"""
Unified View Dispatcher

This module provides the main ViewSets that dispatch to specialized handlers.
It maintains the same API interface as the original views.py while using
abstracted handlers internally.

Note: Endpoint and Model ViewSets have been moved to the endpoint app.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import OllamaImageAnalysis
from ..serializers import (
    OllamaImageAnalysisSerializer,
    OllamaImageAnalysisCreateSerializer,
    OllamaImageAnalysisTaskCreateSerializer,
    OllamaImageAnalysisTaskStatusSerializer,
    OllamaImageAnalysisTaskListSerializer,
    OllamaImageAnalysisTaskRetrySerializer,
    OllamaImageAnalysisTaskCancelSerializer
)
from .base import BaseViewSetMixin
from .analysis import AnalysisTaskHandler
from .batch_analysis import BatchAnalysisHandler


class OllamaAnalysisViewSet(BaseViewSetMixin, viewsets.GenericViewSet):
    """
    Ollama图片分析任务 ViewSet
    提供图片分析任务的创建、查询、管理等功能

    This ViewSet dispatches operations to specialized handlers:
    - Task operations: AnalysisTaskHandler
    - Batch operations: BatchAnalysisHandler
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

    # Batch Operations - dispatched to BatchAnalysisHandler
    @action(detail=False, methods=['post'])
    def batch_analyze(self, request):
        """批量创建分析任务"""
        handler = BatchAnalysisHandler(self)
        return handler.batch_analyze()

    @action(detail=False, methods=['post'])
    def batch_cancel(self, request):
        """批量取消任务"""
        handler = BatchAnalysisHandler(self)
        return handler.batch_cancel()

    @action(detail=False, methods=['post'])
    def batch_query(self, request):
        """批量查询任务状态"""
        handler = BatchAnalysisHandler(self)
        return handler.batch_query()