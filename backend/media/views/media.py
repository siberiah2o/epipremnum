"""
媒体视图

提供媒体文件的 CRUD 操作
"""

import logging
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from utils.responses import (
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    BadRequestResponse,
    NotFoundResponse,
)
from utils.pagination import StandardPagination
from utils.viewsets import BaseModelViewSet
from utils.exceptions import DuplicateError, ValidationError

from ..models import Media
from ..serializers import (
    MediaSerializer,
    MediaCreateSerializer,
    MediaUpdateSerializer,
    BatchDeleteSerializer,
)
from ..services import MediaService

logger = logging.getLogger(__name__)


class MediaViewSet(BaseModelViewSet):
    """
    媒体文件视图集

    API 端点:
    - GET    /api/media/           # 列表（支持分页）
    - POST   /api/media/           # 上传
    - GET    /api/media/{id}/      # 详情
    - PUT    /api/media/{id}/      # 更新
    - DELETE /api/media/{id}/      # 删除
    - GET    /api/media/images/    # 获取所有图片
    - POST   /api/media/batch_delete/  # 批量删除
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['type', 'category']
    ordering_fields = ['created_at', 'updated_at', 'filename', 'file_size']
    ordering = ['-created_at']

    def get_queryset(self):
        """只返回当前用户的媒体文件，支持按描述搜索"""
        queryset = Media.objects.filter(owner=self.request.user).select_related('category')

        # 自定义搜索：支持文件名、分类名、AI描述
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(filename__icontains=search_query) |
                Q(category__name__icontains=search_query) |
                Q(analyses__description__icontains=search_query)
            ).distinct()

        return queryset

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return MediaCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MediaUpdateSerializer
        return MediaSerializer

    def perform_create(self, serializer):
        """创建时自动设置所有者"""
        serializer.save(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        """上传媒体文件"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            media = MediaService.create_media(
                file=serializer.validated_data['file'],
                owner=request.user,
                filename=serializer.validated_data.get('filename'),
                category_id=serializer.validated_data.get('category'),
            )
            return CreatedResponse(MediaSerializer(media).data)

        except (DuplicateError, ValidationError) as e:
            return BadRequestResponse(message=str(e))

    def update(self, request, *args, **kwargs):
        """更新媒体文件信息"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        media = MediaService.update_media(
            media=instance,
            filename=serializer.validated_data.get('filename'),
            category_id=serializer.validated_data.get('category'),
        )
        return SuccessResponse(MediaSerializer(media).data)

    def destroy(self, request, *args, **kwargs):
        """删除媒体文件"""
        instance = self.get_object()
        MediaService.delete_media(instance)
        return NoContentResponse()

    @action(detail=False, methods=['get'])
    def images(self, request):
        """获取所有图片"""
        queryset = self.get_queryset().filter(type='image')

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = MediaSerializer(page, many=True)
            return self.paginator.get_paginated_response(serializer.data)

        serializer = MediaSerializer(queryset, many=True)
        return SuccessResponse(serializer.data)

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除媒体文件"""
        serializer = BatchDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = MediaService.batch_delete(
            media_ids=serializer.validated_data['media_ids'],
            user=request.user
        )

        return SuccessResponse({
            'message': f'成功删除 {result["deleted"]} 个文件',
            **result
        })
