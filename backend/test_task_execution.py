#!/usr/bin/env python
"""
测试异步任务执行和状态更新
"""
import os
import sys
import django
import time

# 设置Django环境
sys.path.append('/root/dev/epipremnum/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from media.models import Media
from ollama.models import OllamaImageAnalysis, OllamaAIModel
from ollama.tasks.task_workers import analyze_image_task
from ollama.tasks.state_manager import state_manager
from django.contrib.auth import get_user_model
from django_async_manager.models import Task

def test_single_task():
    """测试单个任务执行"""
    print("=== 测试单个异步任务执行 ===")

    User = get_user_model()
    user = User.objects.first()
    print(f"User: {user.username}")

    media = Media.objects.filter(user=user).first()
    print(f"Media: {media.id} - {media.title or media.file.name}")

    model = OllamaAIModel.objects.filter(is_active=True, is_vision_capable=True).first()
    print(f"Model: {model.name}")

    # 使用状态管理器创建分析记录
    analysis, created = state_manager.create_analysis_safely(
        media=media,
        model=model,
        analysis_options={},
        prompt=None
    )

    print(f"Analysis: {analysis.id}, created={created}, status={analysis.status}")

    if not created:
        # 重置状态
        state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status=None,  # 从任何状态
            to_status='pending'
        )
        analysis.refresh_from_db()
        print(f"Reset analysis to: {analysis.status}")

    # 检查异步任务队列
    pending_count = Task.objects.filter(status='pending').count()
    print(f"Current pending async tasks: {pending_count}")

    # 启动异步任务
    print("🚀 Starting async task...")
    task = analyze_image_task.run_async(analysis_id=analysis.id)
    print(f"Async task started: {task.id}")

    # 实时监控
    print("\n实时监控状态变化:")
    for i in range(1, 16):  # 监控15秒
        time.sleep(1)
        try:
            analysis.refresh_from_db()
            task.refresh_from_db()
            print(f"{i:2d}s后 - Analysis: {analysis.status:10} | Task: {task.status:10}")

            if analysis.status == 'processing':
                print(f"     ✅ 成功! 任务已从pending转到processing状态")
                return True
            elif analysis.status in ['completed', 'failed', 'cancelled']:
                print(f"     ⚠️ 任务已结束，未观察到processing状态")
                return False

        except Exception as e:
            print(f"     错误: {e}")

    print(f"     ❌ 15秒后任务仍为pending状态，异步任务未执行")
    return False

def test_manual_status_update():
    """测试手动状态更新"""
    print("\n=== 测试手动状态更新 ===")

    # 获取一个分析记录
    analysis = OllamaImageAnalysis.objects.first()
    if not analysis:
        print("没有找到分析记录")
        return False

    print(f"测试分析记录: {analysis.id}, 当前状态: {analysis.status}")

    # 测试pending->processing转换
    if analysis.status != 'pending':
        success = state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status=None,
            to_status='pending'
        )
        if success:
            print(f"✅ 成功重置为pending状态")
        else:
            print(f"❌ 重置为pending状态失败")
            return False

    # 测试状态转换
    analysis.refresh_from_db()
    print(f"当前状态: {analysis.status}")

    success = state_manager.update_analysis_status(
        analysis_id=analysis.id,
        from_status='pending',
        to_status='processing'
    )

    analysis.refresh_from_db()
    if success and analysis.status == 'processing':
        print(f"✅ 手动状态更新成功: pending -> processing")

        # 恢复状态
        state_manager.update_analysis_status(
            analysis_id=analysis.id,
            from_status='processing',
            to_status='completed'
        )
        return True
    else:
        print(f"❌ 手动状态更新失败")
        return False

if __name__ == "__main__":
    # 测试手动状态更新
    manual_ok = test_manual_status_update()

    # 测试异步任务执行
    async_ok = test_single_task()

    print(f"\n=== 测试结果 ===")
    print(f"手动状态更新: {'✅ 成功' if manual_ok else '❌ 失败'}")
    print(f"异步任务执行: {'✅ 成功' if async_ok else '❌ 失败'}")

    if manual_ok and not async_ok:
        print("\n🔍 结论: 状态管理器工作正常，问题在于异步任务未执行或状态更新失败")
    elif not manual_ok and not async_ok:
        print("\n🔍 结论: 状态管理器存在问题")
    else:
        print("\n🔍 结论: 系统工作正常")