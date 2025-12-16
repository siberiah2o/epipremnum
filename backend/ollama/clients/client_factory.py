"""
AI客户端工厂
根据端点配置创建相应的客户端实例
"""

import logging
from typing import Dict, Any, Optional, List
from ..models import OllamaEndpoint
from .langchain_zhipu_client import LangChainZhipuClient
from .langchain_ollama_client import LangChainOllamaClient

logger = logging.getLogger(__name__)


class ClientFactory:
    """AI客户端工厂类"""

    _clients = {}  # 缓存客户端实例

    @classmethod
    def create_client(cls, endpoint: OllamaEndpoint):
        """
        根据端点配置创建客户端

        Args:
            endpoint: 端点配置对象

        Returns:
            对应的客户端实例
        """
        # 生成缓存键
        cache_key = f"{endpoint.id}_{endpoint.updated_at.timestamp()}"

        # 检查缓存
        if cache_key in cls._clients:
            return cls._clients[cache_key]

        # 创建新的客户端实例
        client = None

        try:
            if endpoint.provider == 'zhipu':
                # 创建智谱客户端（使用 LangChain）
                if not endpoint.api_key:
                    raise ValueError("智谱AI端点需要提供API Key")

                # 使用 LangChain 客户端
                client = LangChainZhipuClient(
                    api_key=endpoint.api_key,
                    model="glm-4.6v-flash"  # 默认使用免费模型
                )

            elif endpoint.provider == 'ollama':
                # 创建 Ollama 客户端（使用 LangChain）
                # 获取默认模型或使用默认值
                from ..models import OllamaAIModel
                default_model = OllamaAIModel.objects.filter(
                    endpoint=endpoint,
                    is_active=True
                ).first()

                model_name = default_model.name if default_model else "llama2"

                # 设置默认 timeout 300 秒（OllamaEndpoint 没有 options 字段）
                timeout = 300

                client = LangChainOllamaClient(
                    base_url=endpoint.url,
                    model=model_name,
                    timeout=timeout
                )

            elif endpoint.provider == 'openai':
                # 创建OpenAI客户端
                # TODO: 实现OpenAI客户端
                pass

            else:
                logger.warning(f"不支持的供应商: {endpoint.provider}")
                return None

            # 缓存客户端
            if client:
                cls._clients[cache_key] = client

            return client

        except Exception as e:
            logger.error(f"创建客户端失败: {str(e)}")
            raise

    @classmethod
    def test_endpoint_connection(cls, endpoint: OllamaEndpoint) -> Dict[str, Any]:
        """
        测试端点连接

        Args:
            endpoint: 端点配置对象

        Returns:
            测试结果
        """
        result = {
            'success': False,
            'message': '',
            'details': {}
        }

        try:
            client = cls.create_client(endpoint)
            if not client:
                result['message'] = f'不支持的供应商: {endpoint.provider}'
                return result

            if endpoint.provider == 'zhipu':
                # 测试智谱AI连接
                if client.test_connection():
                    # 获取可用模型
                    models = client.get_models()
                    result.update({
                        'success': True,
                        'message': '连接成功',
                        'details': {
                            'available_models': models[:5],  # 只返回前5个模型
                            'total_models': len(models)
                        }
                    })
                else:
                    result['message'] = 'API Key无效或网络连接失败'

            elif endpoint.provider == 'ollama':
                # 测试Ollama连接
                if client.test_connection():
                    models = client.get_models()
                    result.update({
                        'success': True,
                        'message': '连接成功',
                        'details': {
                            'available_models': models[:5],
                            'total_models': len(models)
                        }
                    })
                else:
                    result['message'] = '无法连接到Ollama服务'

            else:
                result['message'] = f'{endpoint.provider} 连接测试待实现'

        except Exception as e:
            logger.error(f"端点连接测试失败: {str(e)}")
            result['message'] = f'连接失败: {str(e)}'

        return result

    @classmethod
    def get_available_models(cls, endpoint: OllamaEndpoint) -> List[Dict]:
        """
        获取端点可用模型列表

        Args:
            endpoint: 端点配置对象

        Returns:
            模型列表
        """
        try:
            client = cls.create_client(endpoint)
            if not client:
                return []

            if endpoint.provider == 'zhipu':
                # 获取智谱模型（使用 LangChain）
                return LangChainZhipuClient.get_available_models()

            elif endpoint.provider == 'ollama':
                # 获取 Ollama 模型（使用 LangChain）
                client = LangChainOllamaClient(base_url=endpoint.url)
                return client.get_models()

            else:
                return []

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return []

    @classmethod
    def clear_cache(cls):
        """清除客户端缓存"""
        cls._clients.clear()