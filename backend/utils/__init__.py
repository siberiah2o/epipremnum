"""
公共工具模块

提供统一的响应、分页、视图基类、异常处理等
"""

from .responses import (
    APIResponse,
    SuccessResponse,
    CreatedResponse,
    NoContentResponse,
    ErrorResponse,
    BadRequestResponse,
    UnauthorizedResponse,
    ForbiddenResponse,
    NotFoundResponse,
    ValidationErrorResponse,
    InternalErrorResponse,
)

from .pagination import (
    StandardPagination,
    LargePagination,
    SmallPagination,
)

from .viewsets import (
    ReadOnlyModelMixin,
    CreateModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    BaseModelViewSet,
    ReadOnlyViewSet,
)

from .exceptions import (
    BusinessException,
    ResourceNotFound,
    PermissionDenied,
    ValidationError,
    DuplicateError,
    RateLimitExceeded,
    custom_exception_handler,
)

__all__ = [
    # 响应
    'APIResponse',
    'SuccessResponse',
    'CreatedResponse',
    'NoContentResponse',
    'ErrorResponse',
    'BadRequestResponse',
    'UnauthorizedResponse',
    'ForbiddenResponse',
    'NotFoundResponse',
    'ValidationErrorResponse',
    'InternalErrorResponse',
    # 分页
    'StandardPagination',
    'LargePagination',
    'SmallPagination',
    # ViewSet
    'ReadOnlyModelMixin',
    'CreateModelMixin',
    'UpdateModelMixin',
    'DestroyModelMixin',
    'BaseModelViewSet',
    'ReadOnlyViewSet',
    # 异常
    'BusinessException',
    'ResourceNotFound',
    'PermissionDenied',
    'ValidationError',
    'DuplicateError',
    'RateLimitExceeded',
    'custom_exception_handler',
]
