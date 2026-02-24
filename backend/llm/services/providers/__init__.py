"""
AI 提供商适配器

使用策略模式支持多种 AI 服务提供商
"""

from .base import BaseProvider, AnalysisResult
from .ollama import OllamaProvider
from .openai import OpenAICompatibleProvider

__all__ = [
    'BaseProvider',
    'AnalysisResult',
    'OllamaProvider',
    'OpenAICompatibleProvider',
    'get_provider',
    'get_provider_for_endpoint',
]

# 提供商映射表
PROVIDER_MAP = {
    'ollama': OllamaProvider,
    'openai': OpenAICompatibleProvider,
    'zhipu': OpenAICompatibleProvider,  # 智谱使用 OpenAI 兼容接口
}


def get_provider(endpoint, model) -> BaseProvider:
    """
    工厂方法：根据端点类型获取提供商实例

    Args:
        endpoint: Endpoint 模型实例
        model: AIModel 模型实例

    Returns:
        BaseProvider: 对应的提供商实例
    """
    provider_class = PROVIDER_MAP.get(endpoint.provider_type, OpenAICompatibleProvider)
    return provider_class(endpoint, model)


def get_provider_for_endpoint(endpoint) -> BaseProvider:
    """
    工厂方法：仅根据端点获取提供商实例（用于获取可用模型列表等操作）

    Args:
        endpoint: Endpoint 模型实例

    Returns:
        BaseProvider: 对应的提供商实例（model 为 None）
    """
    provider_class = PROVIDER_MAP.get(endpoint.provider_type, OpenAICompatibleProvider)
    return provider_class(endpoint, None)
