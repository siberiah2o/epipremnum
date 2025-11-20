"""
LLMS 服务模块
提供 Ollama API 客户端服务
"""
import requests
import base64
import json
import logging
from typing import Dict, List, Optional
from django.core.cache import cache
from .models import AIModel, OllamaEndpoint

logger = logging.getLogger(__name__)


class OllamaAPIError(Exception):
    """Ollama API错误"""
    pass


class OllamaClient:
    """Ollama API 客户端"""

    def __init__(self, base_url: str = None, timeout: int = 300):
        self.timeout = timeout
        if base_url:
            self.base_url = base_url.rstrip('/')
        else:
            # 使用默认端点
            try:
                endpoint = OllamaEndpoint.objects.filter(is_active=True, is_default=True).first()
                self.base_url = endpoint.url.rstrip('/') if endpoint else "http://115.190.140.100:31434"
            except Exception:
                self.base_url = "http://115.190.140.100:31434"

    def list_models(self) -> List[Dict]:
        """获取模型列表"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=self.timeout)
            response.raise_for_status()
            return response.json().get("models", [])
        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return []

    def generate_response(self, model_name: str, prompt: str, images: List[str] = None) -> Dict:
        """生成AI响应"""
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False
        }

        if images:
            payload["images"] = images

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"AI模型调用失败: {str(e)}")
            raise OllamaAPIError(f"AI模型调用失败: {str(e)}")

    def test_connection(self) -> Dict[str, any]:
        """测试连接"""
        try:
            models = self.list_models()
            return {
                'success': True,
                'models_count': len(models),
                'models': [model.get('name', '') for model in models[:10]]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }