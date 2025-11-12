from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    PermissionDenied,
    NotAuthenticated,
    ValidationError,
    NotFound
)


def custom_exception_handler(exc, context):
    """
    自定义异常处理器，统一返回格式
    """
    # 调用 DRF 默认的异常处理器
    response = exception_handler(exc, context)

    # 如果响应已经存在，说明是 DRF 标准异常
    if response is not None:
        # 自定义错误响应格式
        custom_response_data = {
            'code': response.status_code,
            'message': get_error_message(exc),
            'data': None
        }

        # 对于验证错误，保留详细的字段错误信息
        if isinstance(exc, ValidationError):
            # 如果是字段验证错误
            if hasattr(exc, 'detail') and isinstance(exc.detail, dict):
                custom_response_data['data'] = exc.detail
            # 如果是非字段错误
            else:
                custom_response_data['message'] = str(exc.detail) if exc.detail else '验证失败'

        response.data = custom_response_data

    # 处理 Django Http404 异常
    elif isinstance(exc, Http404):
        custom_response_data = {
            'code': status.HTTP_404_NOT_FOUND,
            'message': '请求的资源不存在',
            'data': None
        }
        response = Response(custom_response_data, status=status.HTTP_404_NOT_FOUND)

    # 处理其他未捕获的异常
    else:
        custom_response_data = {
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'message': '服务器内部错误',
            'data': None
        }
        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


def get_error_message(exc):
    """
    根据异常类型返回相应的错误消息
    """
    if isinstance(exc, AuthenticationFailed):
        return '认证失败'
    elif isinstance(exc, NotAuthenticated):
        return '未进行身份验证'
    elif isinstance(exc, PermissionDenied):
        return '权限不足'
    elif isinstance(exc, NotFound):
        return '请求的资源不存在'
    elif isinstance(exc, ValidationError):
        return '数据验证失败'
    elif isinstance(exc, APIException):
        return exc.default_detail or '请求失败'
    else:
        return '服务器错误'