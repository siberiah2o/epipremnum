"""
OpenAI 兼容提供商实现

支持 OpenAI API 及其兼容的 API（如智谱、DeepSeek 等）
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


class OpenAICompatibleProvider(BaseProvider):
    """
    OpenAI 兼容 API 提供商

    支持 OpenAI API 及其兼容的 API（智谱 AI、DeepSeek 等）
    使用 /chat/completions 端点进行图片分析

    分析策略:
    1. 优先尝试单次请求获取完整 JSON 结果
    2. 如果失败，降级为三次请求（描述、分类、场景）
    """

    def analyze(self, image_data: str, mime_type: str) -> AnalysisResult:
        """
        调用 OpenAI 兼容 API 进行图片分析

        Args:
            image_data: Base64 编码的图片数据
            mime_type: 图片 MIME 类型

        Returns:
            AnalysisResult: 分析结果
        """
        api_url = f"{self.endpoint.base_url.rstrip('/')}/chat/completions"
        headers = self._build_headers()

        # 方案一：尝试单次请求
        logger.info(f"OpenAI API 单次请求: model={self.model.name}")
        try:
            result = self._single_request(api_url, headers, image_data, mime_type)
            if result:
                return result
        except (ValidationError, APIError) as e:
            # 可恢复的错误，降级为三次请求
            logger.warning(f"单次请求失败，降级为三次请求: {e}")
        except (NetworkError, TimeoutError, RateLimitError, PermissionError):
            # 不可恢复的错误，直接抛出
            raise
        except Exception as e:
            # 未知错误，记录后抛出
            logger.error(f"单次请求发生未知错误: {type(e).__name__}: {e}")
            raise APIError(f"分析请求失败: {e}")

        # 方案二：降级为三次请求
        logger.info(f"OpenAI API 降级为三次请求: model={self.model.name}")
        return self._three_requests(api_url, headers, image_data, mime_type)

    def get_available_models(self) -> List[str]:
        """
        获取可用的模型列表

        Returns:
            List[str]: 模型名称列表
        """
        api_url = f"{self.endpoint.base_url.rstrip('/')}/models"
        headers = self._build_headers()
        timeout = self._get_timeout()

        try:
            response = requests.get(api_url, headers=headers, timeout=timeout)
            response.raise_for_status()

            data = response.json()
            models = data.get('data', [])
            return [m.get('id') for m in models if m.get('id')]

        except requests.exceptions.Timeout as e:
            raise TimeoutError(f"获取模型列表超时: {e}")
        except requests.exceptions.ConnectionError as e:
            raise NetworkError(f"获取模型列表连接失败: {e}")
        except requests.exceptions.HTTPError as e:
            self._handle_http_error(e)

    def _single_request(
        self,
        api_url: str,
        headers: dict,
        image_data: str,
        mime_type: str
    ) -> AnalysisResult:
        """
        单次请求获取完整分析（JSON 格式）

        Args:
            api_url: API URL
            headers: 请求头
            image_data: Base64 图片数据
            mime_type: MIME 类型

        Returns:
            AnalysisResult: 分析结果
        """
        timeout = self._get_timeout()

        payload = {
            'model': self.model.name,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': PROMPTS.SINGLE_REQUEST},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f"data:{mime_type};base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            'max_tokens': ANALYSIS_DEFAULTS.MAX_TOKENS_SINGLE,
        }

        response = requests.post(api_url, headers=headers, json=payload, timeout=timeout)
        response.raise_for_status()

        data = response.json()

        if 'choices' not in data or not data['choices']:
            raise APIError("API 响应缺少 choices 字段")

        content = data['choices'][0].get('message', {}).get('content', '')

        # 解析 JSON
        parsed = self._parse_json_response(content)

        usage = data.get('usage', {})

        return AnalysisResult(
            description=parsed.get('description', ''),
            categories=parsed.get('categories', [])[:ANALYSIS_DEFAULTS.MAX_CATEGORIES],
            scenes=parsed.get('scenes', [])[:ANALYSIS_DEFAULTS.MAX_SCENES],
            raw_response=content,
            method='single',
            tokens_used=usage.get('total_tokens'),
            prompt_tokens=usage.get('prompt_tokens'),
            completion_tokens=usage.get('completion_tokens'),
        )

    def _three_requests(
        self,
        api_url: str,
        headers: dict,
        image_data: str,
        mime_type: str
    ) -> AnalysisResult:
        """
        三次请求分别获取描述、分类、场景

        Args:
            api_url: API URL
            headers: 请求头
            image_data: Base64 图片数据
            mime_type: MIME 类型

        Returns:
            AnalysisResult: 分析结果
        """
        timeout = self._get_timeout()
        total_tokens = 0

        # 第一次请求：获取描述
        desc_payload = {
            'model': self.model.name,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': PROMPTS.DESCRIPTION_ONLY},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f"data:{mime_type};base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            'max_tokens': ANALYSIS_DEFAULTS.MAX_TOKENS_DESCRIPTION,
        }

        desc_response = requests.post(api_url, headers=headers, json=desc_payload, timeout=timeout)
        desc_response.raise_for_status()
        desc_data = desc_response.json()
        description = desc_data['choices'][0].get('message', {}).get('content', '')
        total_tokens += desc_data.get('usage', {}).get('total_tokens', 0)

        # 第二次请求：提取分类
        cat_payload = {
            'model': self.model.name,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': PROMPTS.CATEGORIES_FROM_DESC.format(description=description)},
                    ]
                }
            ],
            'max_tokens': ANALYSIS_DEFAULTS.MAX_TOKENS_TAGS,
        }

        cat_response = requests.post(api_url, headers=headers, json=cat_payload, timeout=timeout)
        cat_response.raise_for_status()
        cat_data = cat_response.json()
        cat_content = cat_data['choices'][0].get('message', {}).get('content', '')
        categories = self._parse_tags(cat_content)
        total_tokens += cat_data.get('usage', {}).get('total_tokens', 0)

        # 第三次请求：提取场景
        scene_payload = {
            'model': self.model.name,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': PROMPTS.SCENES_FROM_DESC.format(description=description)},
                    ]
                }
            ],
            'max_tokens': ANALYSIS_DEFAULTS.MAX_TOKENS_TAGS,
        }

        scene_response = requests.post(api_url, headers=headers, json=scene_payload, timeout=timeout)
        scene_response.raise_for_status()
        scene_data = scene_response.json()
        scene_content = scene_data['choices'][0].get('message', {}).get('content', '')
        scenes = self._parse_tags(scene_content)
        total_tokens += scene_data.get('usage', {}).get('total_tokens', 0)

        return AnalysisResult(
            description=description,
            categories=categories,
            scenes=scenes,
            raw_response=f"描述: {description}\n分类: {categories}\n场景: {scenes}",
            method='three_requests',
            tokens_used=total_tokens,
        )

    def _parse_json_response(self, content: str) -> dict:
        """解析 JSON 响应"""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 尝试从 markdown 代码块提取
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        raise ValidationError(f"无法解析 JSON 响应: {content[:100]}...")

    def _parse_tags(self, content: str) -> List[str]:
        """解析标签列表"""
        # 支持顿号和逗号分隔
        tags = [tag.strip() for tag in content.replace('、', ',').split(',') if tag.strip()]
        return tags[:ANALYSIS_DEFAULTS.MAX_CATEGORIES]

    def _handle_http_error(self, e: requests.exceptions.HTTPError):
        """处理 HTTP 错误"""
        status_code = e.response.status_code if e.response else 0
        error_text = e.response.text[:500] if e.response else ""

        if status_code == 429:
            raise RateLimitError(f"API 频率限制: {error_text}")
        elif status_code in (401, 403):
            raise PermissionError(f"API 认证失败: {error_text}")
        else:
            raise APIError(f"API 错误 (HTTP {status_code}): {error_text}")
