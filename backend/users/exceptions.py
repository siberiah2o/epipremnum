import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.db import IntegrityError
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    PermissionDenied,
    NotAuthenticated,
    ValidationError,
    NotFound
)

from .constants import ErrorMessages

# 配置日志记录器
logger = logging.getLogger(__name__)


class BusinessException(APIException):
    """业务逻辑异常基类"""

    def __init__(self, message=None, code=None, status_code=status.HTTP_400_BAD_REQUEST):
        self.message = message or ErrorMessages.OPERATION_FAILED
        self.code = code or status_code
        self.status_code = status_code
        super().__init__(detail=self.message)


class UserNotFoundException(BusinessException):
    """用户不存在异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.USER_NOT_FOUND,
            code=status.HTTP_404_NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND
        )


class UserAlreadyExistsException(BusinessException):
    """用户已存在异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.USER_ALREADY_EXISTS,
            code=status.HTTP_409_CONFLICT,
            status_code=status.HTTP_409_CONFLICT
        )


class EmailAlreadyExistsException(BusinessException):
    """邮箱已存在异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.EMAIL_ALREADY_EXISTS,
            code=status.HTTP_409_CONFLICT,
            status_code=status.HTTP_409_CONFLICT
        )


class InvalidCredentialsException(BusinessException):
    """无效凭据异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.INVALID_CREDENTIALS,
            code=status.HTTP_401_UNAUTHORIZED,
            status_code=status.HTTP_401_UNAUTHORIZED
        )


class TokenInvalidException(BusinessException):
    """令牌无效异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.TOKEN_INVALID,
            code=status.HTTP_401_UNAUTHORIZED,
            status_code=status.HTTP_401_UNAUTHORIZED
        )


class FileOperationException(BusinessException):
    """文件操作异常基类"""

    def __init__(self, message=None, operation=None, status_code=status.HTTP_400_BAD_REQUEST):
        if operation and not message:
            message = f"{operation}失败"
        super().__init__(message=message, status_code=status_code)


class FileNotFoundException(FileOperationException):
    """文件不存在异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.FILE_NOT_FOUND,
            operation="文件查找",
            status_code=status.HTTP_404_NOT_FOUND
        )


class FileUploadException(FileOperationException):
    """文件上传异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.FILE_UPLOAD_FAILED,
            operation="文件上传",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class FolderNotFoundException(FileOperationException):
    """文件夹不存在异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.FOLDER_NOT_FOUND,
            operation="文件夹查找",
            status_code=status.HTTP_404_NOT_FOUND
        )


class PermissionDeniedException(BusinessException):
    """权限拒绝异常"""

    def __init__(self, message=None):
        super().__init__(
            message=message or ErrorMessages.NO_PERMISSION,
            code=status.HTTP_403_FORBIDDEN,
            status_code=status.HTTP_403_FORBIDDEN
        )


def custom_exception_handler(exc, context):
    """
    自定义异常处理器，统一返回格式
    添加日志记录和更详细的错误信息
    """
    # 获取请求信息用于日志记录
    request = context.get('request')
    view = context.get('view')

    # 记录异常信息
    log_data = {
        'exception_type': type(exc).__name__,
        'exception_message': str(exc),
        'view_name': view.__class__.__name__ if view else 'Unknown',
        'request_method': request.method if request else 'Unknown',
        'request_path': request.path if request else 'Unknown',
        'user_id': request.user.id if request and hasattr(request, 'user') and request.user.is_authenticated else 'Anonymous'
    }

    # 优先处理自定义业务异常
    if isinstance(exc, BusinessException):
        custom_response_data = {
            'code': getattr(exc, 'code', exc.status_code),
            'message': exc.message,
            'data': None
        }

        # 记录警告级别的日志（业务逻辑错误）
        logger.warning(
            f"Business Error: {log_data['exception_type']} - {exc.message} "
            f"in {log_data['view_name']} for {log_data['request_method']} {log_data['request_path']} "
            f"by user {log_data['user_id']}",
            extra=log_data
        )

        return Response(custom_response_data, status=exc.status_code)

    # 处理 Django Http404 异常
    if isinstance(exc, Http404):
        custom_response_data = {
            'code': status.HTTP_404_NOT_FOUND,
            'message': ErrorMessages.NOT_FOUND,
            'data': None
        }

        # 记录警告级别的日志（404错误）
        logger.warning(
            f"Not Found: Resource not found in {log_data['view_name']} "
            f"for {log_data['request_method']} {log_data['request_path']} "
            f"by user {log_data['user_id']}",
            extra=log_data
        )

        return Response(custom_response_data, status=status.HTTP_404_NOT_FOUND)

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
                log_data['validation_errors'] = exc.detail
            # 如果是非字段错误
            else:
                custom_response_data['message'] = str(exc.detail) if exc.detail else ErrorMessages.VALIDATION_FAILED

        # 记录警告级别的日志（客户端错误）
        logger.warning(
            f"API Error: {log_data['exception_type']} - {log_data['exception_message']} "
            f"in {log_data['view_name']} for {log_data['request_method']} {log_data['request_path']} "
            f"by user {log_data['user_id']}",
            extra=log_data
        )

        response.data = custom_response_data

    # 处理数据库IntegrityError
    elif isinstance(exc, IntegrityError):
        custom_response_data = {
            'code': status.HTTP_400_BAD_REQUEST,
            'message': get_error_message(exc),
            'data': None
        }

        # 记录警告级别的日志（客户端错误）
        logger.warning(
            f"Database Integrity Error: {log_data['exception_type']} - {log_data['exception_message']} "
            f"in {log_data['view_name']} for {log_data['request_method']} {log_data['request_path']} "
            f"by user {log_data['user_id']}",
            extra=log_data
        )

        response = Response(custom_response_data, status=status.HTTP_400_BAD_REQUEST)

    # 处理其他未捕获的异常
    else:
        custom_response_data = {
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'message': ErrorMessages.INTERNAL_SERVER_ERROR,
            'data': None
        }

        # 记录错误级别的日志（服务器错误）
        logger.error(
            f"Internal Server Error: {log_data['exception_type']} - {log_data['exception_message']} "
            f"in {log_data['view_name']} for {log_data['request_method']} {log_data['request_path']} "
            f"by user {log_data['user_id']}",
            extra=log_data,
            exc_info=True  # 记录完整的堆栈跟踪
        )

        response = Response(custom_response_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


def get_error_message(exc):
    """
    根据异常类型返回相应的错误消息
    使用 ErrorMessages 常量确保一致性
    """
    if isinstance(exc, AuthenticationFailed):
        return ErrorMessages.AUTH_FAILED
    elif isinstance(exc, NotAuthenticated):
        return ErrorMessages.UNAUTHORIZED
    elif isinstance(exc, PermissionDenied):
        return ErrorMessages.FORBIDDEN
    elif isinstance(exc, NotFound):
        return ErrorMessages.NOT_FOUND
    elif isinstance(exc, ValidationError):
        return ErrorMessages.VALIDATION_FAILED
    elif isinstance(exc, IntegrityError):
        # 处理数据库唯一约束错误
        if 'UNIQUE constraint failed' in str(exc):
            if 'ollama_ollamaendpoint' in str(exc):
                return '该端点URL已经存在，请使用其他URL'
            return '数据已存在，违反唯一性约束'
        return '数据完整性错误'
    elif isinstance(exc, APIException):
        return exc.default_detail or ErrorMessages.REQUEST_FAILED
    else:
        return ErrorMessages.INTERNAL_SERVER_ERROR