"""
使用 LangChain 集成智谱AI
基于 https://python.langchain.com/docs/integrations/chat/zhipuai
"""

import os
import base64
from typing import Dict, List, Optional, Union
from langchain_core.messages import HumanMessage
from langchain_community.chat_models import ChatZhipuAI
import logging

logger = logging.getLogger(__name__)


class LangChainZhipuClient:
    """使用 LangChain 的智谱AI客户端"""

    def __init__(self, api_key: str, model: str = "glm-4.6v-flash"):
        """
        初始化 LangChain 智谱客户端

        Args:
            api_key: 智谱AI的API Key
            model: 默认使用的模型
        """
        self.api_key = api_key
        self.model = model
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        """初始化 LangChain 客户端"""
        try:
            self.client = ChatZhipuAI(
                api_key=self.api_key,
                model=self.model,
                temperature=0.7,
                max_tokens=2000,
            )
            logger.info(f"LangChain 智谱客户端初始化成功，模型: {self.model}")
        except Exception as e:
            logger.error(f"初始化 LangChain 智谱客户端失败: {str(e)}")
            raise

    def analyze_image(
        self,
        image_data: Union[str, bytes],
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> Dict:
        """
        使用 LangChain 分析图片

        Args:
            image_data: 图片路径或二进制数据
            prompt: 分析提示词
            model: 使用的模型（可选，默认使用初始化时的模型）
            temperature: 温度参数
            max_tokens: 最大输出token数
            **kwargs: 其他参数

        Returns:
            分析结果
        """
        try:
            # 如果指定了不同的模型，重新初始化客户端
            if model and model != self.model:
                temp_client = ChatZhipuAI(
                    api_key=self.api_key,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:
                temp_client = self.client

            # 处理图片数据
            image_base64 = self._encode_image(image_data)

            # 构造消息
            from langchain_core.messages import HumanMessage
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

            # 检查响应
            if hasattr(response, 'content'):
                content = response.content
                # 对于思考型模型，可能需要特殊处理
                logger.info(f"智谱AI原始响应类型: {type(content)}, 内容: {content}")

                # 如果是列表格式（某些思考模型的特殊响应）
                if isinstance(content, list):
                    # 提取实际的内容部分
                    actual_content = []
                    for item in content:
                        if hasattr(item, 'text'):
                            actual_content.append(item.text)
                        else:
                            actual_content.append(str(item))
                    content = ''.join(actual_content)
                    logger.info(f"智谱AI处理后的内容: {content[:200]}...")

                return {
                    "success": True,
                    "response": content,
                    "model_used": model or self.model,
                    "token_usage": getattr(response, 'usage_metadata', {}),
                }
            else:
                logger.error(f"响应格式异常: {response}")
                return {
                    "success": False,
                    "error": f"响应格式异常: {str(response)}",
                    "model_used": model or self.model,
                }

        except Exception as e:
            logger.error(f"LangChain 图片分析失败: {str(e)}")

            # 特殊处理429错误
            error_str = str(e)
            if '429' in error_str or 'Too Many Requests' in error_str:
                logger.warning(f"智谱API频率限制，建议稍后重试: {error_str}")
                # 返回特定的错误信息，让上层可以处理重试
                return {
                    "success": False,
                    "error": "API_RATE_LIMIT",
                    "model_used": model or self.model,
                }

            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
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
        max_tokens: int = 2000,
        **kwargs
    ) -> Dict:
        """
        文本对话补全

        Args:
            messages: 对话消息列表
            model: 使用的模型
            temperature: 温度参数
            max_tokens: 最大输出token数
            **kwargs: 其他参数

        Returns:
            对话结果
        """
        try:
            # 如果指定了不同的模型，重新初始化客户端
            if model and model != self.model:
                temp_client = ChatZhipuAI(
                    api_key=self.api_key,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            else:
                temp_client = self.client

            # 转换消息格式
            langchain_messages = []
            for msg in messages:
                if msg.get("role") == "user":
                    langchain_messages.append(HumanMessage(content=msg.get("content", "")))
                # 可以根据需要添加其他角色的处理

            # 调用模型
            response = temp_client.invoke(langchain_messages)

            # 检查响应
            if hasattr(response, 'content'):
                content = response.content
                # 对于思考型模型，可能需要特殊处理
                logger.info(f"智谱AI原始响应类型: {type(content)}, 内容: {content}")

                # 如果是列表格式（某些思考模型的特殊响应）
                if isinstance(content, list):
                    # 提取实际的内容部分
                    actual_content = []
                    for item in content:
                        if hasattr(item, 'text'):
                            actual_content.append(item.text)
                        else:
                            actual_content.append(str(item))
                    content = ''.join(actual_content)
                    logger.info(f"智谱AI处理后的内容: {content[:200]}...")

                return {
                    "success": True,
                    "response": content,
                    "model_used": model or self.model,
                    "token_usage": getattr(response, 'usage_metadata', {}),
                }
            else:
                logger.error(f"响应格式异常: {response}")
                return {
                    "success": False,
                    "error": f"响应格式异常: {str(response)}",
                    "model_used": model or self.model,
                }

        except Exception as e:
            logger.error(f"LangChain 对话失败: {str(e)}")
            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e),
                "model_used": model or self.model,
            }

    def _encode_image(self, image_data: Union[str, bytes]) -> str:
        """将图片编码为base64"""
        try:
            if isinstance(image_data, str):
                # 检查是否已经是base64编码
                # 如果字符串很长且只包含base64字符，可能是已经编码的数据
                if len(image_data) > 100 and all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in image_data):
                    # 可能已经是base64，直接返回
                    return image_data
                else:
                    # 否则当作文件路径处理
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
            # 发送一个简单的测试消息
            response = self.chat_completion([
                {"role": "user", "content": "测试连接，请回复OK"}
            ])
            return response.get("success", False)
        except Exception as e:
            logger.error(f"连接测试失败: {str(e)}")
            return False

    def get_models(self) -> List[Dict]:
        """
        获取可用模型列表
        智谱AI不提供动态模型列表API，返回预定义的模型
        """
        return self.get_available_models()

    def get_langchain_model(self, model_name: Optional[str] = None):
        """
        获取LangChain模型实例

        Args:
            model_name: 模型名称，如果为None则使用默认模型

        Returns:
            LangChain ChatModel实例
        """
        from langchain_community.chat_models import ChatZhipuAI

        return ChatZhipuAI(
            api_key=self.api_key,
            model=model_name or self.model,
            temperature=0.7,
            max_tokens=2000,
        )

    @staticmethod
    def get_available_models() -> List[Dict]:
        """获取支持的模型列表"""
        return [
            {
                "name": "glm-4.6v-flash",
                "display_name": "GLM-4.6V-Flash",
                "supports_vision": True,
                "description": "免费支持视觉理解的多模态模型"
            },
            {
                "name": "glm-4.5-flash",
                "display_name": "GLM-4.5-Flash",
                "supports_vision": False,
                "description": "快速文本生成模型"
            },
            {
                "name": "glm-4.1v-thinking-flash",
                "display_name": "GLM-4.1V-Thinking-Flash",
                "supports_vision": True,
                "description": "支持视觉思考和推理的多模态模型"
            },
        ]