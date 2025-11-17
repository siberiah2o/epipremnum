import logging
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from .models import AIAnalysis, OllamaModel, BatchAnalysisJob, SuggestedCategory, SuggestedTag, OllamaEndpoint
from .services import get_ai_analysis_service, OllamaAPIError
from media.models import Media, Category, Tag

logger = logging.getLogger(__name__)


class AnalyzeImageView(APIView):
    """单张图片分析视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="分析图片",
        description="使用Ollama AI模型分析图片，生成标题、描述、提示词、分类和标签建议",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'}
                },
                'required': ['media_id']
            }
        },
        responses={200: {'type': 'object'}}
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行AI分析
            service = get_ai_analysis_service()
            ai_analysis = service.analyze_media_file(
                media_file=media_file,
                user=request.user,
                model_name=model_name
            )

            # 返回分析结果
            response_data = {
                'id': ai_analysis.id,
                'status': ai_analysis.status,
                'ai_title': ai_analysis.ai_title,
                'ai_description': ai_analysis.ai_description,
                'ai_prompt': ai_analysis.ai_prompt,
                'model_used': ai_analysis.model_used,
                'analysis_result': ai_analysis.analysis_result,
                'created_at': ai_analysis.created_at,
                'analyzed_at': ai_analysis.analyzed_at
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"Ollama API错误: {str(e)}")
            return Response(
                {'error': f'AI分析失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"图片分析失败: {str(e)}")
            return Response(
                {'error': '分析失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BatchAnalyzeView(APIView):
    """批量分析视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="批量分析图片",
        description="批量分析多张图片，返回分析任务ID",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'media_ids': {
                        'type': 'array',
                        'items': {'type': 'integer'},
                        'description': '媒体文件ID列表'
                    },
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'}
                },
                'required': ['media_ids']
            }
        },
        responses={200: {'type': 'object'}}
    )
    def post(self, request):
        media_ids = request.data.get('media_ids', [])
        model_name = request.data.get('model_name')

        if not media_ids:
            return Response(
                {'error': '请提供媒体文件ID列表'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_files = Media.objects.filter(
                id__in=media_ids,
                user=request.user,
                file_type='image'
            )

            if len(media_files) != len(media_ids):
                return Response(
                    {'error': '部分媒体文件不存在或不是图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行批量分析
            service = get_ai_analysis_service()
            batch_job = service.batch_analyze_media_files(
                media_files=list(media_files),
                user=request.user,
                model_name=model_name
            )

            response_data = {
                'job_id': batch_job.id,
                'status': batch_job.status,
                'total_files': batch_job.total_files,
                'created_at': batch_job.created_at
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"批量分析失败: {str(e)}")
            return Response(
                {'error': '批量分析失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BatchAnalysisStatusView(APIView):
    """批量分析状态视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="获取批量分析状态",
        description="根据任务ID获取批量分析的进度和状态",
        parameters=[
            OpenApiParameter(
                name='job_id',
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
                description='批量分析任务ID'
            )
        ],
        responses={200: {'type': 'object'}}
    )
    def get(self, request, job_id):
        try:
            batch_job = get_object_or_404(
                BatchAnalysisJob,
                id=job_id,
                user=request.user
            )

            response_data = {
                'job_id': batch_job.id,
                'status': batch_job.status,
                'total_files': batch_job.total_files,
                'processed_files': batch_job.processed_files,
                'failed_files': batch_job.failed_files,
                'progress_percentage': batch_job.progress_percentage,
                'error_message': batch_job.error_message,
                'started_at': batch_job.started_at,
                'completed_at': batch_job.completed_at,
                'created_at': batch_job.created_at
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"获取批量分析状态失败: {str(e)}")
            return Response(
                {'error': '获取状态失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AnalysisResultView(APIView):
    """分析结果视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="获取分析结果",
        description="获取指定媒体文件的AI分析结果",
        parameters=[
            OpenApiParameter(
                name='media_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='媒体文件ID'
            )
        ],
        responses={200: {'type': 'object'}}
    )
    def get(self, request, media_id):
        try:
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            try:
                ai_analysis = media_file.ai_analysis
            except AIAnalysis.DoesNotExist:
                return Response(
                    {'error': '该媒体文件尚未进行AI分析'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取建议的分类和标签
            suggested_categories = []
            for suggested_cat in ai_analysis.suggested_categories.all():
                suggested_categories.append({
                    'id': suggested_cat.category.id,
                    'name': suggested_cat.category.name,
                    'confidence': suggested_cat.confidence
                })

            suggested_tags = []
            for suggested_tag in ai_analysis.suggested_tags.all():
                suggested_tags.append({
                    'id': suggested_tag.tag.id,
                    'name': suggested_tag.tag.name,
                    'confidence': suggested_tag.confidence
                })

            response_data = {
                'id': ai_analysis.id,
                'status': ai_analysis.status,
                'ai_title': ai_analysis.ai_title,
                'ai_description': ai_analysis.ai_description,
                'ai_prompt': ai_analysis.ai_prompt,
                'model_used': ai_analysis.model_used,
                'analysis_result': ai_analysis.analysis_result,
                'suggested_categories': suggested_categories,
                'suggested_tags': suggested_tags,
                'error_message': ai_analysis.error_message,
                'created_at': ai_analysis.created_at,
                'analyzed_at': ai_analysis.analyzed_at
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"获取分析结果失败: {str(e)}")
            return Response(
                {'error': '获取结果失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ApplyAnalysisSuggestionsView(APIView):
    """应用分析建议视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="应用AI分析建议",
        description="将AI分析的建议应用到媒体文件（标题、描述、分类、标签）",
        parameters=[
            OpenApiParameter(
                name='media_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='媒体文件ID'
            )
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'apply_title': {'type': 'boolean', 'description': '是否应用标题'},
                    'apply_description': {'type': 'boolean', 'description': '是否应用描述'},
                    'apply_prompt': {'type': 'boolean', 'description': '是否应用提示词'},
                    'apply_categories': {'type': 'boolean', 'description': '是否应用分类'},
                    'apply_tags': {'type': 'boolean', 'description': '是否应用标签'},
                    'category_ids': {
                        'type': 'array',
                        'items': {'type': 'integer'},
                        'description': '要应用的分类ID列表'
                    },
                    'tag_ids': {
                        'type': 'array',
                        'items': {'type': 'integer'},
                        'description': '要应用的标签ID列表'
                    }
                }
            }
        },
        responses={200: {'type': 'object'}}
    )
    def post(self, request, media_id):
        try:
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            try:
                ai_analysis = media_file.ai_analysis
            except AIAnalysis.DoesNotExist:
                return Response(
                    {'error': '该媒体文件尚未进行AI分析'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if ai_analysis.status != 'completed':
                return Response(
                    {'error': 'AI分析尚未完成'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取应用选项
            apply_title = request.data.get('apply_title', False)
            apply_description = request.data.get('apply_description', False)
            apply_prompt = request.data.get('apply_prompt', False)
            apply_categories = request.data.get('apply_categories', False)
            apply_tags = request.data.get('apply_tags', False)
            category_ids = request.data.get('category_ids', [])
            tag_ids = request.data.get('tag_ids', [])

            with transaction.atomic():
                # 应用标题
                if apply_title and ai_analysis.ai_title:
                    media_file.title = ai_analysis.ai_title

                # 应用描述
                if apply_description and ai_analysis.ai_description:
                    media_file.description = ai_analysis.ai_description

                # 应用提示词
                if apply_prompt and ai_analysis.ai_prompt:
                    media_file.prompt = ai_analysis.ai_prompt

                # 应用分类
                if apply_categories and category_ids:
                    from media.models import Category
                    categories = Category.objects.filter(
                        id__in=category_ids,
                        user=request.user
                    )
                    media_file.categories.set(categories)

                # 应用标签
                if apply_tags and tag_ids:
                    from media.models import Tag
                    tags = Tag.objects.filter(
                        id__in=tag_ids,
                        user=request.user
                    )
                    media_file.tags.set(tags)

                media_file.save()

            return Response(
                {'message': '建议应用成功'},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"应用分析建议失败: {str(e)}")
            return Response(
                {'error': '应用建议失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AvailableModelsView(APIView):
    """可用模型视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="获取可用模型",
        description="获取所有可用的Ollama AI模型列表"
    )
    def get(self, request):
        try:
            # 获取可用的模型
            service = get_ai_analysis_service()
            models = service.get_available_models()

            model_data = []
            for model in models:
                model_data.append({
                    'id': model.id,
                    'name': model.name,
                    'display_name': model.display_name,
                    'description': model.description,
                    'is_active': model.is_active,
                    'is_vision_capable': model.is_vision_capable,
                    'model_size': model.model_size,
                    'api_endpoint': model.api_endpoint
                })

            return Response({
                'models': model_data,
                'total': len(model_data)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"获取可用模型失败: {str(e)}")
            return Response(
                {'error': '获取模型失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
@extend_schema(
    summary="测试Ollama连接",
    description="测试与Ollama服务的连接状态"
)
def test_ollama_connection(request):
    """测试Ollama连接"""
    try:
        from .services import OllamaClient
        client = OllamaClient()
        models = client.list_models()

        return Response({
            'status': 'success',
            'message': 'Ollama服务连接成功',
            'available_models': len(models),
            'models': [model.get('name', '') for model in models[:5]]  # 只返回前5个模型名
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"测试Ollama连接失败: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'Ollama服务连接失败: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OllamaEndpointManager(APIView):
    """Ollama端点管理视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="获取Ollama服务端点列表",
        description="获取所有配置的Ollama服务端点"
    )
    def get(self, request):
        """获取端点列表"""
        endpoints = OllamaEndpoint.objects.all()
        endpoint_data = []

        for endpoint in endpoints:
            endpoint_data.append({
                'id': endpoint.id,
                'name': endpoint.name,
                'url': endpoint.url,
                'description': endpoint.description,
                'is_active': endpoint.is_active,
                'is_default': endpoint.is_default,
                'timeout': endpoint.timeout,
                'created_by': endpoint.created_by.username,
                'created_at': endpoint.created_at,
                'updated_at': endpoint.updated_at
            })

        return Response({
            'endpoints': endpoint_data,
            'total': len(endpoint_data)
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="创建新的Ollama服务端点",
        description="添加一个新的Ollama服务端点配置",
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string', 'description': '端点名称'},
                    'url': {'type': 'string', 'description': '服务端点URL'},
                    'description': {'type': 'string', 'description': '描述（可选）'},
                    'is_default': {'type': 'boolean', 'description': '是否设为默认端点'},
                    'timeout': {'type': 'integer', 'description': '超时时间（秒）'}
                },
                'required': ['name', 'url']
            }
        }
    )
    def post(self, request):
        """创建新端点"""
        try:
            name = request.data.get('name')
            url = request.data.get('url')
            description = request.data.get('description', '')
            is_default = request.data.get('is_default', False)
            timeout = request.data.get('timeout', 300)

            if not name or not url:
                return Response(
                    {'error': '请提供端点名称和URL'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            endpoint = OllamaEndpoint.objects.create(
                name=name,
                url=url,
                description=description,
                is_default=is_default,
                timeout=timeout,
                created_by=request.user
            )

            return Response({
                'message': '端点创建成功',
                'endpoint': {
                    'id': endpoint.id,
                    'name': endpoint.name,
                    'url': endpoint.url,
                    'description': endpoint.description,
                    'is_active': endpoint.is_active,
                    'is_default': endpoint.is_default,
                    'timeout': endpoint.timeout
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"创建端点失败: {str(e)}")
            return Response(
                {'error': '创建端点失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OllamaEndpointDetail(APIView):
    """Ollama端点详情管理视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="获取端点详情",
        description="获取指定端点的详细信息",
        parameters=[
            OpenApiParameter(
                name='endpoint_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='端点ID'
            )
        ]
    )
    def get(self, request, endpoint_id):
        """获取端点详情"""
        endpoint = get_object_or_404(OllamaEndpoint, id=endpoint_id)

        return Response({
            'id': endpoint.id,
            'name': endpoint.name,
            'url': endpoint.url,
            'description': endpoint.description,
            'is_active': endpoint.is_active,
            'is_default': endpoint.is_default,
            'timeout': endpoint.timeout,
            'created_by': endpoint.created_by.username,
            'created_at': endpoint.created_at,
            'updated_at': endpoint.updated_at
        })

    @extend_schema(
        summary="更新端点配置",
        description="更新指定端点的配置信息",
        parameters=[
            OpenApiParameter(
                name='endpoint_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='端点ID'
            )
        ],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'name': {'type': 'string', 'description': '端点名称'},
                    'url': {'type': 'string', 'description': '服务端点URL'},
                    'description': {'type': 'string', 'description': '描述'},
                    'is_active': {'type': 'boolean', 'description': '是否激活'},
                    'is_default': {'type': 'boolean', 'description': '是否设为默认端点'},
                    'timeout': {'type': 'integer', 'description': '超时时间（秒）'}
                }
            }
        }
    )
    def put(self, request, endpoint_id):
        """更新端点"""
        try:
            endpoint = get_object_or_404(OllamaEndpoint, id=endpoint_id)

            # 只允许创建者或超级用户修改
            if endpoint.created_by != request.user and not request.user.is_superuser:
                return Response(
                    {'error': '只有创建者可以修改端点配置'},
                    status=status.HTTP_403_FORBIDDEN
                )

            name = request.data.get('name')
            url = request.data.get('url')
            description = request.data.get('description', '')
            is_active = request.data.get('is_active')
            is_default = request.data.get('is_default', False)
            timeout = request.data.get('timeout', 300)

            if name:
                endpoint.name = name
            if url:
                endpoint.url = url
            if description is not None:
                endpoint.description = description
            if is_active is not None:
                endpoint.is_active = is_active
            if timeout is not None:
                endpoint.timeout = timeout

            endpoint.is_default = is_default
            endpoint.save()

            return Response({
                'message': '端点更新成功',
                'endpoint': {
                    'id': endpoint.id,
                    'name': endpoint.name,
                    'url': endpoint.url,
                    'description': endpoint.description,
                    'is_active': endpoint.is_active,
                    'is_default': endpoint.is_default,
                    'timeout': endpoint.timeout
                }
            })

        except Exception as e:
            logger.error(f"更新端点失败: {str(e)}")
            return Response(
                {'error': '更新端点失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="删除端点",
        description="删除指定的端点配置",
        parameters=[
            OpenApiParameter(
                name='endpoint_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='端点ID'
            )
        ]
    )
    def delete(self, request, endpoint_id):
        """删除端点"""
        try:
            endpoint = get_object_or_404(OllamaEndpoint, id=endpoint_id)

            # 只允许创建者或超级用户删除
            if endpoint.created_by != request.user and not request.user.is_superuser:
                return Response(
                    {'error': '只有创建者可以删除端点'},
                    status=status.HTTP_403_FORBIDDEN
                )

            endpoint.delete()
            return Response({'message': '端点删除成功'})

        except Exception as e:
            logger.error(f"删除端点失败: {str(e)}")
            return Response(
                {'error': '删除端点失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TestOllamaEndpoint(APIView):
    """测试Ollama端点连接视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="测试Ollama端点连接",
        description="测试指定端点的连接状态和可用模型",
        parameters=[
            OpenApiParameter(
                name='endpoint_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.PATH,
                description='端点ID（可选，不提供则测试默认端点）'
            )
        ]
    )
    def get(self, request, endpoint_id=None):
        """测试端点连接"""
        try:
            if endpoint_id:
                endpoint = get_object_or_404(OllamaEndpoint, id=endpoint_id)
                result = endpoint.test_connection()
            else:
                # 测试默认端点
                default_endpoint = OllamaEndpoint.get_default_endpoint()
                if default_endpoint:
                    result = default_endpoint.test_connection()
                else:
                    # 测试硬编码的默认URL
                    from .services import OllamaClient
                    client = OllamaClient()
                    models = client.list_models()
                    result = {
                        'success': True,
                        'models_count': len(models),
                        'models': [model.get('name', '') for model in models[:5]]
                    }

            if result['success']:
                return Response({
                    'status': 'success',
                    'message': '连接成功',
                    'models_count': result['models_count'],
                    'models': result['models']
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'status': 'error',
                    'message': f'连接失败: {result["error"]}'
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"测试端点连接失败: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'测试连接失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncOllamaModels(APIView):
    """同步Ollama模型视图"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="同步Ollama模型",
        description="从指定的Ollama服务端点同步模型到数据库",
        parameters=[
            OpenApiParameter(
                name='endpoint_id',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='端点ID（可选，不提供则使用默认端点）'
            )
        ]
    )
    def post(self, request):
        """同步模型"""
        try:
            endpoint_id = request.query_params.get('endpoint_id')

            if endpoint_id:
                endpoint = get_object_or_404(OllamaEndpoint, id=endpoint_id)
                from .services import OllamaClient
                client = OllamaClient(endpoint_id=endpoint.id)
            else:
                # 使用默认端点
                from .services import OllamaClient
                client = OllamaClient()

            # 获取模型列表
            models_data = client.list_models()
            synced_count = 0
            updated_count = 0

            for model_data in models_data:
                model_name = model_data.get('name', '')
                details = model_data.get('details', {})
                families = details.get('families', [])

                # 检查是否为视觉模型
                is_vision_capable = any(
                    family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                    for family in families
                )

                if is_vision_capable:
                    # 获取模型大小
                    size_bytes = model_data.get('size', 0)
                    size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                    # 创建或更新模型记录
                    model, created = OllamaModel.objects.update_or_create(
                        name=model_name,
                        defaults={
                            'display_name': model_name.replace('/', ' - ').title(),
                            'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                            'is_active': True,
                            'is_vision_capable': True,
                            'model_size': f"{size_gb}GB" if size_gb else None,
                            'api_endpoint': client.base_url
                        }
                    )

                    if created:
                        synced_count += 1
                    else:
                        updated_count += 1

            # 禁用不再存在的视觉模型
            existing_model_names = {m.get('name') for m in models_data}
            vision_families = ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
            current_vision_models = {
                m.get('name') for m in models_data
                if any(fam in existing_model_names for fam in vision_families)
            }

            disabled_count = OllamaModel.objects.filter(
                is_vision_capable=True
            ).exclude(
                name__in=current_vision_models
            ).update(is_active=False)

            return Response({
                'message': '模型同步完成',
                'synced': synced_count,
                'updated': updated_count,
                'disabled': disabled_count,
                'total_vision_models': synced_count + updated_count
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"同步模型失败: {str(e)}")
            return Response(
                {'error': f'同步模型失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateTitleView(APIView):
    """生成图片标题视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="生成图片标题",
        description="使用Ollama AI模型为图片生成简洁的标题",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行标题生成
            service = get_ai_analysis_service()
            title = service.generate_title(
                media_file=media_file,
                model_name=model_name
            )

            return Response({
                'title': title,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"标题生成失败: {str(e)}")
            return Response(
                {'error': f'标题生成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"标题生成失败: {str(e)}")
            return Response(
                {'error': '标题生成失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateDescriptionView(APIView):
    """生成图片描述视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="生成图片描述",
        description="使用Ollama AI模型为图片生成详细的描述",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行描述生成
            service = get_ai_analysis_service()
            description = service.generate_description(
                media_file=media_file,
                model_name=model_name
            )

            return Response({
                'description': description,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"描述生成失败: {str(e)}")
            return Response(
                {'error': f'描述生成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"描述生成失败: {str(e)}")
            return Response(
                {'error': '描述生成失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeneratePromptView(APIView):
    """生成图片提示词视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="生成图片提示词",
        description="使用Ollama AI模型为图片生成适合AI绘画的提示词",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行提示词生成
            service = get_ai_analysis_service()
            prompt = service.generate_prompt(
                media_file=media_file,
                model_name=model_name
            )

            return Response({
                'prompt': prompt,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"提示词生成失败: {str(e)}")
            return Response(
                {'error': f'提示词生成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"提示词生成失败: {str(e)}")
            return Response(
                {'error': '提示词生成失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateCategoriesView(APIView):
    """生成分类建议视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="生成分类建议",
        description="使用Ollama AI模型为图片推荐分类",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'},
                    'max_categories': {'type': 'integer', 'description': '最大分类数量（可选，默认5）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')
        max_categories = request.data.get('max_categories', 5)

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行分类生成
            service = get_ai_analysis_service()
            categories = service.generate_categories(
                media_file=media_file,
                user=request.user,
                model_name=model_name,
                max_categories=max_categories
            )

            # 创建或更新AI分析记录
            ai_analysis, created = AIAnalysis.objects.get_or_create(
                media=media_file,
                defaults={
                    'status': 'completed',
                    'model_used': model_name or service.analyzer.model_name,
                    'analysis_result': {'categories': categories}
                }
            )

            # 保存分类建议
            for category_data in categories:
                try:
                    # 获取或创建分类
                    category, _ = Category.objects.get_or_create(
                        name=category_data['name'],
                        user=request.user,
                        defaults={'description': f'AI建议的分类: {category_data["name"]}'}
                    )

                    # 创建建议关联
                    SuggestedCategory.objects.get_or_create(
                        ai_analysis=ai_analysis,
                        category=category,
                        defaults={'confidence': category_data['confidence']}
                    )
                except Exception as e:
                    logger.error(f"处理分类建议失败: {str(e)}")

            # 如果不是新创建的记录，保存时间戳
            if not created:
                ai_analysis.save()

            return Response({
                'categories': categories,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name,
                'total': len(categories)
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"分类生成失败: {str(e)}")
            return Response(
                {'error': f'分类生成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"分类生成失败: {str(e)}")
            return Response(
                {'error': '分类生成失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerateTagsView(APIView):
    """生成标签建议视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="生成标签建议",
        description="使用Ollama AI模型为图片推荐标签",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'},
                    'max_tags': {'type': 'integer', 'description': '最大标签数量（可选，默认10）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')
        max_tags = request.data.get('max_tags', 10)

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 执行标签生成
            service = get_ai_analysis_service()
            tags = service.generate_tags(
                media_file=media_file,
                user=request.user,
                model_name=model_name,
                max_tags=max_tags
            )

            # 创建或更新AI分析记录
            ai_analysis, created = AIAnalysis.objects.get_or_create(
                media=media_file,
                defaults={
                    'status': 'completed',
                    'model_used': model_name or service.analyzer.model_name,
                    'analysis_result': {'tags': tags}
                }
            )

            # 保存标签建议
            for tag_data in tags:
                try:
                    # 获取或创建标签
                    tag, _ = Tag.objects.get_or_create(
                        name=tag_data['name'],
                        user=request.user
                    )

                    # 创建建议关联
                    SuggestedTag.objects.get_or_create(
                        ai_analysis=ai_analysis,
                        tag=tag,
                        defaults={'confidence': tag_data['confidence']}
                    )
                except Exception as e:
                    logger.error(f"处理标签建议失败: {str(e)}")

            # 如果不是新创建的记录，保存时间戳
            if not created:
                ai_analysis.save()

            return Response({
                'tags': tags,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name,
                'total': len(tags)
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"标签生成失败: {str(e)}")
            return Response(
                {'error': f'标签生成失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"标签生成失败: {str(e)}")
            return Response(
                {'error': '标签生成失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CombinedAnalysisView(APIView):
    """组合分析视图"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        summary="组合分析",
        description="根据选择的参数对图片进行组合分析，可以同时生成标题、描述、提示词、分类和标签",
        request={
            'multipart/form-data': {
                'type': 'object',
                'properties': {
                    'media_id': {'type': 'integer', 'description': '媒体文件ID'},
                    'model_name': {'type': 'string', 'description': '使用的模型名称（可选）'},
                    'generate_title': {'type': 'boolean', 'description': '是否生成标题'},
                    'generate_description': {'type': 'boolean', 'description': '是否生成描述'},
                    'generate_prompt': {'type': 'boolean', 'description': '是否生成提示词'},
                    'generate_categories': {'type': 'boolean', 'description': '是否生成分类建议'},
                    'generate_tags': {'type': 'boolean', 'description': '是否生成标签建议'},
                    'max_categories': {'type': 'integer', 'description': '最大分类数量（可选）'},
                    'max_tags': {'type': 'integer', 'description': '最大标签数量（可选）'}
                },
                'required': ['media_id']
            }
        }
    )
    def post(self, request):
        media_id = request.data.get('media_id')
        model_name = request.data.get('model_name')
        generate_title = request.data.get('generate_title', False)
        generate_description = request.data.get('generate_description', False)
        generate_prompt = request.data.get('generate_prompt', False)
        generate_categories = request.data.get('generate_categories', False)
        generate_tags = request.data.get('generate_tags', False)
        max_categories = request.data.get('max_categories', 5)
        max_tags = request.data.get('max_tags', 10)

        if not media_id:
            return Response(
                {'error': '请提供媒体文件ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取媒体文件
            media_file = get_object_or_404(Media, id=media_id, user=request.user)

            # 检查文件类型
            if media_file.file_type != 'image':
                return Response(
                    {'error': '只支持分析图片文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            service = get_ai_analysis_service()
            results = {}

            # 根据选择执行相应的分析
            if generate_title:
                results['title'] = service.generate_title(
                    media_file=media_file,
                    model_name=model_name
                )

            if generate_description:
                results['description'] = service.generate_description(
                    media_file=media_file,
                    model_name=model_name
                )

            if generate_prompt:
                results['prompt'] = service.generate_prompt(
                    media_file=media_file,
                    model_name=model_name
                )

            if generate_categories:
                results['categories'] = service.generate_categories(
                    media_file=media_file,
                    user=request.user,
                    model_name=model_name,
                    max_categories=max_categories
                )

            if generate_tags:
                results['tags'] = service.generate_tags(
                    media_file=media_file,
                    user=request.user,
                    model_name=model_name,
                    max_tags=max_tags
                )

            # 保存组合分析结果到AIAnalysis记录
            if results:
                ai_analysis, created = AIAnalysis.objects.get_or_create(
                    media=media_file,
                    defaults={
                        'status': 'completed',
                        'model_used': model_name or service.analyzer.model_name,
                        'analysis_result': results
                    }
                )

                # 更新AI生成的字段
                if generate_title and 'title' in results:
                    ai_analysis.ai_title = results['title']
                if generate_description and 'description' in results:
                    ai_analysis.ai_description = results['description']
                if generate_prompt and 'prompt' in results:
                    ai_analysis.ai_prompt = results['prompt']

                # 处理分类和标签建议
                if generate_categories and 'categories' in results:
                    for category_data in results['categories']:
                        try:
                            category, _ = Category.objects.get_or_create(
                                name=category_data['name'],
                                user=request.user,
                                defaults={'description': f'AI建议的分类: {category_data["name"]}'}
                            )
                            SuggestedCategory.objects.get_or_create(
                                ai_analysis=ai_analysis,
                                category=category,
                                defaults={'confidence': category_data['confidence']}
                            )
                        except Exception as e:
                            logger.error(f"处理分类建议失败: {str(e)}")

                if generate_tags and 'tags' in results:
                    for tag_data in results['tags']:
                        try:
                            tag, _ = Tag.objects.get_or_create(
                                name=tag_data['name'],
                                user=request.user
                            )
                            SuggestedTag.objects.get_or_create(
                                ai_analysis=ai_analysis,
                                tag=tag,
                                defaults={'confidence': tag_data['confidence']}
                            )
                        except Exception as e:
                            logger.error(f"处理标签建议失败: {str(e)}")

                # 保存时间戳
                ai_analysis.mark_completed(model_name or service.analyzer.model_name)

            return Response({
                **results,
                'media_id': media_id,
                'model_used': model_name or service.analyzer.model_name
            }, status=status.HTTP_200_OK)

        except OllamaAPIError as e:
            logger.error(f"组合分析失败: {str(e)}")
            return Response(
                {'error': f'组合分析失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"组合分析失败: {str(e)}")
            return Response(
                {'error': '组合分析失败，请稍后重试'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
