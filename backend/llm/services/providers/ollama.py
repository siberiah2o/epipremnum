"""
Ollama 提供商实现

使用 Ollama API 进行图片分析
API 文档: https://github.com/ollama/ollama/blob/main/docs/api.md
"""

import json
import logging
import re
import requests
from typing import List

from .base import BaseProvider, AnalysisResult
from llm.constants import PROMPTS, ANALYSIS_DEFAULTS
from llm.exceptions import (
    NetworkError,
    TimeoutError,
    RateLimitError,
    PermissionError,
    APIError,
    ValidationError,
)

logger = logging.getLogger(__name__)


class OllamaProvider(BaseProvider):
    """
    Ollama API 提供商

    使用 /api/chat 端点进行图片分析，支持视觉模型
    """

    def analyze(self, image_data: str, mime_type: str) -> AnalysisResult:
        """
        调用 Ollama API 进行图片分析

        Args:
            image_data: Base64 编码的图片数据
            mime_type: 图片 MIME 类型

        Returns:
            AnalysisResult: 分析结果
        """
        api_url = f"{self.endpoint.base_url.rstrip('/')}/api/chat"
        headers = self._build_headers()
        timeout = self._get_timeout()

        payload = {
            'model': self.model.name,
            'messages': [
                {
                    'role': 'user',
                    'content': PROMPTS.SINGLE_REQUEST,
                    'images': [image_data]
                }
            ],
            'stream': False,
            'options': {
                'temperature': ANALYSIS_DEFAULTS.TEMPERATURE,
                'num_predict': ANALYSIS_DEFAULTS.NUM_PREDICT,
            }
        }

        try:
            logger.info(f"Ollama API 请求: url={api_url}, model={self.model.name}")
            response = requests.post(api_url, headers=headers, json=payload, timeout=timeout)
            response.raise_for_status()

            data = response.json()

            if 'message' not in data:
                raise APIError("Ollama API 响应缺少 message 字段")

            content = data['message'].get('content', '')

            # 解析 JSON 响应
            parsed_result = self._parse_json_response(content)

            # 获取 token 使用情况
            prompt_tokens = data.get('prompt_eval_count', 0)
            completion_tokens = data.get('eval_count', 0)
            total_tokens = prompt_tokens + completion_tokens

            return AnalysisResult(
                description=parsed_result.get('description', ''),
                categories=parsed_result.get('categories', [])[:ANALYSIS_DEFAULTS.MAX_CATEGORIES],
                scenes=parsed_result.get('scenes', [])[:ANALYSIS_DEFAULTS.MAX_SCENES],
                raw_response=content,
                method='ollama_single',
                tokens_used=total_tokens,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )

        except requests.exceptions.Timeout as e:
            raise TimeoutError(f"Ollama API 请求超时: {e}")
        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"Ollama API 连接失败: {e}")
        except requests.exceptions.HTTPError as e:
            self._handle_http_error(e)
        except json.JSONDecodeError as e:
            raise APIError(f"Ollama API 响应解析失败: {e}")

    def get_available_models(self) -> List[str]:
        """
        获取 Ollama 可用的模型列表

        Returns:
            List[str]: 模型名称列表
        """
        api_url = f"{self.endpoint.base_url.rstrip('/')}/api/tags"
        headers = self._build_headers()
        timeout = self._get_timeout()

        try:
            response = requests.get(api_url, headers=headers, timeout=timeout)
            response.raise_for_status()

            data = response.json()
            models = data.get('models', [])
            return [m.get('name') for m in models if m.get('name')]

        except requests.exceptions.Timeout as e:
            raise TimeoutError(f"获取模型列表超时: {e}")
        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"获取模型列表连接失败: {e}")
        except requests.exceptions.HTTPError as e:
            self._handle_http_error(e)

    def _parse_json_response(self, content: str) -> dict:
        """
        解析 API 响应中的 JSON

        Args:
            content: API 返回的内容

        Returns:
            dict: 解析后的字典
        """
        # 尝试直接解析
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 尝试从 markdown 代码块中提取
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        raise ValidationError(f"无法解析 JSON 响应: {content[:100]}...")

    def _handle_http_error(self, e: requests.exceptions.HTTPError):
        """处理 HTTP 错误"""
        status_code = e.response.status_code if e.response else 0
        error_text = e.response.text[:500] if e.response else ""

        if status_code == 429:
            raise RateLimitError(f"Ollama API 频率限制: {error_text}")
        elif status_code in (401, 403):
            raise PermissionError(f"Ollama API 认证失败: {error_text}")
        else:
            raise APIError(f"Ollama API 错误 (HTTP {status_code}): {error_text}")
