"""
错误消息常量定义
Error message constants definition
"""

class ErrorMessages:
    """错误消息常量类"""

    # 通用错误 (General Errors)
    INTERNAL_SERVER_ERROR = "服务器内部错误"
    BAD_REQUEST = "请求参数错误"
    UNAUTHORIZED = "未进行身份验证"
    FORBIDDEN = "权限不足"
    NOT_FOUND = "请求的资源不存在"
    VALIDATION_FAILED = "数据验证失败"
    REQUEST_FAILED = "请求失败"

    # 认证相关错误 (Authentication Errors)
    AUTH_FAILED = "认证失败"
    INVALID_CREDENTIALS = "用户名或密码错误"
    TOKEN_INVALID = "令牌无效或已过期"
    TOKEN_BLACKLISTED = "令牌已被列入黑名单"
    LOGOUT_FAILED = "退出登录失败"
    TOKEN_REFRESH_FAILED = "令牌刷新失败"

    # 用户相关错误 (User Errors)
    USER_NOT_FOUND = "用户不存在"
    USER_ALREADY_EXISTS = "用户已存在"
    EMAIL_ALREADY_EXISTS = "该邮箱已被注册"
    USERNAME_ALREADY_EXISTS = "该用户名已被使用"
    PASSWORD_TOO_WEAK = "密码强度不够"
    PASSWORD_INCORRECT = "密码错误"

    # 媒体文件相关错误 (Media File Errors)
    FILE_NOT_FOUND = "文件不存在"
    FILE_UPLOAD_FAILED = "文件上传失败"
    FILE_TYPE_NOT_SUPPORTED = "不支持的文件类型"
    FILE_TOO_LARGE = "文件大小超出限制"
    FOLDER_NOT_FOUND = "文件夹不存在"
    FOLDER_CREATE_FAILED = "文件夹创建失败"
    FOLDER_DELETE_FAILED = "文件夹删除失败"
    FOLDER_ALREADY_EXISTS = "文件夹已存在"
    FILE_DELETE_FAILED = "文件删除失败"
    FILE_MOVE_FAILED = "文件移动失败"
    FILE_COPY_FAILED = "文件复制失败"

    # 权限相关错误 (Permission Errors)
    NO_PERMISSION = "没有操作权限"
    ACCESS_DENIED = "访问被拒绝"
    OPERATION_NOT_ALLOWED = "不允许的操作"

    # 数据库相关错误 (Database Errors)
    DATABASE_ERROR = "数据库操作失败"
    DATA_INTEGRITY_ERROR = "数据完整性错误"
    DUPLICATE_ENTRY = "数据重复"

    # 网络相关错误 (Network Errors)
    NETWORK_ERROR = "网络连接错误"
    TIMEOUT_ERROR = "请求超时"

    # 业务逻辑错误 (Business Logic Errors)
    OPERATION_FAILED = "操作失败"
    RESOURCE_LIMIT_EXCEEDED = "资源使用超出限制"
    INVALID_OPERATION = "无效的操作"

    @classmethod
    def get_validation_error(cls, field=None):
        """获取字段验证错误消息"""
        if field:
            return f"{field}验证失败"
        return cls.VALIDATION_FAILED

    @classmethod
    def get_not_found_error(cls, resource):
        """获取资源未找到错误消息"""
        return f"{resource}不存在"

    @classmethod
    def get_already_exists_error(cls, resource):
        """获取资源已存在错误消息"""
        return f"{resource}已存在"