import requests
import json
import base64
import logging
from typing import Dict, List, Optional, Tuple
from django.conf import settings
from django.core.files.base import ContentFile
from .models import OllamaModel, AIAnalysis, SuggestedCategory, SuggestedTag
from media.models import Category, Tag

logger = logging.getLogger(__name__)


class OllamaClient:
    """Ollama API客户端"""

    def __init__(self, base_url: str = None, timeout: int = 300, endpoint_id: int = None):
        """
        初始化Ollama客户端

        Args:
            base_url: 服务端点URL，如果为None则使用默认端点
            timeout: 超时时间（秒）
            endpoint_id: 端点ID，如果提供则从数据库获取配置
        """
        if endpoint_id:
            # 从数据库获取端点配置
            from .models import OllamaEndpoint
            try:
                endpoint = OllamaEndpoint.objects.get(id=endpoint_id, is_active=True)
                self.base_url = endpoint.url.rstrip('/')
                self.timeout = endpoint.timeout
                self.endpoint_id = endpoint.id
            except OllamaEndpoint.DoesNotExist:
                raise ValueError(f"端点ID {endpoint_id} 不存在或未激活")
        elif base_url:
            self.base_url = base_url.rstrip('/')
            self.timeout = timeout
            self.endpoint_id = None
        else:
            # 使用默认端点
            from .models import OllamaEndpoint
            endpoint = OllamaEndpoint.get_default_endpoint()
            if endpoint:
                self.base_url = endpoint.url.rstrip('/')
                self.timeout = endpoint.timeout
                self.endpoint_id = endpoint.id
            else:
                # 回退到硬编码的默认URL
                self.base_url = "http://115.190.140.100:31434"
                self.timeout = timeout
                self.endpoint_id = None

    def _make_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Dict:
        """发送HTTP请求到Ollama API"""
        url = f"{self.base_url}/{endpoint}"
        headers = {"Content-Type": "application/json"}

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=self.timeout)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=self.timeout)
            else:
                raise ValueError(f"不支持的HTTP方法: {method}")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API请求失败: {str(e)}")
            raise OllamaAPIError(f"API请求失败: {str(e)}")

    def list_models(self) -> List[Dict]:
        """获取可用的模型列表"""
        try:
            response = self._make_request("api/tags")
            return response.get("models", [])
        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return []

    def model_info(self, model_name: str) -> Dict:
        """获取模型详细信息"""
        try:
            response = self._make_request("api/show", "POST", {"name": model_name})
            return response
        except Exception as e:
            logger.error(f"获取模型信息失败: {str(e)}")
            return {}

    def pull_model(self, model_name: str) -> bool:
        """拉取模型"""
        try:
            # 流式下载模型，这里简化处理
            self._make_request("api/pull", "POST", {"name": model_name})
            return True
        except Exception as e:
            logger.error(f"拉取模型失败: {str(e)}")
            return False

    def generate_response(self, model_name: str, prompt: str,
                         images: List[str] = None,
                         system_prompt: str = None,
                         stream: bool = False) -> Dict:
        """生成响应"""
        data = {
            "model": model_name,
            "prompt": prompt,
            "stream": stream
        }

        if images:
            data["images"] = images

        if system_prompt:
            data["system"] = system_prompt

        try:
            response = self._make_request("api/generate", "POST", data)
            return response
        except Exception as e:
            logger.error(f"生成响应失败: {str(e)}")
            raise OllamaAPIError(f"生成响应失败: {str(e)}")

    def chat_completion(self, model_name: str, messages: List[Dict],
                       images: List[str] = None,
                       stream: bool = False) -> Dict:
        """聊天完成"""
        data = {
            "model": model_name,
            "messages": messages,
            "stream": stream
        }

        if images:
            data["images"] = images

        try:
            response = self._make_request("api/chat", "POST", data)
            return response
        except Exception as e:
            logger.error(f"聊天完成失败: {str(e)}")
            raise OllamaAPIError(f"聊天完成失败: {str(e)}")


class OllamaAPIError(Exception):
    """Ollama API错误"""
    pass


