import os
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status, viewsets, permissions
from rest_framework.decorators import action
from .models import Media, Category, Tag
from .serializers import (
    MediaSerializer, MediaListSerializer, MediaUploadSerializer,
    CategorySerializer, TagSerializer
)
from users.exceptions import (
    FileNotFoundException,
    FileUploadException,
    FolderNotFoundException
)
from utils.responses import (
    success_response,
    error_response,
    not_found_response,
    paginated_response
)


class MediaViewSet(viewsets.GenericViewSet):
    """媒体文件管理 ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Media.objects.all()

    def get_serializer_class(self):
        """根据 action 选择序列化器"""
        if self.action == 'list':
            return MediaListSerializer
        elif self.action == 'upload':
            return MediaUploadSerializer
        elif self.action == 'retrieve':
            return MediaSerializer
        return MediaSerializer

    def get_queryset(self):
        """获取当前用户的媒体文件"""
        return Media.objects.filter(user=self.request.user)

    def list(self, request):
        """获取用户的媒体文件列表"""
        queryset = self.get_queryset()
        
        # 支持按文件类型过滤
        file_type = request.query_params.get('file_type', None)
        if file_type:
            queryset = queryset.filter(file_type=file_type)
        
        # 支持按分类过滤
        category_id = request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(categories__id=category_id)
        
        # 支持按标签过滤
        tag_id = request.query_params.get('tag', None)
        if tag_id:
            queryset = queryset.filter(tags__id=tag_id)
        
        # 支持搜索
        search = request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(prompt__icontains=search)
            )
        
        # 分页
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = queryset.count()
        items = queryset[start:end]
        
        serializer = self.get_serializer(items, many=True, context={'request': request})
        
        return paginated_response(
            data=serializer.data,
            count=total,
            page=page,
            page_size=page_size,
            message='获取媒体文件列表成功'
        )

    def retrieve(self, request, pk=None):
        """获取特定媒体文件详情"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        serializer = self.get_serializer(media, context={'request': request})
        return success_response(
            data=serializer.data,
            message='获取媒体文件详情成功'
        )

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """上传媒体文件"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            # 保存媒体文件
            media = serializer.save(user=request.user)

            # 返回完整的媒体信息
            response_serializer = MediaSerializer(media, context={'request': request})
            return success_response(
                data=response_serializer.data,
                message='媒体文件上传成功',
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            # 对于文件上传相关的错误，记录实际错误信息并抛出更详细的异常
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"文件上传失败: {str(e)}", exc_info=True)
            
            # 根据错误类型返回不同的错误信息
            error_message = str(e)
            if "file_type" in error_message.lower() or "extension" in error_message.lower():
                raise FileUploadException("不支持的文件类型")
            elif "size" in error_message.lower() or "too large" in error_message.lower():
                raise FileUploadException("文件大小超出限制")
            elif "permission" in error_message.lower():
                raise FileUploadException("文件权限不足")
            else:
                raise FileUploadException(f"媒体文件上传失败: {str(e)}")

    @action(detail=True, methods=['post'], url_path='update')
    def update_media(self, request, pk=None):
        """更新媒体文件信息"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        serializer = MediaSerializer(media, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)

        serializer.save()
        return success_response(
            data=serializer.data,
            message='媒体文件更新成功'
        )

    @action(detail=True, methods=['post'], url_path='delete')
    def delete_media(self, request, pk=None):
        """删除媒体文件"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        media.delete()
        return success_response(
            message='媒体文件删除成功',
            data=None
        )

    @action(detail=True, methods=['post'])
    def add_categories(self, request, pk=None):
        """为媒体添加分类"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        category_ids = request.data.get('category_ids', [])

        if not category_ids:
            return error_response(
                message='请提供分类ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        categories = Category.objects.filter(id__in=category_ids, user=request.user)
        if not categories:
            return not_found_response('分类')

        media.categories.add(*categories)
        return success_response(
            message='分类添加成功',
            data=None
        )

    @action(detail=True, methods=['post'])
    def remove_categories(self, request, pk=None):
        """移除媒体的分类"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        category_ids = request.data.get('category_ids', [])

        if not category_ids:
            return error_response(
                message='请提供分类ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        categories = Category.objects.filter(id__in=category_ids, user=request.user)
        media.categories.remove(*categories)
        return success_response(
            message='分类移除成功',
            data=None
        )

    @action(detail=True, methods=['post'])
    def add_tags(self, request, pk=None):
        """为媒体添加标签"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        tag_ids = request.data.get('tag_ids', [])

        if not tag_ids:
            return error_response(
                message='请提供标签ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
        if not tags:
            return not_found_response('标签')

        media.tags.add(*tags)
        return success_response(
            message='标签添加成功',
            data=None
        )

    @action(detail=True, methods=['post'])
    def remove_tags(self, request, pk=None):
        """移除媒体的标签"""
        try:
            media = self.get_queryset().get(pk=pk)
        except Media.DoesNotExist:
            raise FileNotFoundException("媒体文件不存在")

        tag_ids = request.data.get('tag_ids', [])

        if not tag_ids:
            return error_response(
                message='请提供标签ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
        media.tags.remove(*tags)
        return success_response(
            message='标签移除成功',
            data=None
        )


class CategoryViewSet(viewsets.ModelViewSet):
    """分类管理 ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CategorySerializer

    def get_queryset(self):
        """获取当前用户的分类"""
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """创建分类时设置用户"""
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """创建分类"""
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            # 处理数据库唯一约束错误
            if "UNIQUE constraint failed" in str(e) and "media_category.user_id, media_category.name" in str(e):
                from users.exceptions import BusinessException
                raise BusinessException(
                    message='该分类名称已存在',
                    code=status.HTTP_409_CONFLICT,
                    status_code=status.HTTP_409_CONFLICT
                )
            # 重新抛出其他异常
            raise

    def list(self, request, *args, **kwargs):
        """获取分类列表，返回标准响应格式"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message='获取分类列表成功'
        )

    def retrieve(self, request, *args, **kwargs):
        """获取分类详情，返回标准响应格式"""
        try:
            instance = self.get_object()
        except Category.DoesNotExist:
            raise FolderNotFoundException("分类不存在")

        serializer = self.get_serializer(instance)
        return success_response(
            data=serializer.data,
            message='获取分类详情成功'
        )

    @action(detail=True, methods=['post'], url_path='update')
    def update_category(self, request, pk=None):
        """更新分类"""
        try:
            category = self.get_object()
        except Category.DoesNotExist:
            raise FolderNotFoundException("分类不存在")

        serializer = self.get_serializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        serializer.save()
        return success_response(
            data=serializer.data,
            message='分类更新成功'
        )

    @action(detail=True, methods=['post'], url_path='delete')
    def delete_category(self, request, pk=None):
        """删除分类"""
        try:
            category = self.get_object()
        except Category.DoesNotExist:
            raise FolderNotFoundException("分类不存在")

        category.delete()
        return success_response(
            message='分类删除成功',
            data=None
        )


class TagViewSet(viewsets.ModelViewSet):
    """标签管理 ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = Tag.objects.all()
    serializer_class = TagSerializer

    def get_queryset(self):
        """获取当前用户的标签"""
        return Tag.objects.filter(user=self.request.user)

    def list(self, request):
        """获取用户的标签列表"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data=serializer.data,
            message='获取标签列表成功'
        )

    def retrieve(self, request, pk=None):
        """获取特定标签详情"""
        try:
            tag = self.get_queryset().get(pk=pk)
        except Tag.DoesNotExist:
            raise FolderNotFoundException("标签不存在")

        serializer = self.get_serializer(tag)
        return success_response(
            data=serializer.data,
            message='获取标签详情成功'
        )

    def create(self, request):
        """创建标签"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            tag = serializer.save(user=request.user)
            return success_response(
                data=serializer.data,
                message='标签创建成功',
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            # 处理数据库唯一约束错误
            if "UNIQUE constraint failed" in str(e) and "media_tag.user_id, media_tag.name" in str(e):
                from users.exceptions import BusinessException
                raise BusinessException(
                    message='该标签名称已存在',
                    code=status.HTTP_409_CONFLICT,
                    status_code=status.HTTP_409_CONFLICT
                )
            # 重新抛出其他异常
            raise

    @action(detail=True, methods=['post'], url_path='update')
    def update_tag(self, request, pk=None):
        """更新标签"""
        try:
            tag = self.get_queryset().get(pk=pk)
        except Tag.DoesNotExist:
            raise FolderNotFoundException("标签不存在")

        serializer = self.get_serializer(tag, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        serializer.save()
        return success_response(
            data=serializer.data,
            message='标签更新成功'
        )

    @action(detail=True, methods=['post'], url_path='delete')
    def delete_tag(self, request, pk=None):
        """删除标签"""
        try:
            tag = self.get_queryset().get(pk=pk)
        except Tag.DoesNotExist:
            raise FolderNotFoundException("标签不存在")

        tag.delete()
        return success_response(
            message='标签删除成功',
            data=None
        )

    # ============ 批量操作 ============

    @action(detail=False, methods=['post'], url_path='batch-delete')
    def batch_delete(self, request):
        """批量删除媒体文件"""
        ids = request.data.get('ids', [])
        if not ids:
            return error_response(
                message='请提供要删除的文件ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取当前用户的媒体文件
            media_files = Media.objects.filter(
                user=request.user,
                id__in=ids
            )

            if len(media_files) != len(ids):
                return error_response(
                    message='部分文件不存在或无权访问',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 批量删除
            deleted_count, _ = media_files.delete()

            return success_response(
                message=f'成功删除 {deleted_count} 个文件',
                data={'deleted_count': deleted_count}
            )

        except Exception as e:
            return error_response(
                message=f'批量删除失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='batch-update-categories')
    def batch_update_categories(self, request):
        """批量更新媒体文件的分类"""
        ids = request.data.get('ids', [])
        category_ids = request.data.get('category_ids', [])

        if not ids:
            return error_response(
                message='请提供要更新的文件ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取当前用户的媒体文件
            media_files = Media.objects.filter(
                user=request.user,
                id__in=ids
            )

            if len(media_files) != len(ids):
                return error_response(
                    message='部分文件不存在或无权访问',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 获取分类
            categories = Category.objects.filter(
                user=request.user,
                id__in=category_ids
            )

            # 批量更新分类
            for media in media_files:
                media.categories.set(categories)

            return success_response(
                message=f'成功为 {len(media_files)} 个文件更新分类',
                data={'updated_count': len(media_files)}
            )

        except Exception as e:
            return error_response(
                message=f'批量更新分类失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='batch-add-tags')
    def batch_add_tags(self, request):
        """批量为媒体文件添加标签"""
        ids = request.data.get('ids', [])
        tag_ids = request.data.get('tag_ids', [])

        if not ids or not tag_ids:
            return error_response(
                message='请提供文件ID列表和标签ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取当前用户的媒体文件
            media_files = Media.objects.filter(
                user=request.user,
                id__in=ids
            )

            if len(media_files) != len(ids):
                return error_response(
                    message='部分文件不存在或无权访问',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 获取标签
            tags = Tag.objects.filter(
                user=request.user,
                id__in=tag_ids
            )

            if len(tags) != len(tag_ids):
                return error_response(
                    message='部分标签不存在',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 批量添加标签
            for media in media_files:
                # 添加新标签，保留已有标签
                media.tags.add(*tags)

            return success_response(
                message=f'成功为 {len(media_files)} 个文件添加标签',
                data={'updated_count': len(media_files)}
            )

        except Exception as e:
            return error_response(
                message=f'批量添加标签失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='batch-remove-tags')
    def batch_remove_tags(self, request):
        """批量从媒体文件移除标签"""
        ids = request.data.get('ids', [])
        tag_ids = request.data.get('tag_ids', [])

        if not ids or not tag_ids:
            return error_response(
                message='请提供文件ID列表和标签ID列表',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取当前用户的媒体文件
            media_files = Media.objects.filter(
                user=request.user,
                id__in=ids
            )

            if len(media_files) != len(ids):
                return error_response(
                    message='部分文件不存在或无权访问',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 获取标签
            tags = Tag.objects.filter(
                user=request.user,
                id__in=tag_ids
            )

            if len(tags) != len(tag_ids):
                return error_response(
                    message='部分标签不存在',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            # 批量移除标签
            for media in media_files:
                # 移除指定标签
                media.tags.remove(*tags)

            return success_response(
                message=f'成功从 {len(media_files)} 个文件移除标签',
                data={'updated_count': len(media_files)}
            )

        except Exception as e:
            return error_response(
                message=f'批量移除标签失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
