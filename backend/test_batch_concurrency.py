#!/usr/bin/env python
"""
批量分析并发控制测试和示例
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/root/dev/epipremnum/backend')
django.setup()

from ollama.views.analysis import AnalysisBatchHandler
from django.http import HttpRequest
from django.contrib.auth.models import User
from unittest.mock import Mock, MagicMock
import json


def create_mock_request(user_id=1, data=None):
    """创建模拟请求"""
    request = Mock(spec=HttpRequest)
    request.user = Mock(spec=User)
    request.user.id = user_id
    request.data = data or {}
    return request


def test_batch_analysis_with_concurrency():
    """测试批量分析并发控制功能"""
    print("=== 批量分析并发控制测试 ===")
    print()

    # 测试用例
    test_cases = [
        {
            'name': '启用并发控制（自定义并发数）',
            'data': {
                "media_ids": [150, 149, 148, 147, 146],
                "model_name": "qwen3-vl:2b-instruct-bf16",
                "options": {
                    "generate_title": True,
                    "generate_description": True,
                    "generate_categories": True,
                    "generate_tags": True,
                    "max_categories": 3,
                    "max_tags": 8,
                    "use_concurrency": True,
                    "max_concurrent": 3
                }
            }
        },
        {
            'name': '启用并发控制（使用默认并发数）',
            'data': {
                "media_ids": [145, 144, 143],
                "model_name": "qwen3-vl:2b-instruct-bf16",
                "options": {
                    "generate_title": True,
                    "generate_description": True,
                    "generate_tags": True,
                    "use_concurrency": True
                }
            }
        },
        {
            'name': '禁用并发控制（串行模式）',
            'data': {
                "media_ids": [142, 141, 140],
                "model_name": "qwen3-vl:2b-instruct-bf16",
                "options": {
                    "generate_title": True,
                    "generate_description": True,
                    "generate_tags": True,
                    "use_concurrency": False
                }
            }
        },
        {
            'name': '无效并发数（超出限制）',
            'data': {
                "media_ids": [139, 138],
                "model_name": "qwen3-vl:2b-instruct-bf16",
                "options": {
                    "generate_title": True,
                    "generate_description": True,
                    "use_concurrency": True,
                    "max_concurrent": 25  # 超出1-20的限制
                }
            }
        },
        {
            'name': '无效并发模式（类型错误）',
            'data': {
                "media_ids": [137, 136],
                "model_name": "qwen3-vl:2b-instruct-bf16",
                "options": {
                    "generate_title": True,
                    "generate_description": True,
                    "use_concurrency": "yes"  # 应该是布尔值
                }
            }
        }
    ]

    # 模拟ViewSet实例
    mock_viewset = Mock()

    for i, test_case in enumerate(test_cases, 1):
        print(f"测试 {i}: {test_case['name']}")
        print("-" * 50)

        # 创建模拟请求
        request = create_mock_request(user_id=1, data=test_case['data'])
        mock_viewset.request = request

        # 创建批量分析处理器
        handler = AnalysisBatchHandler(mock_viewset)

        # 测试参数验证
        options = test_case['data'].get('options', {})
        errors = handler._validate_concurrency_options(options)

        if errors:
            print(f"❌ 验证失败: {errors}")
        else:
            print("✅ 参数验证通过")

        # 显示请求参数
        print(f"媒体ID数量: {len(test_case['data']['media_ids'])}")
        print(f"模型名称: {test_case['data']['model_name']}")
        print(f"并发设置:")

        if 'use_concurrency' in options:
            print(f"  - 启用并发: {options['use_concurrency']}")

        if 'max_concurrent' in options:
            print(f"  - 最大并发数: {options['max_concurrent']}")
        elif options.get('use_concurrency', False):
            print(f"  - 最大并发数: 默认值 (3)")

        print(f"分析选项:")
        for key, value in options.items():
            if key not in ['use_concurrency', 'max_concurrent']:
                print(f"  - {key}: {value}")

        print()

    print("=== 使用示例 ===")
    print()

    # 提供实际使用的cURL示例
    examples = [
        {
            'name': '高并发批量分析（适合高性能服务器）',
            'curl': '''curl -X POST "http://192.168.55.133:8888/api/ollama/analyze/batch_analyze/" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "media_ids": [150, 149, 148, 147, 146, 145, 144, 143, 142, 141],
    "model_name": "qwen3-vl:2b-instruct-bf16",
    "options": {
      "generate_title": true,
      "generate_description": true,
      "generate_categories": true,
      "generate_tags": true,
      "max_categories": 3,
      "max_tags": 8,
      "use_concurrency": true,
      "max_concurrent": 5
    }
  }' '''
        },
        {
            'name': '中等并发批量分析（平衡性能和资源）',
            'curl': '''curl -X POST "http://192.168.55.133:8888/api/ollama/analyze/batch_analyze/" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "media_ids": [150, 149, 148, 147, 146],
    "model_name": "qwen3-vl:2b-instruct-bf16",
    "options": {
      "generate_title": true,
      "generate_description": true,
      "generate_tags": true,
      "max_tags": 5,
      "use_concurrency": true,
      "max_concurrent": 3
    }
  }' '''
        },
        {
            'name': '串行批量分析（稳定但较慢）',
            'curl': '''curl -X POST "http://192.168.55.133:8888/api/ollama/analyze/batch_analyze/" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "media_ids": [150, 149, 148, 147, 146],
    "model_name": "qwen3-vl:2b-instruct-bf16",
    "options": {
      "generate_title": true,
      "generate_description": true,
      "generate_tags": true,
      "use_concurrency": false
    }
  }' '''
        }
    ]

    for example in examples:
        print(f"📋 {example['name']}:")
        print(example['curl'])
        print()

    print("=== 参数说明 ===")
    print("""
📝 新增的并发控制参数:

1. use_concurrency (boolean)
   - true: 启用并发执行模式
   - false: 使用串行执行模式（默认）
   - 只有设置为true时才会并发执行

2. max_concurrent (integer, 1-20)
   - 设置单个用户的最大并发数
   - 范围: 1-20
   - 如果不设置且启用并发，将使用系统默认值

3. 系统配置:
   - 默认并发数: 3
   - 全局最大并发数: 10
   - 单次批量最多: 20个文件

🚀 性能建议:
- 小模型/低性能服务器: max_concurrent = 1-3
- 中等性能服务器: max_concurrent = 3-5
- 高性能服务器: max_concurrent = 5-10
- 根据Ollama服务器性能和网络情况调整
""")


if __name__ == "__main__":
    test_batch_analysis_with_concurrency()