class ImageAnalyzer:
    """图片分析器"""

    def __init__(self, model_name: str = None, client=None):
        self.client = client or OllamaClient()
        # 默认使用qwen3-vl:4b模型，因为它在您的服务中可用
        self.model_name = model_name or "qwen3-vl:4b-instruct-bf16"
        self.system_prompt = """你是一个专业的图片分析师。请仔细分析图片内容，并提供：
1. 一个简洁准确的标题（不超过200字符）
2. 详细的内容描述
3. 适合的提示词（用于图片生成或搜索）
4. 相关的分类建议
5. 相关的标签建议

请以JSON格式返回结果，格式如下：
{
    "title": "图片标题",
    "description": "详细描述",
    "prompt": "提示词",
    "categories": ["分类1", "分类2"],
    "tags": ["标签1", "标签2", "标签3"]
}
"""

    def encode_image_to_base64(self, image_path: str) -> str:
        """将图片编码为base64"""
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            logger.error(f"图片编码失败: {str(e)}")
            raise OllamaAPIError(f"图片编码失败: {str(e)}")

    def analyze_image(self, image_path: str, user=None) -> Dict:
        """分析图片"""
        try:
            # 编码图片
            image_base64 = self.encode_image_to_base64(image_path)

            # 准备分析请求
            prompt = """请分析这张图片，返回标题、描述、提示词、分类和标签建议。"""

            # 生成响应
            response = self.client.generate_response(
                model_name=self.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt=self.system_prompt
            )

            # 解析响应
            response_text = response.get("response", "")
            return self._parse_analysis_response(response_text)

        except Exception as e:
            logger.error(f"图片分析失败: {str(e)}")
            raise OllamaAPIError(f"图片分析失败: {str(e)}")

    def _parse_analysis_response(self, response_text: str) -> Dict:
        """解析分析响应"""
        try:
            # 尝试解析JSON响应
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                return json.loads(json_str)
            else:
                # 如果无法解析JSON，返回基本的文本分析
                return {
                    "title": "",
                    "description": response_text,
                    "prompt": "",
                    "categories": [],
                    "tags": []
                }
        except json.JSONDecodeError as e:
            logger.error(f"响应解析失败: {str(e)}")
            return {
                "title": "",
                "description": response_text,
                "prompt": "",
                "categories": [],
                "tags": []
            }


