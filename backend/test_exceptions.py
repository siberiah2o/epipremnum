#!/usr/bin/env python
"""
测试异常处理系统的脚本
Test script for exception handling system
"""

import os
import sys
import django

# 设置 Django 环境
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.exceptions import (
    BusinessException,
    FileNotFoundException,
    FileUploadException,
    custom_exception_handler
)
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from rest_framework.views import APIView


def test_custom_exception():
    """测试自定义异常处理"""
    print("🧪 测试自定义异常处理...")

    # 创建模拟请求和上下文
    factory = APIRequestFactory()
    django_request = factory.post('/test/')
    request = Request(django_request)

    # 创建模拟视图
    view = APIView()
    context = {'request': request, 'view': view}

    # 测试 FileNotFoundException
    try:
        exc = FileNotFoundException("测试文件不存在")
        response = custom_exception_handler(exc, context)

        print(f"✅ FileNotFoundException 处理成功:")
        print(f"   状态码: {response.status_code}")
        print(f"   响应数据: {response.data}")
        print()

        assert response.status_code == 404
        assert response.data['code'] == 404
        assert response.data['message'] == "测试文件不存在"

    except Exception as e:
        print(f"❌ FileNotFoundException 处理失败: {e}")
        return False

    # 测试 FileUploadException
    try:
        exc = FileUploadException("测试文件上传失败")
        response = custom_exception_handler(exc, context)

        print(f"✅ FileUploadException 处理成功:")
        print(f"   状态码: {response.status_code}")
        print(f"   响应数据: {response.data}")
        print()

        assert response.status_code == 400
        assert response.data['code'] == 400
        assert response.data['message'] == "测试文件上传失败"

    except Exception as e:
        print(f"❌ FileUploadException 处理失败: {e}")
        return False

    # 测试默认消息的 FileNotFoundException
    try:
        exc = FileNotFoundException()  # 使用默认消息
        response = custom_exception_handler(exc, context)

        print(f"✅ 默认消息的 FileNotFoundException 处理成功:")
        print(f"   状态码: {response.status_code}")
        print(f"   响应数据: {response.data}")
        print()

        assert response.status_code == 404
        assert response.data['code'] == 404
        assert response.data['message'] is not None

    except Exception as e:
        print(f"❌ 默认消息的 FileNotFoundException 处理失败: {e}")
        return False

    print("🎉 所有自定义异常测试通过！")
    return True


def test_error_messages():
    """测试错误消息常量"""
    print("🧪 测试错误消息常量...")

    from users.constants import ErrorMessages

    # 测试一些常用的错误消息
    messages = [
        ErrorMessages.FILE_NOT_FOUND,
        ErrorMessages.FILE_UPLOAD_FAILED,
        ErrorMessages.EMAIL_ALREADY_EXISTS,
        ErrorMessages.INVALID_CREDENTIALS,
        ErrorMessages.TOKEN_INVALID,
    ]

    for message in messages:
        print(f"   - {message}")

    print("✅ 错误消息常量测试通过！")
    print()
    return True


def test_response_utilities():
    """测试响应工具函数"""
    print("🧪 测试响应工具函数...")

    from utils.responses import (
        success_response,
        error_response,
        not_found_response,
    )

    # 测试成功响应
    response = success_response(data={"test": "data"}, message="测试成功")
    print(f"✅ success_response: {response.data}")

    # 测试错误响应
    response = error_response(message="测试错误", status_code=400)
    print(f"✅ error_response: {response.data}")

    # 测试未找到响应
    response = not_found_response(resource="测试资源")
    print(f"✅ not_found_response: {response.data}")

    print("✅ 响应工具函数测试通过！")
    print()
    return True


if __name__ == "__main__":
    print("🚀 开始测试异常处理系统...")
    print("=" * 50)

    success = True

    # 测试错误消息常量
    success &= test_error_messages()

    # 测试响应工具函数
    success &= test_response_utilities()

    # 测试自定义异常处理
    success &= test_custom_exception()

    print("=" * 50)
    if success:
        print("🎉 所有测试都通过了！异常处理系统工作正常。")
    else:
        print("❌ 有测试失败，请检查异常处理系统。")

    sys.exit(0 if success else 1)