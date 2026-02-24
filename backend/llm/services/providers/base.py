"""
AI 提供商抽象基类

定义所有 AI 提供商必须实现的接口
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class AnalysisResult:
    """
    图片分析结果

    Attributes:
        description: 图片描述
        categories: 分类标签列表
        scenes: 场景标签列表
        raw_response: 原始 API 响应
        method: 分析方法标识
        tokens_used: 总 Token 使用量
        prompt_tokens: 提示词 Token 数
        completion_tokens: 完成 Token 数
    """
    description: str
    categories: List[str] = field(default_factory=list)
    scenes: List[str] = field(default_factory=list)
    raw_response: str = ""
    method: str = "unknown"
    tokens_used: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'description': self.description,
            'categories': self.categories,
            'scenes': self.scenes,
            'raw_response': self.raw_response,
            'method': self.method,
            'tokens_used': self.tokens_used,
            'prompt_tokens': self.prompt_tokens,
            'completion_tokens': self.completion_tokens,
        }


class BaseProvider(ABC):
    """
    AI 提供商抽象基类

    所有 AI 服务提供商（Ollama、OpenAI、智谱等）都需要继承此类并实现抽象方法

    Attributes:
        endpoint: API 端点配置
        model: AI 模型配置
    """

    def __init__(self, endpoint, model):
        """
        初始化提供商

        Args:
            endpoint: Endpoint 模型实例
            model: AIModel 模型实例
        """
        self.endpoint = endpoint
        self.model = model

    @abstractmethod
    def analyze(self, image_data: str, mime_type: str) -> AnalysisResult:
        """
        执行图片分析

        Args:
            image_data: Base64 编码的图片数据
            mime_type: 图片 MIME 类型（如 image/jpeg）

        Returns:
            AnalysisResult: 分析结果

        Raises:
            NetworkError: 网络连接失败
            TimeoutError: 请求超时
            RateLimitError: API 频率限制
            APIError: API 服务错误
        """
        pass

    @abstractmethod
    def get_available_models(self) -> List[str]:
        """
        获取该端点可用的模型列表

        Returns:
            List[str]: 模型名称列表

        Raises:
            NetworkError: 网络连接失败
            APIError: API 服务错误
        """
        pass

    def _build_headers(self) -> Dict[str, str]:
        """
        构建请求头

        Returns:
            Dict[str, str]: 请求头字典
        """
        headers = {
            'Content-Type': 'application/json',
        }
        if self.endpoint.api_key:
            headers['Authorization'] = f"Bearer {self.endpoint.api_key}"
        return headers

    def _get_timeout(self) -> int:
        """
        获取请求超时时间

        Returns:
            int: 超时秒数
        """
        from django.conf import settings
        return getattr(settings, 'LLM_API_TIMEOUT', 120)
