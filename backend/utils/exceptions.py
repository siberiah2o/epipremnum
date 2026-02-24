"""
公共异常类

提供统一的异常处理
"""

from rest_framework.exceptions import APIException
from rest_framework import status


class BusinessException(APIException):
    """
    业务异常基类

    所有业务异常都应继承此类
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = '业务错误'
    default_code = 'business_error'

    def __init__(self, detail=None, code=None, status_code=None):
        if detail is not None:
            self.default_detail = detail
        if code is not None:
            self.default_code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.default_detail)


class ResourceNotFound(BusinessException):
    """资源不存在"""

    status_code = status.HTTP_404_NOT_FOUND
    default_detail = '资源不存在'
    default_code = 'resource_not_found'


class PermissionDenied(BusinessException):
    """权限不足"""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = '权限不足'
    default_code = 'permission_denied'


class ValidationError(BusinessException):
    """验证错误"""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = '数据验证失败'
    default_code = 'validation_error'


class DuplicateError(BusinessException):
    """重复错误"""

    status_code = status.HTTP_409_CONFLICT
    default_detail = '资源已存在'
    default_code = 'duplicate_error'


class RateLimitExceeded(BusinessException):
    """频率限制"""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = '请求过于频繁'
    default_code = 'rate_limit_exceeded'


# ============================================================
# 以下为兼容旧代码的异常处理器
# ============================================================

from django.conf import settings
from rest_framework.views import exception_handler
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    自定义异常处理器

    统一异常响应格式:
    {
        "code": 400,
        "message": "错误信息",
        "detail": {...}  # 可选
    }
    """
    # 调用 DRF 默认异常处理器
    response = exception_handler(exc, context)

    if response is not None:
        # 自定义错误响应格式
        custom_response_data = {
            'code': response.status_code,
            'message': get_custom_message(response.status_code),
            'detail': response.data,
        }
        response.data = custom_response_data
    else:
        # 处理非 API 异常
        logger.error(f"Unhandled exception: {exc}")
        custom_response_data = {
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'message': '服务器内部错误',
            'detail': str(exc) if settings.DEBUG else None,
        }
        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


def get_custom_message(status_code: int) -> str:
    """根据状态码返回中文消息"""
    messages = {
        200: '成功',
        201: '创建成功',
        204: '删除成功',
        400: '请求参数错误',
        401: '未授权，请先登录',
        403: '无权限访问',
        404: '资源不存在',
        405: '请求方法不允许',
        409: '资源冲突',
        422: '数据验证失败',
        429: '请求过于频繁',
        500: '服务器内部错误',
        502: '网关错误',
        503: '服务暂不可用',
    }
    return messages.get(status_code, '未知错误')