class AIAnalysisService:
    """AI分析服务"""

    def __init__(self, client=None):
        self.client = client or OllamaClient()
        self.analyzer = ImageAnalyzer(client=self.client)

    def analyze_media_file(self, media_file, user=None, model_name: str = None) -> AIAnalysis:
        """分析媒体文件"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        # 创建或获取AI分析记录
        ai_analysis, created = AIAnalysis.objects.get_or_create(
            media=media_file,
            defaults={
                'status': 'processing',
                'model_used': model_name or self.analyzer.model_name
            }
        )

        if not created and ai_analysis.status == 'completed':
            return ai_analysis

        try:
            # 更新状态为处理中
            ai_analysis.status = 'processing'
            ai_analysis.save()

            # 设置分析器模型
            if model_name:
                self.analyzer.model_name = model_name

            # 分析图片
            image_path = media_file.file.path
            analysis_result = self.analyzer.analyze_image(image_path, user)

            # 保存分析结果
            ai_analysis.ai_title = analysis_result.get('title', '')
            ai_analysis.ai_description = analysis_result.get('description', '')
            ai_analysis.ai_prompt = analysis_result.get('prompt', '')
            ai_analysis.analysis_result = analysis_result
            ai_analysis.model_used = model_name or self.analyzer.model_name
            ai_analysis.mark_completed(model_name or self.analyzer.model_name)

            # 处理分类建议
            self._process_category_suggestions(ai_analysis, analysis_result.get('categories', []), user)

            # 处理标签建议
            self._process_tag_suggestions(ai_analysis, analysis_result.get('tags', []), user)

            return ai_analysis

        except Exception as e:
            ai_analysis.mark_failed(str(e))
            logger.error(f"媒体文件分析失败: {str(e)}")
            raise

    def _process_category_suggestions(self, ai_analysis: AIAnalysis, categories: List[str], user):
        """处理分类建议"""
        if not user:
            return

        for category_name in categories:
            try:
                # 获取或创建分类
                category, created = Category.objects.get_or_create(
                    name=category_name,
                    user=user,
                    defaults={'description': f'AI建议的分类: {category_name}'}
                )

                # 创建建议关联
                SuggestedCategory.objects.get_or_create(
                    ai_analysis=ai_analysis,
                    category=category,
                    defaults={'confidence': 0.8}  # 默认置信度
                )

            except Exception as e:
                logger.error(f"处理分类建议失败: {str(e)}")

    def _process_tag_suggestions(self, ai_analysis: AIAnalysis, tags: List[str], user):
        """处理标签建议"""
        if not user:
            return

        for tag_name in tags:
            try:
                # 获取或创建标签
                tag, created = Tag.objects.get_or_create(
                    name=tag_name,
                    user=user
                )

                # 创建建议关联
                SuggestedTag.objects.get_or_create(
                    ai_analysis=ai_analysis,
                    tag=tag,
                    defaults={'confidence': 0.8}  # 默认置信度
                )

            except Exception as e:
                logger.error(f"处理标签建议失败: {str(e)}")

    def batch_analyze_media_files(self, media_files, user=None, model_name: str = None) -> 'BatchAnalysisJob':
        """批量分析媒体文件"""
        from .models import BatchAnalysisJob

        # 创建批量分析任务
        job = BatchAnalysisJob.objects.create(
            user=user,
            total_files=len(media_files)
        )

        # 添加媒体文件到任务
        job.media_files.add(*media_files)

        # 异步执行批量分析（这里简化处理，实际应该使用Celery或其他任务队列）
        try:
            job.start_job()

            for media_file in media_files:
                try:
                    self.analyze_media_file(media_file, user, model_name)
                    job.processed_files += 1
                except Exception as e:
                    logger.error(f"批量分析中文件失败: {str(e)}")
                    job.failed_files += 1
                finally:
                    job.update_progress()

            job.complete_job()

        except Exception as e:
            job.fail_job(str(e))

        return job

    def generate_title(self, media_file, model_name: str = None) -> str:
        """生成图片标题"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        try:
            image_path = media_file.file.path
            image_base64 = self.analyzer.encode_image_to_base64(image_path)

            prompt = "请为这张图片生成一个简洁、准确的标题（不超过200字符）。只返回标题，不要其他解释。"

            response = self.client.generate_response(
                model_name=model_name or self.analyzer.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt="你是一个专业的图片标题生成助手，擅长为图片创建简洁准确的标题。"
            )

            title = response.get('response', '').strip()
            return title

        except Exception as e:
            logger.error(f"生成标题失败: {str(e)}")
            raise OllamaAPIError(f"生成标题失败: {str(e)}")

    def generate_description(self, media_file, model_name: str = None) -> str:
        """生成图片描述"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        try:
            image_path = media_file.file.path
            image_base64 = self.analyzer.encode_image_to_base64(image_path)

            prompt = "请详细描述这张图片的内容，包括主要对象、场景、颜色、构图等。返回详细的描述文本。"

            response = self.client.generate_response(
                model_name=model_name or self.analyzer.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt="你是一个专业的图片描述生成助手，擅长详细描述图片的内容和特征。"
            )

            description = response.get('response', '').strip()
            return description

        except Exception as e:
            logger.error(f"生成描述失败: {str(e)}")
            raise OllamaAPIError(f"生成描述失败: {str(e)}")

    def generate_prompt(self, media_file, model_name: str = None) -> str:
        """生成图片提示词"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        try:
            image_path = media_file.file.path
            image_base64 = self.analyzer.encode_image_to_base64(image_path)

            prompt = "请为这张图片生成适合AI绘画或搜索的关键词提示词，用逗号分隔。包括风格、主题、对象、色彩等元素。"

            response = self.client.generate_response(
                model_name=model_name or self.analyzer.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt="你是一个专业的提示词生成助手，擅长创建用于AI绘画和图像搜索的关键词。"
            )

            prompt_text = response.get('response', '').strip()
            return prompt_text

        except Exception as e:
            logger.error(f"生成提示词失败: {str(e)}")
            raise OllamaAPIError(f"生成提示词失败: {str(e)}")

    def generate_categories(self, media_file, user, model_name: str = None, max_categories: int = 5) -> List[Dict]:
        """生成分类建议"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        if not user:
            return []

        try:
            # 确保max_categories是整数
            max_categories = int(max_categories) if max_categories else 5

            image_path = media_file.file.path
            image_base64 = self.analyzer.encode_image_to_base64(image_path)

            # 获取用户现有的分类作为参考
            existing_categories = list(Category.objects.filter(user=user).values_list('name', flat=True))
            existing_text = f"用户已有分类: {', '.join(existing_categories)}。" if existing_categories else ""

            prompt = f"请为这张图片推荐合适的分类。{existing_text}请返回JSON格式：{{\"categories\": [\"分类1\", \"分类2\", \"分类3\"]}}。最多{max_categories}个分类。"

            response = self.client.generate_response(
                model_name=model_name or self.analyzer.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt="你是一个专业的图片分类助手，擅长为图片推荐合适的分类标签。"
            )

            response_text = response.get('response', '').strip()

            # 解析JSON响应
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                    categories = data.get('categories', [])
                    # 确保categories是列表
                    if isinstance(categories, str):
                        categories = [categories]
                except json.JSONDecodeError:
                    # 如果JSON解析失败，尝试简单解析
                    categories = []
                except Exception:
                    categories = []
            else:
                # 尝试从响应中提取列表
                list_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
                if list_match:
                    try:
                        # 简单的逗号分隔解析
                        content = list_match.group(1)
                        categories = [cat.strip().strip('"\'') for cat in content.split(',') if cat.strip()]
                    except:
                        categories = []
                else:
                    categories = []

            # 清理和验证分类
            valid_categories = []
            for category in categories[:max_categories]:
                category = str(category).strip()
                if category and len(category) <= 50:  # 分类名称长度限制
                    valid_categories.append({
                        'name': category,
                        'confidence': 0.8  # 默认置信度
                    })

            return valid_categories

        except Exception as e:
            logger.error(f"生成分类建议失败: {str(e)}")
            raise OllamaAPIError(f"生成分类建议失败: {str(e)}")

    def generate_tags(self, media_file, user, model_name: str = None, max_tags: int = 10) -> List[Dict]:
        """生成标签建议"""
        if media_file.file_type != 'image':
            raise ValueError("只支持分析图片文件")

        if not user:
            return []

        try:
            # 确保max_tags是整数
            max_tags = int(max_tags) if max_tags else 10

            image_path = media_file.file.path
            image_base64 = self.analyzer.encode_image_to_base64(image_path)

            # 获取用户现有的标签作为参考
            existing_tags = list(Tag.objects.filter(user=user).values_list('name', flat=True))
            existing_text = f"用户已有标签: {', '.join(existing_tags)}。" if existing_tags else ""

            prompt = f"请为这张图片推荐相关的标签。{existing_text}请返回JSON格式：{{\"tags\": [\"标签1\", \"标签2\", \"标签3\"]}}。最多{max_tags}个标签。"

            response = self.client.generate_response(
                model_name=model_name or self.analyzer.model_name,
                prompt=prompt,
                images=[image_base64],
                system_prompt="你是一个专业的图片标签生成助手，擅长为图片推荐相关的标签关键词。"
            )

            response_text = response.get('response', '').strip()

            # 解析JSON响应
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                    tags = data.get('tags', [])
                    # 确保tags是列表
                    if isinstance(tags, str):
                        tags = [tags]
                except json.JSONDecodeError:
                    # 如果JSON解析失败，尝试简单解析
                    tags = []
                except Exception:
                    tags = []
            else:
                # 尝试从响应中提取列表
                list_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
                if list_match:
                    try:
                        # 简单的逗号分隔解析
                        content = list_match.group(1)
                        tags = [tag.strip().strip('"\'') for tag in content.split(',') if tag.strip()]
                    except:
                        tags = []
                else:
                    tags = []

            # 清理和验证标签
            valid_tags = []
            for tag in tags[:max_tags]:
                tag = str(tag).strip()
                if tag and len(tag) <= 30:  # 标签长度限制
                    valid_tags.append({
                        'name': tag,
                        'confidence': 0.8  # 默认置信度
                    })

            return valid_tags

        except Exception as e:
            logger.error(f"生成标签建议失败: {str(e)}")
            raise OllamaAPIError(f"生成标签建议失败: {str(e)}")

    def get_available_models(self) -> List[OllamaModel]:
        """获取可用的模型列表"""
        try:
            # 从Ollama API获取模型列表
            models_data = self.client.list_models()

            # 更新或创建模型记录
            models = []
            for model_data in models_data:
                model_name = model_data.get('name', '')
                if ('llava' in model_name.lower() or 'vision' in model_name.lower() or
                    'vl' in model_name.lower() or 'minicpm-v' in model_name.lower() or
                    'qwen3-vl' in model_name.lower()):
                    # 这是支持视觉的模型
                    model, created = OllamaModel.objects.get_or_create(
                        name=model_name,
                        defaults={
                            'display_name': model_name,
                            'is_vision_capable': True,
                            'model_size': model_data.get('size', ''),
                            'description': model_data.get('description', '')
                        }
                    )
                    models.append(model)

            return models

        except Exception as e:
            logger.error(f"获取可用模型失败: {str(e)}")
            return OllamaModel.get_active_vision_models()


def get_ai_analysis_service():
    """获取AI分析服务实例"""
    return AIAnalysisService()