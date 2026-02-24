from rest_framework.response import Response
from rest_framework import status
from typing import Any, Dict, Optional


class APIResponse(Response):
    """统一 API 响应格式"""

    def __init__(
        self,
        data: Any = None,
        code: int = status.HTTP_200_OK,
        message: str = "成功",
        **kwargs
    ):
        formatted_data = {
            "code": code,
            "message": message,
            "data": data,
        }
        super().__init__(formatted_data, status=code, **kwargs)


class SuccessResponse(APIResponse):
    """成功响应"""

    def __init__(self, data: Any = None, message: str = "成功", **kwargs):
        super().__init__(data, status.HTTP_200_OK, message, **kwargs)


class CreatedResponse(APIResponse):
    """创建成功响应"""

    def __init__(self, data: Any = None, message: str = "创建成功", **kwargs):
        super().__init__(data, status.HTTP_201_CREATED, message, **kwargs)


class NoContentResponse(APIResponse):
    """无内容响应"""

    def __init__(self, message: str = "删除成功", **kwargs):
        super().__init__(None, status.HTTP_204_NO_CONTENT, message, **kwargs)


class ErrorResponse(Response):
    """错误响应"""

    def __init__(
        self,
        message: str = "错误",
        code: int = status.HTTP_400_BAD_REQUEST,
        detail: Any = None,
        **kwargs
    ):
        formatted_data = {
            "code": code,
            "message": message,
        }
        if detail is not None:
            formatted_data["detail"] = detail
        super().__init__(formatted_data, status=code, **kwargs)


class BadRequestResponse(ErrorResponse):
    """400 错误"""

    def __init__(self, message: str = "请求参数错误", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, detail, **kwargs)


class UnauthorizedResponse(ErrorResponse):
    """401 错误"""

    def __init__(self, message: str = "未授权，请先登录", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, detail, **kwargs)


class ForbiddenResponse(ErrorResponse):
    """403 错误"""

    def __init__(self, message: str = "无权限访问", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_403_FORBIDDEN, detail, **kwargs)


class NotFoundResponse(ErrorResponse):
    """404 错误"""

    def __init__(self, message: str = "资源不存在", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_404_NOT_FOUND, detail, **kwargs)


class ValidationErrorResponse(ErrorResponse):
    """422 验证错误"""

    def __init__(self, message: str = "数据验证失败", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, detail, **kwargs)


class InternalErrorResponse(ErrorResponse):
    """500 错误"""

    def __init__(self, message: str = "服务器内部错误", detail: Any = None, **kwargs):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, detail, **kwargs)
