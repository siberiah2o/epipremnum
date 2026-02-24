"""
API Key 加密服务

使用 Fernet 对称加密安全存储 API Keys
采用单例模式，避免重复创建加密器
"""

import base64
import hashlib
import logging
import re
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)


class DecryptionError(Exception):
    """解密错误异常"""
    pass


class EncryptionService:
    """
    加密服务（单例模式）

    使用 Django SECRET_KEY 派生加密密钥，确保密钥安全性

    使用方式:
        service = EncryptionService.get_instance()
        encrypted = service.encrypt("my-api-key")
        decrypted = service.decrypt(encrypted)
    """

    _instance = None
    _cipher: Fernet = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_cipher()
        return cls._instance

    @classmethod
    def get_instance(cls) -> 'EncryptionService':
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_cipher(self):
        """初始化加密器"""
        # 使用 SECRET_KEY 派生 Fernet 密钥
        # Fernet 需要 32 字节的 URL-safe base64 编码密钥
        key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        self._cipher = Fernet(base64.urlsafe_b64encode(key))

    def encrypt(self, plaintext: str) -> str:
        """
        加密字符串

        Args:
            plaintext: 明文字符串

        Returns:
            str: 加密后的字符串（Base64 编码）

        Note:
            - 空字符串返回空字符串
            - 已加密的字符串会直接返回
        """
        if not plaintext:
            return ""

        # 如果已经加密，直接返回
        if self.is_encrypted(plaintext):
            return plaintext

        try:
            encrypted = self._cipher.encrypt(plaintext.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"加密失败: {e}")
            raise

    def decrypt(self, ciphertext: str, strict: bool = False) -> str:
        """
        解密字符串

        Args:
            ciphertext: 加密后的字符串
            strict: 严格模式，为 True 时不允许明文数据（默认 False 以兼容旧数据）

        Returns:
            str: 解密后的明文

        Note:
            - 空字符串返回空字符串
            - 未加密的字符串（明文）在非严格模式下会返回原值并记录警告

        Raises:
            DecryptionError: 解密失败或严格模式下检测到明文数据
        """
        if not ciphertext:
            return ""

        # 检查是否已加密
        if not self.is_encrypted(ciphertext):
            if strict:
                logger.error("严格模式: 检测到未加密的 API Key，拒绝访问")
                raise DecryptionError("数据未加密，拒绝访问")
            # 兼容模式：可能是旧的明文数据，记录警告但返回原值
            logger.warning("检测到未加密的 API Key，建议在下次保存时自动加密")
            return ciphertext

        try:
            decrypted = self._cipher.decrypt(ciphertext.encode())
            return decrypted.decode()
        except InvalidToken:
            logger.error("解密失败: 无效的加密令牌")
            raise DecryptionError("数据解密失败")
        except Exception as e:
            logger.error(f"解密失败: {e}")
            raise DecryptionError("数据解密失败")

    def is_encrypted(self, value: str) -> bool:
        """
        判断字符串是否已加密

        Fernet 加密后的字符串特征:
        - 以 'gAAAAA' 开头（Fernet token 的特征前缀）
        - 只包含 URL-safe base64 字符

        Args:
            value: 待检测的字符串

        Returns:
            bool: 是否已加密
        """
        if not value:
            return False

        # Fernet token 总是以 'gAAAAA' 开头
        if not value.startswith('gAAAAA'):
            return False

        # 检查是否只包含有效的 base64 字符
        # Fernet 使用 URL-safe base64，字符集: A-Za-z0-9_-
        pattern = r'^[A-Za-z0-9_-]+$'
        return bool(re.match(pattern, value))

    def mask(self, value: str, visible_chars: int = 4) -> str:
        """
        脱敏显示字符串

        Args:
            value: 原始字符串
            visible_chars: 前后可见字符数

        Returns:
            str: 脱敏后的字符串
        """
        if not value:
            return ""

        # 先解密（如果已加密）
        try:
            plaintext = self.decrypt(value)
        except DecryptionError:
            plaintext = value

        if len(plaintext) <= visible_chars * 2:
            return "****"

        return f"{plaintext[:visible_chars]}...{plaintext[-visible_chars:]}"


# 为了向后兼容，保留函数式接口
def get_cipher() -> Fernet:
    """
    获取加密器实例（向后兼容）

    Deprecated: 请使用 EncryptionService.get_instance()
    """
    return EncryptionService.get_instance()._cipher


def encrypt_api_key(api_key: str) -> str:
    """
    加密 API Key（向后兼容）

    Deprecated: 请使用 EncryptionService.get_instance().encrypt()
    """
    return EncryptionService.get_instance().encrypt(api_key)


def decrypt_api_key(encrypted_key: str) -> str:
    """
    解密 API Key（向后兼容）

    Deprecated: 请使用 EncryptionService.get_instance().decrypt()
    """
    service = EncryptionService.get_instance()
    try:
        return service.decrypt(encrypted_key)
    except DecryptionError:
        # 向后兼容：解密失败返回原值（旧行为）
        return encrypted_key
