"""
Model synchronization view handlers
"""

import requests
from ..models import OllamaAIModel, OllamaEndpoint
from ..clients.client_factory import ClientFactory
from .base import BaseResponseHandler, BaseViewSetMixin


class ModelSyncHandler(BaseViewSetMixin):
    """Handler for model synchronization operations"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def pull_models(self, pk=None):
        """Pull models from a specific endpoint"""
        endpoint = self.viewset.get_object()
        self.validate_user_access(endpoint)

        try:
            sync_result = self._sync_models_from_endpoint(endpoint)
            return BaseResponseHandler.success_response(
                message=f'成功拉取 {sync_result["total_success"]} 个模型',
                data=sync_result
            )
        except requests.exceptions.Timeout:
            return BaseResponseHandler.error_response(
                message='连接端点超时'
            )
        except requests.exceptions.ConnectionError:
            return BaseResponseHandler.error_response(
                message='无法连接到端点'
            )
        except Exception as e:
            return BaseResponseHandler.error_response(
                message=f'拉取模型时发生错误: {str(e)}',
                code=500,
                http_status=500
            )

    def refresh_all_models(self):
        """Refresh models from all active endpoints"""
        endpoints = OllamaEndpoint.objects.filter(
            created_by=self.request.user,
            is_active=True
        )

        if not endpoints:
            return BaseResponseHandler.not_found_response(
                message='未找到活跃的端点'
            )

        total_pulled = []
        total_errors = []

        for endpoint in endpoints:
            try:
                sync_result = self._sync_models_from_endpoint(endpoint)
                total_pulled.extend(sync_result.get('pulled_models', []))
                total_errors.extend(sync_result.get('errors', []))
            except requests.exceptions.Timeout:
                total_errors.append({
                    'endpoint': endpoint.name,
                    'error': '连接超时'
                })
            except requests.exceptions.ConnectionError:
                total_errors.append({
                    'endpoint': endpoint.name,
                    'error': '无法连接'
                })
            except Exception as e:
                total_errors.append({
                    'endpoint': endpoint.name,
                    'error': str(e)
                })

        return BaseResponseHandler.success_response(
            message=f'刷新完成，成功处理 {len(total_pulled)} 个模型',
            data={
                'pulled_models': total_pulled,
                'errors': total_errors,
                'total_success': len(total_pulled),
                'total_errors': len(total_errors)
            }
        )

    def _sync_models_from_endpoint(self, endpoint):
        """Sync models from a single endpoint"""
        # 使用 ClientFactory 获取模型列表（统一使用 LangChain）
        models_data = ClientFactory.get_available_models(endpoint)

        pulled_models = []
        errors = []

        for model_info in models_data:
            try:
                model_result = self._process_model_info(model_info, endpoint)
                pulled_models.append(model_result)
            except Exception as e:
                errors.append({
                    'model': model_info.get('name', 'unknown'),
                    'error': str(e)
                })

        return {
            'pulled_models': pulled_models,
            'errors': errors,
            'total_found': len(models_data),
            'total_success': len(pulled_models),
            'total_errors': len(errors)
        }

    def _process_model_info(self, model_info, endpoint):
        """Process individual model information"""
        # 根据供应商类型处理模型信息
        if endpoint.provider == 'zhipu':
            # 智谱AI的模型信息格式
            model_name = model_info.get('name', '')
            display_name = model_info.get('display_name', model_name)
            is_vision_capable = model_info.get('supports_vision', False)
            description = model_info.get('description', '')
            size_info = model_info.get('size', '未知')

            # 构造ollama_info格式
            ollama_info = {
                'name': model_name,
                'display_name': display_name,
                'description': description,
                'supports_vision': is_vision_capable,
                'provider': 'zhipu',
                'raw_info': model_info
            }
        else:
            # Ollama等其他供应商的模型信息格式
            model_name = model_info.get('name', '')
            is_vision_capable = self._check_vision_capability(model_name)
            size_info = model_info.get('details', {}).get('parameter_size', '未知')
            ollama_info = model_info

        # Create or update model
        model, created = OllamaAIModel.objects.update_or_create(
            name=model_name,
            endpoint=endpoint,
            defaults={
                'is_active': True,
                'is_vision_capable': is_vision_capable,
                'model_size': size_info,
                'digest': model_info.get('digest', ''),
                'modified_at': model_info.get('modified_at'),
                'ollama_info': ollama_info
            }
        )

        return {
            'name': model_name,
            'size': size_info,
            'vision_capable': is_vision_capable,
            'status': 'created' if created else 'updated',
            'provider': endpoint.provider
        }

    def _check_vision_capability(self, model_name):
        """Check if model supports vision based on name patterns"""
        vision_keywords = [
            'llava', 'vision', 'clip', 'multimodal', 'vl', 'minicpm',
            'glm-4.6v', 'glm-4.1v', 'gpt-4-vision', 'claude-3-vision'
        ]
        return any(keyword in model_name.lower() for keyword in vision_keywords)