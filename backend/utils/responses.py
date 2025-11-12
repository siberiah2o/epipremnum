"""
响应工具函数
Response utility functions for consistent API responses
"""

from rest_framework.response import Response
from rest_framework import status
from typing import Any, Optional, Dict


def success_response(
    data: Any = None,
    message: str = "操作成功",
    status_code: int = status.HTTP_200_OK
) -> Response:
    """
    返回成功响应

    Args:
        data: 返回的数据
        message: 成功消息
        status_code: HTTP状态码

    Returns:
        Response: 标准格式的成功响应
    """
    response_data = {
        'code': status_code,
        'message': message,
        'data': data
    }
    return Response(response_data, status=status_code)


def error_response(
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    data: Any = None
) -> Response:
    """
    返回错误响应

    Args:
        message: 错误消息
        status_code: HTTP状态码
        data: 错误详情数据

    Returns:
        Response: 标准格式的错误响应
    """
    response_data = {
        'code': status_code,
        'message': message,
        'data': data
    }
    return Response(response_data, status=status_code)


def validation_error_response(
    errors: Dict[str, Any],
    message: str = "数据验证失败"
) -> Response:
    """
    返回验证错误响应

    Args:
        errors: 字段验证错误详情
        message: 错误消息

    Returns:
        Response: 验证错误响应
    """
    return error_response(
        message=message,
        status_code=status.HTTP_400_BAD_REQUEST,
        data=errors
    )


def not_found_response(
    resource: str = "资源",
    message: Optional[str] = None
) -> Response:
    """
    返回未找到响应

    Args:
        resource: 资源名称
        message: 自定义错误消息

    Returns:
        Response: 未找到响应
    """
    if message is None:
        message = f"{resource}不存在"

    return error_response(
        message=message,
        status_code=status.HTTP_404_NOT_FOUND
    )


def unauthorized_response(
    message: str = "未进行身份验证"
) -> Response:
    """
    返回未授权响应

    Args:
        message: 错误消息

    Returns:
        Response: 未授权响应
    """
    return error_response(
        message=message,
        status_code=status.HTTP_401_UNAUTHORIZED
    )


def forbidden_response(
    message: str = "权限不足"
) -> Response:
    """
    返回禁止访问响应

    Args:
        message: 错误消息

    Returns:
        Response: 禁止访问响应
    """
    return error_response(
        message=message,
        status_code=status.HTTP_403_FORBIDDEN
    )


def conflict_response(
    message: str = "资源冲突"
) -> Response:
    """
    返回冲突响应

    Args:
        message: 错误消息

    Returns:
        Response: 冲突响应
    """
    return error_response(
        message=message,
        status_code=status.HTTP_409_CONFLICT
    )


def server_error_response(
    message: str = "服务器内部错误"
) -> Response:
    """
    返回服务器错误响应

    Args:
        message: 错误消息

    Returns:
        Response: 服务器错误响应
    """
    return error_response(
        message=message,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def paginated_response(
    data: list,
    count: int,
    page: int = 1,
    page_size: int = 10,
    message: str = "获取数据成功"
) -> Response:
    """
    返回分页响应

    Args:
        data: 数据列表
        count: 总数量
        page: 当前页码
        page_size: 每页数量
        message: 成功消息

    Returns:
        Response: 分页响应
    """
    response_data = {
        'results': data,
        'count': count,
        'page': page,
        'page_size': page_size,
        'total_pages': (count + page_size - 1) // page_size
    }

    return success_response(
        data=response_data,
        message=message
    )