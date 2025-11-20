import logging
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser

from .models import AIAnalysis, AIModel, OllamaEndpoint
from .services import OllamaClient, OllamaAPIError
from .serializers import (
    AIAnalysisSerializer, AIAnalysisListSerializer,
    AIModelSerializer, OllamaEndpointSerializer, OllamaEndpointCreateSerializer,
    SingleAnalysisRequestSerializer
)
from media.models import Media, Category, Tag
from utils.responses import (
    success_response,
    error_response,
    not_found_response,
    paginated_response
)

logger = logging.getLogger(__name__)


class OllamaEndpointViewSet(viewsets.ModelViewSet):
    """Ollama端点管理 ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = OllamaEndpoint.objects.all()

    def get_serializer_class(self):
        """根据 action 选择序列化器"""
        if self.action == 'create':
            return OllamaEndpointCreateSerializer
        return OllamaEndpointSerializer

    def get_queryset(self):
        """获取端点列表"""
        return OllamaEndpoint.objects.all()

    def list(self, request):
        """获取端点列表"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data={
                'endpoints': serializer.data,
                'total': len(queryset)
            },
            message='获取端点列表成功'
        )

    def create(self, request):
        """创建新端点"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            endpoint = serializer.save(created_by=request.user)
            response_serializer = OllamaEndpointSerializer(endpoint)
            return success_response(
                data=response_serializer.data,
                message='端点创建成功',
                status_code=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.error(f"创建端点失败: {str(e)}")
            return error_response(
                message='创建端点失败',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        """获取端点详情"""
        try:
            endpoint = self.get_queryset().get(pk=pk)
        except OllamaEndpoint.DoesNotExist:
            return not_found_response('端点')

        serializer = self.get_serializer(endpoint)
        return success_response(
            data=serializer.data,
            message='获取端点详情成功'
        )

    def update(self, request, pk=None):
        """更新端点"""
        try:
            endpoint = self.get_queryset().get(pk=pk)
        except OllamaEndpoint.DoesNotExist:
            return not_found_response('端点')

        # 只允许创建者或超级用户修改
        if endpoint.created_by != request.user and not request.user.is_superuser:
            return error_response(
                message='只有创建者可以修改端点配置',
                status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = OllamaEndpointSerializer(endpoint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        try:
            serializer.save()
            return success_response(
                data=serializer.data,
                message='端点更新成功'
            )
        except Exception as e:
            logger.error(f"更新端点失败: {str(e)}")
            return error_response(
                message='更新端点失败',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def partial_update(self, request, pk=None):
        """部分更新端点"""
        return self.update(request, pk)  # 复用update方法的逻辑

    def destroy(self, request, pk=None):
        """删除端点"""
        try:
            endpoint = self.get_queryset().get(pk=pk)
        except OllamaEndpoint.DoesNotExist:
            return not_found_response('端点')

        # 只允许创建者或超级用户删除
        if endpoint.created_by != request.user and not request.user.is_superuser:
            return error_response(
                message='只有创建者可以删除端点',
                status_code=status.HTTP_403_FORBIDDEN
            )

        try:
            endpoint.delete()
            return success_response(
                message='端点删除成功'
            )
        except Exception as e:
            logger.error(f"删除端点失败: {str(e)}")
            return error_response(
                message='删除端点失败',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def test(self, request, pk=None):
        """测试端点连接"""
        try:
            endpoint = self.get_queryset().get(pk=pk)
            result = endpoint.test_connection()

            if result['success']:
                return success_response(
                    data={
                        'status': 'success',
                        'message': '连接成功',
                        'models_count': result['models_count'],
                        'models': result['models']
                    },
                    message='端点连接测试成功'
                )
            else:
                return error_response(
                    message=f'连接失败: {result["error"]}',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        except OllamaEndpoint.DoesNotExist:
            return not_found_response('端点')
        except Exception as e:
            logger.error(f"测试端点连接失败: {str(e)}")
            return error_response(
                message=f'测试连接失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AIModelViewSet(viewsets.ReadOnlyModelViewSet):
    """AI模型管理 ViewSet"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = AIModel.objects.all()
    serializer_class = AIModelSerializer

    def get_queryset(self):
        """获取活跃的视觉模型"""
        return AIModel.get_active_vision_models()

    def list(self, request):
        """获取可用的模型列表"""
        # 从用户配置的活跃端点动态获取模型
        from .services import OllamaClient

        models_data = []

        # 支持按端点筛选
        endpoint_id = request.query_params.get('endpoint_id')
        if endpoint_id:
            # 只获取指定端点的模型
            try:
                endpoints = OllamaEndpoint.objects.filter(id=endpoint_id, is_active=True)
                if not endpoints.exists():
                    return error_response(
                        message=f'端点 ID {endpoint_id} 不存在或未激活',
                        status_code=status.HTTP_404_NOT_FOUND
                    )
            except ValueError:
                return error_response(
                    message='无效的端点ID格式',
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        else:
            # 获取所有活跃端点
            endpoints = OllamaEndpoint.objects.filter(is_active=True)

        for endpoint in endpoints:
            try:
                # 为每个端点创建客户端
                client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)

                # 获取该端点的模型列表
                endpoint_models = client.list_models()

                for model_data in endpoint_models:
                    model_name = model_data.get('name', '')
                    details = model_data.get('details', {})
                    families = details.get('families', [])

                    # 检查是否为视觉模型
                    is_vision_capable = any(
                        family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                        for family in families
                    ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                          'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                    if is_vision_capable:
                        size_bytes = model_data.get('size', 0)
                        size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                        models_data.append({
                            'name': model_name,
                            'display_name': model_name.replace('/', ' - ').title(),
                            'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                            'endpoint': endpoint.id,
                            'endpoint_name': endpoint.name,
                            'endpoint_url': endpoint.url,
                            'is_active': True,
                            'is_vision_capable': True,
                            'is_default': False,  # 这里可以通过检查数据库获取真实的默认状态
                            'model_size': f"{size_gb}GB" if size_gb else None,
                            'parameter_size': details.get('parameter_size', 'Unknown'),
                            'families': families,
                            'digest': model_data.get('digest', ''),
                            'modified_at': model_data.get('modified_at', '')
                        })

            except Exception as e:
                logger.error(f"获取端点 {endpoint.name} 的模型失败: {str(e)}")
                continue

        # 获取默认模型名称
        default_model = AIModel.get_default_model()
        default_model_name = default_model.name if default_model else None

        # 如果有默认模型，将其标记为默认
        if default_model_name:
            for model in models_data:
                if model['name'] == default_model_name and model['endpoint'] == default_model.endpoint.id:
                    model['is_default'] = True

        # 按模型大小排序（降序：4B排在2B前面），然后按名称排序
        def model_size_sort_key(model):
            # 提取模型大小中的数字（如从 "4.7GB" 中提取 4.7）
            import re
            size_str = model.get('model_size', '')
            if size_str:
                # 查找数字（可能包含小数点）
                size_match = re.search(r'(\d+\.?\d*)', size_str)
                if size_match:
                    size_num = float(size_match.group(1))
                    # 返回负数以实现降序排序
                    return -size_num

            # 如果没有大小信息，从模型名称中提取
            name = model.get('name', '').lower()
            if '4b' in name:
                return -4.0
            elif '2b' in name:
                return -2.0
            elif '8b' in name:
                return -8.0
            elif '1b' in name:
                return -1.0

            # 默认情况，按名称排序
            return -1000  # 放在最后

        # 对模型进行排序
        models_data.sort(key=model_size_sort_key)

        return success_response(
            data={
                'models': models_data,
                'total': len(models_data),
                'default_model': default_model_name,
                'endpoints_count': endpoints.count()
            },
            message='获取可用模型成功'
        )

    def list_default(self, request):
        """获取默认端点的模型列表"""
        from .services import OllamaClient

        models_data = []

        # 获取默认端点
        try:
            default_endpoint = OllamaEndpoint.objects.get(is_default=True, is_active=True)
        except OllamaEndpoint.DoesNotExist:
            return error_response(
                message='没有找到默认的活跃端点',
                status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            # 为默认端点创建客户端
            client = OllamaClient(base_url=default_endpoint.url, timeout=default_endpoint.timeout)

            # 获取默认端点的模型列表
            endpoint_models = client.list_models()

            for model_data in endpoint_models:
                model_name = model_data.get('name', '')
                details = model_data.get('details', {})
                families = details.get('families', [])

                # 检查是否为视觉模型
                is_vision_capable = any(
                    family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                    for family in families
                ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                      'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                if is_vision_capable:
                    size_bytes = model_data.get('size', 0)
                    size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                    models_data.append({
                        'id': len(models_data) + 1,  # 生成临时ID
                        'name': model_name,
                        'display_name': model_name.replace('/', ' - ').title(),
                        'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                        'endpoint_id': default_endpoint.id,
                        'endpoint_name': default_endpoint.name,
                        'endpoint_url': default_endpoint.url,
                        'is_active': True,
                        'is_vision_capable': True,
                        'is_default': False,  # 这里可以通过检查数据库获取真实的默认状态
                        'model_size': f"{size_gb}GB" if size_gb else None,
                        'parameter_size': details.get('parameter_size', 'Unknown'),
                        'families': families,
                        'digest': model_data.get('digest', ''),
                        'modified_at': model_data.get('modified_at', '')
                    })

        except Exception as e:
            logger.error(f"获取默认端点 {default_endpoint.name} 的模型失败: {str(e)}")
            return error_response(
                message=f'获取默认端点模型失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # 获取默认模型名称
        default_model = AIModel.get_default_model()
        default_model_name = default_model.name if default_model else None

        # 如果有默认模型，将其标记为默认
        if default_model_name:
            for model in models_data:
                if model['name'] == default_model_name and model['endpoint_id'] == default_model.endpoint.id:
                    model['is_default'] = True

        # 按模型大小排序
        def model_size_sort_key(model):
            # 提取模型大小中的数字
            import re
            size_str = model.get('model_size', '')
            if size_str:
                size_match = re.search(r'(\d+\.?\d*)', size_str)
                if size_match:
                    size_num = float(size_match.group(1))
                    return -size_num

            # 如果没有大小信息，从模型名称中提取
            name = model.get('name', '').lower()
            if '4b' in name:
                return -4.0
            elif '2b' in name:
                return -2.0
            elif '8b' in name:
                return -8.0
            elif '1b' in name:
                return -1.0

            return -1000  # 放在最后

        # 对模型进行排序
        models_data.sort(key=model_size_sort_key)

        return success_response(
            data={
                'models': models_data,
                'total': len(models_data),
                'default_model': default_model_name,
                'default_endpoint': {
                    'id': default_endpoint.id,
                    'name': default_endpoint.name,
                    'url': default_endpoint.url
                }
            },
            message='获取默认端点模型成功'
        )

    def retrieve(self, request, pk=None):
        """获取模型详情"""
        # 尝试先从数据库中查找
        try:
            db_model = self.get_queryset().get(pk=pk)
            serializer = self.get_serializer(db_model)
            return success_response(
                data=serializer.data,
                message='获取模型详情成功'
            )
        except AIModel.DoesNotExist:
            # 如果数据库中没有，从动态获取的模型列表中查找
            try:
                pk = int(pk)
                # 获取动态模型列表
                from .services import OllamaClient

                models_data = []
                endpoints = OllamaEndpoint.objects.filter(is_active=True)

                for endpoint in endpoints:
                    try:
                        client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)
                        endpoint_models = client.list_models()

                        for model_data in endpoint_models:
                            model_name = model_data.get('name', '')
                            details = model_data.get('details', {})
                            families = details.get('families', [])

                            # 检查是否为视觉模型
                            is_vision_capable = any(
                                family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                                for family in families
                            ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                                  'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                            if is_vision_capable:
                                size_bytes = model_data.get('size', 0)
                                size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                                models_data.append({
                                    'id': len(models_data) + 1,  # 生成临时ID
                                    'name': model_name,
                                    'display_name': model_name.replace('/', ' - ').title(),
                                    'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                                    'endpoint': endpoint.id,
                                    'endpoint_name': endpoint.name,
                                    'endpoint_url': endpoint.url,
                                    'is_active': True,
                                    'is_vision_capable': True,
                                    'is_default': False,
                                    'model_size': f"{size_gb}GB" if size_gb else None,
                                    'parameter_size': details.get('parameter_size', 'Unknown'),
                                    'families': families,
                                    'digest': model_data.get('digest', ''),
                                    'modified_at': model_data.get('modified_at', '')
                                })
                    except Exception as e:
                        logger.error(f"获取端点 {endpoint.name} 的模型失败: {str(e)}")
                        continue

                # 查找指定ID的模型（这里使用列表索引+1作为ID）
                if 1 <= pk <= len(models_data):
                    model = models_data[pk - 1]

                    # 获取默认模型信息
                    default_model = AIModel.get_default_model()
                    default_model_name = default_model.name if default_model else None

                    if default_model_name:
                        model['is_default'] = (model['name'] == default_model_name and
                                               model['endpoint'] == default_model.endpoint.id)

                    return success_response(
                        data=model,
                        message='获取模型详情成功'
                    )
                else:
                    return not_found_response('AI模型')

            except Exception as e:
                logger.error(f"动态获取模型详情失败: {str(e)}")
                return not_found_response('AI模型')

    @action(detail=False, methods=['post'])
    def refresh(self, request):
        """刷新模型列表"""
        try:
            endpoint_id = request.data.get('endpoint_id')

            if endpoint_id:
                # 刷新特定端点的模型
                try:
                    endpoint = OllamaEndpoint.objects.get(id=endpoint_id)
                    client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)
                except OllamaEndpoint.DoesNotExist:
                    return error_response(
                        message=f'端点 ID {endpoint_id} 不存在',
                        status_code=status.HTTP_404_NOT_FOUND
                    )
            else:
                # 刷新所有端点的模型
                endpoints = OllamaEndpoint.objects.filter(is_active=True)

                # 如果没有端点，创建一个默认端点
                if not endpoints.exists():
                    try:
                        endpoint, created = OllamaEndpoint.objects.get_or_create(
                            name='默认Ollama端点',
                            defaults={
                                'url': 'http://115.190.140.100:31434',
                                'description': '默认的Ollama服务端点',
                                'is_active': True,
                                'is_default': True,
                                'timeout': 300,
                                'created_by': request.user
                            }
                        )
                        endpoints = OllamaEndpoint.objects.filter(is_active=True)
                        logger.info(f"创建了默认端点: {endpoint.name}")
                    except Exception as e:
                        logger.error(f"创建默认端点失败: {str(e)}")
                        return error_response(
                            message=f'没有找到可用的端点，且创建默认端点失败: {str(e)}',
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )

                synced_count = 0

                for endpoint in endpoints:
                    try:
                        client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)
                        models_data = client.list_models()

                        for model_data in models_data:
                            model_name = model_data.get('name', '')
                            details = model_data.get('details', {})
                            families = details.get('families', [])

                            # 检查是否为视觉模型
                            is_vision_capable = any(
                                family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                                for family in families
                            ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                                  'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                            if is_vision_capable:
                                size_bytes = model_data.get('size', 0)
                                size_gb = round(size_bytes / (1024**3), 2) if size_bytes > 0 else None

                                AIModel.objects.update_or_create(
                                    name=model_name,
                                    endpoint=endpoint,
                                    defaults={
                                        'display_name': model_name.replace('/', ' - ').title(),
                                        'description': f"视觉模型 - 参数规模: {details.get('parameter_size', 'Unknown')}",
                                        'is_active': True,
                                        'is_vision_capable': True,
                                        'model_size': f"{size_gb}GB" if size_gb else None
                                    }
                                )
                                synced_count += 1

                    except Exception as e:
                        logger.error(f"刷新端点 {endpoint.name} 失败: {str(e)}")
                        continue

                return success_response(
                    data={
                        'message': '模型刷新完成',
                        'synced': synced_count
                    },
                    message='模型刷新完成'
                )

            return success_response(
                message='模型刷新成功'
            )

        except Exception as e:
            logger.error(f"刷新模型失败: {str(e)}")
            return error_response(
                message=f'刷新模型失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def test(self, request, pk=None):
        """测试指定模型连接"""
        # 尝试先从数据库中查找
        try:
            db_model = self.get_queryset().get(pk=pk)
            model_name = db_model.name
            endpoint = db_model.endpoint
        except AIModel.DoesNotExist:
            # 如果数据库中没有，从动态获取的模型列表中查找
            try:
                pk = int(pk)
                from .services import OllamaClient

                models_data = []
                endpoints = OllamaEndpoint.objects.filter(is_active=True)

                for endpoint in endpoints:
                    try:
                        client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)
                        endpoint_models = client.list_models()

                        for model_data in endpoint_models:
                            model_name = model_data.get('name', '')
                            details = model_data.get('details', {})
                            families = details.get('families', [])

                            # 检查是否为视觉模型
                            is_vision_capable = any(
                                family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                                for family in families
                            ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                                  'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                            if is_vision_capable:
                                models_data.append({
                                    'name': model_name,
                                    'endpoint': endpoint
                                })
                    except Exception:
                        continue

                # 查找指定ID的模型
                if 1 <= pk <= len(models_data):
                    model_info = models_data[pk - 1]
                    model_name = model_info['name']
                    endpoint = model_info['endpoint']
                else:
                    return not_found_response('AI模型')
            except Exception as e:
                logger.error(f"动态获取模型失败: {str(e)}")
                return not_found_response('AI模型')

        try:
            # 使用模型的端点测试连接
            client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)

            # 尝试生成一个简单的测试请求
            try:
                models = client.list_models()
                model_exists = any(m.get('name') == model_name for m in models)

                if model_exists:
                    return success_response(
                        data={
                            'status': 'success',
                            'message': '模型可用',
                            'endpoint': endpoint.url,
                            'endpoint_name': endpoint.name,
                            'model_name': model_name
                        },
                        message='模型连接测试成功'
                    )
                else:
                    return error_response(
                        message=f'模型 {model_name} 在端点上不存在',
                        status_code=status.HTTP_400_BAD_REQUEST
                    )

            except Exception as e:
                return error_response(
                    message=f'模型测试失败: {str(e)}',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"测试模型连接失败: {str(e)}")
            return error_response(
                message=f'测试连接失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def default(self, request, pk=None):
        """设置默认模型"""
        # 尝试先从数据库中查找
        try:
            model = self.get_queryset().get(pk=pk)
            # 如果找到了，直接设置为默认
            model.is_default = True
            model.save()

            serializer = self.get_serializer(model)
            return success_response(
                data=serializer.data,
                message='默认模型设置成功'
            )
        except AIModel.DoesNotExist:
            # 如果数据库中没有，从动态获取的模型列表中查找
            try:
                pk = int(pk)
                from .services import OllamaClient

                models_data = []
                endpoints = OllamaEndpoint.objects.filter(is_active=True)

                for endpoint in endpoints:
                    try:
                        client = OllamaClient(base_url=endpoint.url, timeout=endpoint.timeout)
                        endpoint_models = client.list_models()

                        for model_data in endpoint_models:
                            model_name = model_data.get('name', '')
                            details = model_data.get('details', {})
                            families = details.get('families', [])

                            # 检查是否为视觉模型
                            is_vision_capable = any(
                                family in ['qwen3vl', 'clip', 'llava', 'minicpm', 'vision']
                                for family in families
                            ) or ('vl' in model_name.lower() or 'vision' in model_name.lower() or
                                  'qwen3-vl' in model_name.lower() or 'minicpm-v' in model_name.lower())

                            if is_vision_capable:
                                models_data.append({
                                    'name': model_name,
                                    'endpoint': endpoint
                                })
                    except Exception:
                        continue

                # 查找指定ID的模型
                if 1 <= pk <= len(models_data):
                    model_info = models_data[pk - 1]
                    model_name = model_info['name']
                    endpoint = model_info['endpoint']

                    # 调用 set_default_by_name 的逻辑
                    # 首先取消所有其他模型的默认状态
                    AIModel.objects.filter(is_default=True).update(is_default=False)

                    # 查找或创建模型
                    model, created = AIModel.objects.get_or_create(
                        name=model_name,
                        endpoint=endpoint,
                        defaults={
                            'display_name': model_name.replace('/', ' - ').title(),
                            'description': '用户设置的默认模型',
                            'is_active': True,
                            'is_vision_capable': True,
                            'is_default': True
                        }
                    )

                    if not created:
                        # 如果模型已存在，将其设为默认
                        model.is_default = True
                        model.save()

                    return success_response(
                        data={
                            'model_name': model.name,
                            'endpoint_name': model.endpoint.name,
                            'is_default': model.is_default
                        },
                        message='默认模型设置成功'
                    )
                else:
                    return not_found_response('AI模型')
            except Exception as e:
                logger.error(f"动态设置默认模型失败: {str(e)}")
                return not_found_response('AI模型')
        except Exception as e:
            logger.error(f"设置默认模型失败: {str(e)}")
            return error_response(
                message='设置默认模型失败',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def set_default_by_name(self, request):
        """通过模型名称和端点ID设置默认模型"""
        model_name = request.data.get('model_name')
        endpoint_id = request.data.get('endpoint_id')

        if not model_name or not endpoint_id:
            return error_response(
                message='请提供模型名称和端点ID',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取端点
            endpoint = OllamaEndpoint.objects.get(id=endpoint_id, is_active=True)

            # 查找或创建模型
            model, created = AIModel.objects.get_or_create(
                name=model_name,
                endpoint=endpoint,
                defaults={
                    'display_name': model_name.replace('/', ' - ').title(),
                    'description': '用户设置的默认模型',
                    'is_active': True,
                    'is_vision_capable': True,
                    'is_default': True
                }
            )

            if not created:
                # 如果模型已存在，将其设为默认
                # 首先取消所有其他模型的默认状态
                AIModel.objects.filter(is_default=True).update(is_default=False)

                # 设置当前模型为默认
                model.is_default = True
                model.save()

            return success_response(
                data={
                    'model_name': model.name,
                    'endpoint_name': model.endpoint.name,
                    'is_default': model.is_default
                },
                message='默认模型设置成功'
            )

        except OllamaEndpoint.DoesNotExist:
            return error_response(
                message='指定的端点不存在或未激活',
                status_code=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"设置默认模型失败: {str(e)}")
            return error_response(
                message='设置默认模型失败',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AIAnalysisViewSet(viewsets.GenericViewSet):
    """重构后的AI分析 ViewSet - 使用Django-Q异步处理"""
    permission_classes = [permissions.IsAuthenticated]
    queryset = AIAnalysis.objects.all()

    def get_serializer_class(self):
        """根据 action 选择序列化器"""
        if self.action == 'list':
            return AIAnalysisListSerializer
        return AIAnalysisSerializer

    def get_queryset(self):
        """获取当前用户的AI分析记录"""
        return AIAnalysis.objects.filter(media__user=self.request.user)

    def list(self, request):
        """获取用户的AI分析记录列表"""
        queryset = self.get_queryset().order_by('-created_at')

        # 支持按状态过滤
        status_filter = request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 分页
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return success_response(
            data={
                'analyses': serializer.data,
                'total': queryset.count()
            },
            message='获取分析记录列表成功'
        )

    def retrieve(self, request):
        """获取单个分析记录详情"""
        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return error_response(
                message='缺少analysis_id参数',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            analysis = self.get_queryset().get(pk=analysis_id)
            serializer = self.get_serializer(analysis)
            return success_response(
                data=serializer.data,
                message='获取分析记录详情成功'
            )
        except AIAnalysis.DoesNotExist:
            return not_found_response('分析记录不存在')

    @action(detail=False, methods=['post'], url_path='single')
    def single(self, request):
        """
        单图分析接口 - 异步处理
        创建分析任务并立即返回任务信息
        """
        from .tasks import create_analysis_task

        try:
            media_id = request.data.get('media_id')
            if not media_id:
                return error_response(
                    message='缺少media_id参数',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # 获取分析选项
            options = request.data.get('options', {})

            # 创建分析任务
            model_name = request.data.get('model_name')
            logger.info(f"🔍 [API] 收到分析请求: media_id={media_id}, model_name={model_name}, options={options}")

            analysis = create_analysis_task(
                media_id=int(media_id),
                user_id=request.user.id,
                model_name=model_name,
                options=options
            )

            logger.info(f"🔍 [API] 创建任务后: analysis_id={analysis.id}, model_used={analysis.model_used}")

            # 返回任务信息
            response_data = {
                'analysis_id': analysis.id,
                'task_id': analysis.task_id,
                'status': analysis.status,
                'media_id': analysis.media.id,
                'media_title': analysis.media.title or analysis.media.file.name,
                'created_at': analysis.created_at,
                'message': '分析任务已创建，正在处理中...'
            }

            return success_response(
                data=response_data,
                message='图片分析任务创建成功',
                status_code=status.HTTP_202_ACCEPTED
            )

        except Exception as e:
            logger.error(f"创建分析任务失败: {str(e)}")
            return error_response(
                message=f'创建分析任务失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='status')
    def status(self, request):
        """获取分析任务状态"""
        analysis_id = request.data.get('analysis_id')
        task_id = request.data.get('task_id')

        # 如果提供了 task_id，直接查询任务状态
        if task_id and not analysis_id:
            try:
                from .tasks import get_task_status
                task_info = get_task_status(task_id)

                return success_response(
                    data=task_info,
                    message='获取任务状态成功'
                )

            except Exception as e:
                logger.error(f"获取任务状态失败: {str(e)}")
                return error_response(
                    message=f'获取任务状态失败: {str(e)}',
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # 如果提供了 analysis_id，按原有逻辑查询
        if analysis_id:
            try:
                analysis = self.get_queryset().get(pk=analysis_id)

                # 如果有任务ID，从Django-Q获取实时状态
                task_info = {}
                if analysis.task_id:
                    from .tasks import get_task_status
                    task_info = get_task_status(analysis.task_id)

                response_data = {
                    'analysis_id': analysis.id,
                    'status': analysis.status,
                    'progress': analysis.task_progress,
                    'is_task_running': analysis.is_task_running,
                    'task_id': analysis.task_id,
                    'model_used': analysis.model_used,
                    'created_at': analysis.created_at,
                    'analyzed_at': analysis.analyzed_at,
                    'error_message': analysis.error_message,
                    'applied_to_media': analysis.applied_to_media,
                    'task_info': task_info
                }

                return success_response(
                    data=response_data,
                    message='获取任务状态成功'
                )

            except AIAnalysis.DoesNotExist:
                return not_found_response('分析记录不存在')
            except Exception as e:
                logger.error(f"获取任务状态失败: {str(e)}")
                return error_response(
                    message=f'获取任务状态失败: {str(e)}',
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # 如果两个参数都没有提供
        return error_response(
            message='缺少analysis_id或task_id参数',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=False, methods=['post'], url_path='task-status')
    def task_status(self, request):
        """通过task_id直接查询任务状态"""
        task_id = request.data.get('task_id')
        if not task_id:
            return error_response(
                message='缺少task_id参数',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            from .tasks import get_task_status
            task_info = get_task_status(task_id)

            return success_response(
                data=task_info,
                message='获取任务状态成功'
            )

        except Exception as e:
            logger.error(f"获取任务状态失败: {str(e)}")
            return error_response(
                message=f'获取任务状态失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='apply')
    def apply(self, request):
        """手动应用分析结果到媒体文件"""
        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return error_response(
                message='缺少analysis_id参数',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            analysis = self.get_queryset().get(pk=analysis_id)

            if analysis.status != 'completed':
                return error_response(
                    message='只能应用已完成的分析结果',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            if analysis.applied_to_media:
                return error_response(
                    message='分析结果已经应用到媒体文件',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # 应用结果
            success = analysis.apply_to_media()

            if success:
                return success_response(
                    data={
                        'analysis_id': analysis.id,
                        'applied_to_media': True,
                        'media_title': analysis.media.title
                    },
                    message='分析结果已成功应用到媒体文件'
                )
            else:
                return error_response(
                    message='应用分析结果失败',
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except AIAnalysis.DoesNotExist:
            return not_found_response('分析记录不存在')
        except Exception as e:
            logger.error(f"应用分析结果失败: {str(e)}")
            return error_response(
                message=f'应用分析结果失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='retry')
    def retry(self, request):
        """重试失败的分析任务"""
        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return error_response(
                message='缺少analysis_id参数',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            analysis = self.get_queryset().get(pk=analysis_id)

            if analysis.status not in ['failed', 'completed']:
                return error_response(
                    message='只能重试失败或已完成的分析',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            # 重置分析状态
            analysis.status = 'pending'
            analysis.error_message = None
            analysis.task_id = None
            analysis.save()

            # 重新创建任务
            from .tasks import create_analysis_task
            new_analysis = create_analysis_task(
                media_id=analysis.media.id,
                user_id=request.user.id,
                model_name=analysis.model_used
            )

            # 删除旧的分析记录
            analysis.delete()

            return success_response(
                data={
                    'analysis_id': new_analysis.id,
                    'task_id': new_analysis.task_id,
                    'status': new_analysis.status,
                    'message': '重新创建分析任务成功'
                },
                message='重试分析任务成功'
            )

        except AIAnalysis.DoesNotExist:
            return not_found_response('分析记录不存在')
        except Exception as e:
            logger.error(f"重试分析任务失败: {str(e)}")
            return error_response(
                message=f'重试分析任务失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request):
        """删除分析记录"""
        analysis_id = request.data.get('analysis_id')
        if not analysis_id:
            return error_response(
                message='缺少analysis_id参数',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            analysis = self.get_queryset().get(pk=analysis_id)

            # 如果任务正在运行，先取消任务
            if analysis.is_task_running and analysis.task_id:
                try:
                    from django_async_manager.models import AsyncTask
                    task = AsyncTask.objects.get(id=analysis.task_id)
                    task.cancel()
                except:
                    pass  # 忽略取消任务失败的情况

            analysis.delete()
            return success_response(message='分析记录删除成功')

        except AIAnalysis.DoesNotExist:
            return not_found_response('分析记录不存在')
        except Exception as e:
            logger.error(f"删除分析记录失败: {str(e)}")
            return error_response(
                message=f'删除分析记录失败: {str(e)}',
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
