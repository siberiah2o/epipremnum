#!/usr/bin/env python
"""
获取长期有效的JWT token脚本
Get long-term JWT token script
"""

import os
import sys
import django
import requests

# 设置 Django 环境
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def get_long_term_token():
    """为lishaohao用户获取长期有效的token"""

    # 查找用户
    try:
        user = User.objects.get(email='lishaohao')
        print(f"找到用户: {user.username} (ID: {user.id})")
    except User.DoesNotExist:
        print("❌ 未找到lishaohao用户")
        return None

    # 如果你知道用户的密码，可以使用这种方式登录
    # 这里假设你需要通过API接口获取token
    login_url = "http://localhost:8000/api/auth/login/"

    login_data = {
        "email": "lishaohao",  # 或者使用完整的邮箱
        "password": "your_password_here"  # 请替换为实际密码
    }

    try:
        response = requests.post(login_url, json=login_data)

        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get('data', {}).get('access')
            refresh_token = token_data.get('data', {}).get('refresh')

            print("🎉 成功获取长期有效的Token!")
            print(f"Access Token: {access_token}")
            print(f"Refresh Token: {refresh_token}")
            print(f"Access Token 有效期: 30天")
            print(f"Refresh Token 有效期: 90天")

            return {
                'access': access_token,
                'refresh': refresh_token
            }
        else:
            print(f"❌ 登录失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return None

    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保Django服务器正在运行")
        print("启动命令: python manage.py runserver")
        return None
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        return None

if __name__ == "__main__":
    print("🔑 为lishaohao用户获取长期有效的JWT Token")
    print("=" * 50)

    # 检查Django服务器是否在运行
    try:
        response = requests.get("http://localhost:8000/api/", timeout=5)
        print("✅ Django服务器运行正常")
    except:
        print("❌ Django服务器未运行")
        print("请先启动Django服务器:")
        print("cd /root/dev/epipremnum/backend")
        print("python manage.py runserver")
        sys.exit(1)

    token_info = get_long_term_token()

    if token_info:
        print("\n" + "=" * 50)
        print("✅ Token获取成功!")
        print("现在你可以使用这个Bearer Token进行API调用:")
        print(f"Bearer {token_info['access']}")
    else:
        print("\n" + "=" * 50)
        print("❌ Token获取失败")
        print("请检查:")
        print("1. Django服务器是否运行")
        print("2. 用户邮箱和密码是否正确")
        print("3. API端点是否可访问")