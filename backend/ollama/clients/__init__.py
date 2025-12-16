"""
AI客户端模块
提供统一接口来访问不同的AI模型供应商
"""

# LangChain 客户端
from .langchain_ollama_client import LangChainOllamaClient
from .langchain_zhipu_client import LangChainZhipuClient

# 客户端工厂
from .client_factory import ClientFactory

# 添加更多客户端
# from .openai_client import OpenAIClient
# from .ollama_client import OllamaClient