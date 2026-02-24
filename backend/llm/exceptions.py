"""
LLM 模块自定义异常

提供统一的异常类型和错误分类功能
"""

import requests
from typing import Type
from .models import ErrorType


class LLMException(Exception):
    """
    LLM 模块基础异常

    所有 LLM 相关异常的基类，提供统一的错误类型映射
    """

    error_type: str = ErrorType.UNKNOWN
    default_message: str = "LLM 服务错误"

    def __init__(self, message: str = None, details: dict = None):
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            'error_type': self.error_type,
            'message': self.message,
            'details': self.details,
        }


class NetworkError(LLMException):
    """网络连接错误"""

    error_type = ErrorType.NETWORK
    default_message = "网络连接失败"


class TimeoutError(LLMException):
    """请求超时错误"""

    error_type = ErrorType.TIMEOUT
    default_message = "请求超时"


class RateLimitError(LLMException):
    """API 频率限制错误"""

    error_type = ErrorType.RATE_LIMIT
    default_message = "API 请求频率超限"


class PermissionError(LLMException):
    """权限错误（认证失败或授权不足）"""

    error_type = ErrorType.PERMISSION
    default_message = "权限不足或认证失败"


class APIError(LLMException):
    """API 服务端错误"""

    error_type = ErrorType.API
    default_message = "API 服务错误"


class ValidationError(LLMException):
    """数据验证错误"""

    error_type = ErrorType.VALIDATION
    default_message = "数据验证失败"


class MediaNotFoundError(LLMException):
    """媒体文件不存在"""

    error_type = ErrorType.VALIDATION
    default_message = "媒体文件不存在或无权访问"


class ModelNotFoundError(LLMException):
    """模型不存在"""

    error_type = ErrorType.VALIDATION
    default_message = "模型不存在或无权访问"


class AnalysisAlreadyExistsError(LLMException):
    """分析任务已存在"""

    error_type = ErrorType.VALIDATION
    default_message = "该媒体已有待处理的分析任务"


class FileReadError(LLMException):
    """文件读取错误"""

    error_type = ErrorType.VALIDATION
    default_message = "文件读取失败"


class DecryptionError(LLMException):
    """解密错误"""

    error_type = ErrorType.VALIDATION
    default_message = "数据解密失败"


# 异常映射表：Python 异常 -> LLM 异常
_EXCEPTION_MAP: dict[Type[Exception], Type[LLMException]] = {
    requests.exceptions.Timeout: TimeoutError,
    requests.exceptions.ConnectionError: NetworkError,
}


def classify_exception(exc: Exception) -> str:
    """
    将异常分类为错误类型字符串

    Args:
        exc: 原始异常

    Returns:
        str: 错误类型（对应 ErrorType 的值）
    """
    # 如果已经是 LLMException，直接返回其 error_type
    if isinstance(exc, LLMException):
        return exc.error_type

    # 处理 HTTP 错误
    if isinstance(exc, requests.exceptions.HTTPError):
        if exc.response is not None:
            status_code = exc.response.status_code
            if status_code == 429:
                return ErrorType.RATE_LIMIT
            elif status_code in (401, 403):
                return ErrorType.PERMISSION
        return ErrorType.API

    # 处理 requests 异常
    for py_exc, llm_exc in _EXCEPTION_MAP.items():
        if isinstance(exc, py_exc):
            return llm_exc.error_type

    # 处理 ValueError
    if isinstance(exc, ValueError):
        return ErrorType.VALIDATION

    # 默认返回未知错误
    return ErrorType.UNKNOWN


def convert_exception(exc: Exception, message: str = None) -> LLMException:
    """
    将原始异常转换为 LLMException

    Args:
        exc: 原始异常
        message: 自定义错误消息（可选）

    Returns:
        LLMException: 转换后的异常
    """
    # 如果已经是 LLMException，直接返回
    if isinstance(exc, LLMException):
        return exc

    # 获取错误类型
    error_type = classify_exception(exc)

    # 根据 error_type 创建对应的异常
    llm_exc_class = {
        ErrorType.NETWORK: NetworkError,
        ErrorType.TIMEOUT: TimeoutError,
        ErrorType.RATE_LIMIT: RateLimitError,
        ErrorType.PERMISSION: PermissionError,
        ErrorType.API: APIError,
        ErrorType.VALIDATION: ValidationError,
    }.get(error_type, LLMException)

    return llm_exc_class(
        message=message or str(exc),
        details={'original_exception': type(exc).__name__}
    )
