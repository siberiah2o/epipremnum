"""
API 端点视图

管理 AI API 端点的 CRUD 操作
"""

import logging
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
)
from llm.models import Endpoint
from llm.serializers import EndpointSerializer, EndpointCreateSerializer
from llm.services.providers import get_provider_for_endpoint
from llm.exceptions import NetworkError, TimeoutError, APIError

logger = logging.getLogger(__name__)


class EndpointViewSet(viewsets.ModelViewSet):
    """
    API 端点视图集

    API 端点:
    - GET    /api/llm/endpoints/           # 列表
    - POST   /api/llm/endpoints/           # 创建
    - GET    /api/llm/endpoints/{id}/      # 详情
    - PUT    /api/llm/endpoints/{id}/      # 完整更新
    - PATCH  /api/llm/endpoints/{id}/      # 部分更新
    - DELETE /api/llm/endpoints/{id}/      # 删除
    """

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'base_url']
    ordering_fields = ['name', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """只返回当前用户的端点"""
        return Endpoint.objects.filter(owner=self.request.user).select_related('owner')

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return EndpointCreateSerializer
        return EndpointSerializer

    def perform_create(self, serializer):
        """创建时自动设置所有者"""
        serializer.save(owner=self.request.user)

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

    @action(detail=True, methods=['get'])
    def available_models(self, request, pk=None):
        """
        获取指定端点的可用模型列表

        从远程 API 端点获取当前可用的模型列表（如 Ollama 的 /api/tags）
        """
        endpoint = self.get_object()

        try:
            provider = get_provider_for_endpoint(endpoint)
            models = provider.get_available_models()
            return SuccessResponse({
                'models': models,
                'endpoint_id': endpoint.id,
                'endpoint_name': endpoint.name,
                'provider_type': endpoint.provider_type,
            })
        except NetworkError as e:
            logger.error(f"获取模型列表网络错误: {e}")
            return Response({
                'code': 503,
                'message': f'无法连接到 {endpoint.name}，请检查网络或 URL 配置',
                'data': None
            }, status=503)
        except TimeoutError as e:
            logger.error(f"获取模型列表超时: {e}")
            return Response({
                'code': 504,
                'message': f'连接 {endpoint.name} 超时，请稍后重试',
                'data': None
            }, status=504)
        except APIError as e:
            logger.error(f"获取模型列表 API 错误: {e}")
            return Response({
                'code': 500,
                'message': f'获取模型列表失败: {str(e)}',
                'data': None
            }, status=500)
        except Exception as e:
            logger.exception(f"获取模型列表未知错误: {e}")
            return Response({
                'code': 500,
                'message': f'获取模型列表失败: {str(e)}',
                'data': None
            }, status=500)

    @action(detail=True, methods=['post'])
    def sync_models(self, request, pk=None):
        """
        同步端点的可用模型到数据库（仅 Ollama 支持）

        从 Ollama 端点获取可用模型并自动添加到数据库
        """
        from llm.models import AIModel

        endpoint = self.get_object()

        # 只有 Ollama 支持自动同步
        if endpoint.provider_type != 'ollama':
            return Response({
                'code': 400,
                'message': '只有 Ollama 端点支持自动同步模型',
                'data': None
            }, status=400)

        try:
            provider = get_provider_for_endpoint(endpoint)
            remote_models = provider.get_available_models()

            # 获取已存在的模型
            existing_models = set(
                AIModel.objects.filter(endpoint=endpoint).values_list('name', flat=True)
            )

            # 添加新模型
            added_count = 0
            for model_name in remote_models:
                if model_name not in existing_models:
                    AIModel.objects.create(
                        endpoint=endpoint,
                        name=model_name,
                        is_default=False
                    )
                    added_count += 1

            return SuccessResponse({
                'synced': added_count,
                'total': len(remote_models),
                'models': remote_models,
                'message': f'成功同步 {added_count} 个新模型'
            })

        except NetworkError as e:
            logger.error(f"同步模型网络错误: {e}")
            return Response({
                'code': 503,
                'message': f'无法连接到 {endpoint.name}，请检查网络或 URL 配置',
                'data': None
            }, status=503)
        except TimeoutError as e:
            logger.error(f"同步模型超时: {e}")
            return Response({
                'code': 504,
                'message': f'连接 {endpoint.name} 超时，请稍后重试',
                'data': None
            }, status=504)
        except APIError as e:
            logger.error(f"同步模型 API 错误: {e}")
            return Response({
                'code': 500,
                'message': f'同步模型失败: {str(e)}',
                'data': None
            }, status=500)
        except Exception as e:
            logger.exception(f"同步模型未知错误: {e}")
            return Response({
                'code': 500,
                'message': f'同步模型失败: {str(e)}',
                'data': None
            }, status=500)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """
        设置默认端点
        """
        endpoint = self.get_object()

        # 清除其他端点的默认状态
        Endpoint.objects.filter(owner=request.user).update(is_default=False)

        # 设置当前端点为默认
        endpoint.is_default = True
        endpoint.save(update_fields=['is_default'])

        return SuccessResponse({
            'id': endpoint.id,
            'name': endpoint.name,
            'is_default': True,
            'message': f'已将 {endpoint.name} 设为默认端点'
        })
