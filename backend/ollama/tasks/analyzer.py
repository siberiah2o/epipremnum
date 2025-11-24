"""
Ollama图片分析器
负责与Ollama API交互进行图片分析
"""
import logging
import time
import base64
import requests
import json
from typing import Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


class OllamaImageAnalyzer:
    """Ollama图片分析器"""

    def __init__(self):
        self.timeout = getattr(settings, 'OLLAMA_ANALYSIS_TIMEOUT', 300)

    def analyze(self, analysis) -> Dict[str, Any]:
        """执行图片分析"""
        start_time = time.time()

        try:
            # 验证输入
            self._validate_input(analysis)

            # 准备数据
            data = self._prepare_data(analysis)

            # 调用API
            api_result = self._call_api(analysis.model.endpoint.url, analysis.model.name, data)

            if api_result['success']:
                # 处理结果
                processed_result = self._process_result(api_result['response'], analysis)
                processing_time = int((time.time() - start_time) * 1000)

                return {
                    'success': True,
                    'result': processed_result,
                    'processing_time_ms': processing_time,
                    'model_used': analysis.model.name,
                    'endpoint_used': analysis.model.endpoint.name
                }
            else:
                return {'success': False, 'error': api_result['error']}

        except Exception as e:
            logger.error(f"图片分析异常: {str(e)}")
            return {'success': False, 'error': f'分析异常: {str(e)}'}

    def _validate_input(self, analysis):
        """验证输入"""
        if not analysis.media or not analysis.media.file:
            raise Exception('媒体文件不存在')

        if not analysis.model or not analysis.model.is_vision_capable:
            raise Exception('模型不支持视觉分析')

        if not analysis.model.endpoint.is_active:
            raise Exception('模型端点未激活')

        # 检查是否为图片文件
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'}
        file_extension = analysis.media.file.name.lower().split('.')[-1]
        if f'.{file_extension}' not in image_extensions:
            raise Exception('只支持图片文件分析')

    def _prepare_data(self, analysis):
        """准备分析数据"""
        # 读取并编码图片
        analysis.media.file.seek(0)
        image_content = analysis.media.file.read()
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        analysis.media.file.seek(0)

        # 默认提示词
        default_prompt = """
请分析这张图片并提供以下信息：

1. **标题**: 为这张图片生成一个简洁、描述性的标题
2. **描述**: 详细描述图片的内容、场景和特点
3. **关键词**: 提取5-10个相关的关键词或标签

请以JSON格式返回结果：
{
    "title": "图片标题",
    "description": "详细描述",
    "keywords": ["关键词1", "关键词2", ...],
    "tags": ["标签1", "标签2", ...]
}
"""

        prompt = analysis.prompt or default_prompt

        return {
            'image': image_base64,
            'prompt': prompt,
            'options': {
                'temperature': analysis.analysis_options.get('temperature', 0.7),
                'top_p': analysis.analysis_options.get('top_p', 0.9),
                'max_tokens': analysis.analysis_options.get('max_tokens', 500),
            }
        }

    def _call_api(self, endpoint_url: str, model_name: str, data: Dict) -> Dict:
        """调用Ollama API"""
        api_url = f"{endpoint_url.rstrip('/')}/api/generate"

        request_data = {
            'model': model_name,
            'prompt': data['prompt'],
            'images': [data['image']],
            'stream': False,
            'options': data['options']
        }

        logger.info(f"调用Ollama API: model={model_name}")

        try:
            response = requests.post(
                api_url,
                json=request_data,
                timeout=self.timeout,
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code == 200:
                api_response = response.json()
                logger.info(f"Ollama API响应成功: model={model_name}")
                return {
                    'success': True,
                    'response': api_response
                }
            else:
                error_msg = f"API请求失败: HTTP {response.status_code}"
                logger.error(f"Ollama API错误: {error_msg}")
                return {'success': False, 'error': error_msg}

        except requests.exceptions.Timeout:
            error_msg = "API请求超时"
            logger.error(f"Ollama API超时: {error_msg}")
            return {'success': False, 'error': error_msg}
        except requests.exceptions.ConnectionError:
            error_msg = "无法连接到Ollama服务"
            logger.error(f"Ollama API连接错误: {error_msg}")
            return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"API调用异常: {str(e)}"
            logger.error(f"Ollama API异常: {error_msg}")
            return {'success': False, 'error': error_msg}

    def _process_result(self, api_response: Dict, analysis) -> Dict:
        """处理分析结果"""
        response_text = api_response.get('response', '')

        # 尝试解析JSON
        try:
            result_data = json.loads(response_text)
            if isinstance(result_data, dict):
                return {
                    'title': result_data.get('title', ''),
                    'description': result_data.get('description', ''),
                    'keywords': result_data.get('keywords', []),
                    'tags': result_data.get('tags', []),
                    'raw_response': response_text,
                    'prompt': analysis.prompt
                }

        except json.JSONDecodeError:
            logger.warning(f"无法解析JSON结果，使用文本处理: {response_text[:100]}...")

        # 文本处理
        return {
            'title': self._extract_title(response_text),
            'description': self._extract_description(response_text),
            'keywords': self._extract_keywords(response_text),
            'tags': [],
            'raw_response': response_text,
            'prompt': analysis.prompt
        }

    def _extract_title(self, text: str) -> str:
        """提取标题"""
        lines = text.strip().split('\n')
        for line in lines:
            if '标题' in line or 'title' in line.lower():
                if ':' in line:
                    return line.split(':', 1)[1].strip()
        return text.split('\n')[0][:50]

    def _extract_description(self, text: str) -> str:
        """提取描述"""
        lines = text.strip().split('\n')
        description_lines = []
        skip_title = True

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if skip_title and ('标题' in line or 'title' in line.lower()):
                skip_title = False
                continue

            if any(keyword in line.lower() for keyword in ['关键词', 'keywords', '标签', 'tags']):
                continue

            description_lines.append(line)

        return ' '.join(description_lines) if description_lines else text[:200]

    def _extract_keywords(self, text: str) -> list:
        """提取关键词"""
        keywords = []
        text_lower = text.lower()

        if '关键词' in text_lower or 'keywords' in text_lower:
            lines = text.split('\n')
            for line in lines:
                if any(keyword in line.lower() for keyword in ['关键词', 'keywords']):
                    if ':' in line:
                        keyword_text = line.split(':', 1)[1].strip()
                        for kw in keyword_text.replace('，', ',').split(','):
                            kw = kw.strip()
                            if kw:
                                keywords.append(kw)

        return keywords[:10]