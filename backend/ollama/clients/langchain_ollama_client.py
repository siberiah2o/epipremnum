"""
使用 LangChain 集成 Ollama
基于 https://python.langchain.com/docs/integrations/chat/ollama
"""

import os
import base64
import warnings
from typing import Dict, List, Optional, Union
from langchain_core.messages import HumanMessage
import logging
import requests

# 抑制 LangChain 的弃用警告
warnings.filterwarnings("ignore", category=DeprecationWarning, message=".*ChatOllama.*")
warnings.filterwarnings("ignore", category=DeprecationWarning, message=".*Ollama.*")

# 使用 langchain_community（虽然有弃用警告，但仍然可用）
from langchain_community.chat_models import ChatOllama
from langchain_community.llms import Ollama

logger = logging.getLogger(__name__)


class LangChainOllamaClient:
    """使用 LangChain 的 Ollama 客户端"""

    def __init__(self, base_url: str, model: str = "llama2", timeout: int = 300):
        """
        初始化 LangChain Ollama 客户端

        Args:
            base_url: Ollama 服务的基础URL
            model: 默认使用的模型
            timeout: 请求超时时间（秒）
        """
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout = timeout
        self.chat_client = None
        self.llm_client = None
        self._initialize_clients()

    def _initialize_clients(self):
        """初始化 LangChain 客户端"""
        try:
            # 初始化聊天客户端（支持多模态）
            self.chat_client = ChatOllama(
                base_url=self.base_url,
                model=self.model,
                temperature=0.7,
                timeout=self.timeout,
                keep_alive="30m",  # 保持模型在内存中30分钟
            )

            # 初始化文本生成客户端
            self.llm_client = Ollama(
                base_url=self.base_url,
                model=self.model,
                temperature=0.7,
                timeout=self.timeout,
            )

            logger.info(f"LangChain Ollama 客户端初始化成功，URL: {self.base_url}, 模型: {self.model}")
        except Exception as e:
            logger.error(f"初始化 LangChain Ollama 客户端失败: {str(e)}")
            raise

    def get_models(self) -> List[Dict]:
        """
        获取 Ollama 可用模型列表

        Returns:
            模型列表
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            response.raise_for_status()
            data = response.json()

            models = []
            for model in data.get('models', []):
                # 判断是否支持视觉能力
                is_vision = self._check_vision_capability(model.get('name', ''))

                models.append({
                    'name': model.get('name', ''),
                    'size': model.get('size', 0),
                    'digest': model.get('digest', ''),
                    'modified_at': model.get('modified_at', ''),
                    'details': model.get('details', {}),
                    'supports_vision': is_vision,
                    'display_name': model.get('name', '').split(':')[0],
                })

            return models
        except Exception as e:
            logger.error(f"获取 Ollama 模型列表失败: {str(e)}")
            return []

    def _check_vision_capability(self, model_name: str) -> bool:
        """检查模型是否支持视觉能力"""
        vision_keywords = [
            'llava', 'vision', 'clip', 'multimodal', 'vl', 'minicpm',
            'bakllava', 'moondream', 'nomic-embed-vision'
        ]
        return any(keyword in model_name.lower() for keyword in vision_keywords)

    def analyze_image(
        self,
        image_data: Union[str, bytes],
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict:
        """
        使用 LangChain 分析图片

        Args:
            image_data: 图片路径或二进制数据
            prompt: 分析提示词
            model: 使用的模型（可选）
            temperature: 温度参数
            max_tokens: 最大输出token数
            **kwargs: 其他参数

        Returns:
            分析结果
        """
        try:
            # 如果指定了不同的模型，重新初始化客户端
            if model and model != self.model:
                temp_client = ChatOllama(
                    base_url=self.base_url,
                    model=model,
                    temperature=temperature,
                    timeout=self.timeout,
                    num_predict=max_tokens,
                )
            else:
                temp_client = self.chat_client
                if max_tokens:
                    temp_client.num_predict = max_tokens

            # 处理图片数据
            image_base64 = self._encode_image(image_data)

            # 构造消息
            messages = [
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                )
            ]

            # 调用模型
            response = temp_client.invoke(messages)

            return {
                "success": True,
                "response": response.content,
                "model_used": model or self.model,
            }

        except Exception as e:
            logger.error(f"LangChain Ollama 图片分析失败: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "model_used": model or self.model,
            }

    def chat_completion(
        self,
        messages: List[Dict],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict:
        """
        文本对话补全

        Args:
            messages: 对话消息列表
            model: 使用的模型
            temperature: 温度参数
            max_tokens: 最大输出token数
            stream: 是否流式输出
            **kwargs: 其他参数

        Returns:
            对话结果
        """
        try:
            # 如果指定了不同的模型，重新初始化客户端
            if model and model != self.model:
                temp_client = ChatOllama(
                    base_url=self.base_url,
                    model=model,
                    temperature=temperature,
                    timeout=self.timeout,
                    num_predict=max_tokens,
                )
            else:
                temp_client = self.chat_client
                if max_tokens:
                    temp_client.num_predict = max_tokens

            # 转换消息格式
            langchain_messages = []
            for msg in messages:
                if msg.get("role") == "user":
                    langchain_messages.append(HumanMessage(content=msg.get("content", "")))
                # 可以根据需要添加其他角色的处理

            # 调用模型
            response = temp_client.invoke(langchain_messages)

            return {
                "success": True,
                "response": response.content,
                "model_used": model or self.model,
            }

        except Exception as e:
            logger.error(f"LangChain Ollama 对话失败: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "model_used": model or self.model,
            }

    def _encode_image(self, image_data: Union[str, bytes]) -> str:
        """将图片编码为base64"""
        try:
            if isinstance(image_data, str):
                with open(image_data, 'rb') as f:
                    image_bytes = f.read()
            else:
                image_bytes = image_data

            return base64.b64encode(image_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"图片编码失败: {str(e)}")
            raise

    def test_connection(self) -> bool:
        """测试连接"""
        try:
            # 尝试获取模型列表作为连接测试
            models = self.get_models()
            return len(models) > 0
        except Exception as e:
            logger.error(f"连接测试失败: {str(e)}")
            return False

    def pull_model(self, model_name: str) -> Dict:
        """
        拉取模型到本地

        Args:
            model_name: 模型名称

        Returns:
            拉取结果
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name},
                timeout=self.timeout
            )
            response.raise_for_status()

            # Ollama 的 pull 操作是流式的，返回结果需要流式读取
            # 这里简化处理，实际可能需要流式读取进度
            return {
                "success": True,
                "message": f"模型 {model_name} 拉取成功",
                "model": model_name
            }
        except Exception as e:
            logger.error(f"拉取模型失败: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "model": model_name
            }

    def get_langchain_model(self, model_name: Optional[str] = None):
        """
        获取LangChain模型实例

        Args:
            model_name: 模型名称，如果为None则使用默认模型

        Returns:
            LangChain ChatModel实例
        """
        return ChatOllama(
            base_url=self.base_url,
            model=model_name or self.model,
            temperature=0.7,
            timeout=self.timeout,
            keep_alive="30m",
        )

    @staticmethod
    def get_default_models() -> List[Dict]:
        """获取常用的 Ollama 模型列表"""
        return [
            {
                "name": "llama2",
                "display_name": "Llama 2",
                "supports_vision": False,
                "description": "Meta 的开源大语言模型"
            },
            {
                "name": "codellama",
                "display_name": "Code Llama",
                "supports_vision": False,
                "description": "专门用于代码生成的模型"
            },
            {
                "name": "mistral",
                "display_name": "Mistral",
                "supports_vision": False,
                "description": "Mistral AI 的开源模型"
            },
            {
                "name": "llava",
                "display_name": "LLaVA",
                "supports_vision": True,
                "description": "支持视觉理解的多模态模型"
            },
            {
                "name": "vicuna",
                "display_name": "Vicuna",
                "supports_vision": False,
                "description": "基于 LLaMA 的对话模型"
            },
        ]