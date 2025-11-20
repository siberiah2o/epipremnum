"""
创建默认 Ollama 端点
"""
from django.db import migrations
from django.conf import settings


def create_default_ollama_endpoint(apps, schema_editor):
    """
    创建默认的 Ollama 端点
    """
    OllamaEndpoint = apps.get_model('llms', 'OllamaEndpoint')

    try:
        User = apps.get_model('users', 'User')
        user = User.objects.first()
    except LookupError:
        # 如果 users 应用不存在，跳过创建
        print("警告：users 应用不存在，无法创建默认端点")
        return
    except Exception:
        # 如果获取用户失败，跳过创建
        print("警告：无法获取用户，跳过创建默认端点")
        return

    if not user:
        print("警告：没有找到用户，无法创建默认端点")
        return

    # 创建默认端点
    endpoint, created = OllamaEndpoint.objects.get_or_create(
        name='默认Ollama端点',
        defaults={
            'url': 'http://115.190.140.100:31434',
            'description': '默认的Ollama服务端点',
            'is_active': True,
            'is_default': True,
            'timeout': 300,
            'created_by': user
        }
    )

    if created:
        print(f"✓ 创建默认Ollama端点: {endpoint.name}")
    else:
        print(f"✓ 默认Ollama端点已存在: {endpoint.name}")


def remove_default_ollama_endpoint(apps, schema_editor):
    """
    删除默认的 Ollama 端点
    """
    OllamaEndpoint = apps.get_model('llms', 'OllamaEndpoint')

    # 删除默认端点
    endpoints = OllamaEndpoint.objects.filter(name='默认Ollama端点')
    count = endpoints.count()
    endpoints.delete()

    if count > 0:
        print(f"✓ 删除了 {count} 个默认Ollama端点")


class Migration(migrations.Migration):

    dependencies = [
        ('llms', '0003_aianalysis_applied_to_media_aianalysis_task_id_and_more'),
    ]

    operations = [
        migrations.RunPython(
            create_default_ollama_endpoint,
            remove_default_ollama_endpoint,
        ),
    ]