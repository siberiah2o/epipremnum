"""
恢复卡住的分析任务

检查所有 pending 状态的分析记录，为没有对应 Django Q 任务的记录创建任务
"""

from django.core.management.base import BaseCommand
from django_q.models import Task
from django_q.tasks import async_task

from llm.models import ImageAnalysis
from llm.tasks import execute_analysis_task


class Command(BaseCommand):
    help = '恢复卡住的 pending 分析任务'

    def handle(self, *args, **options):
        # 获取所有 pending 状态的分析
        pending_analyses = ImageAnalysis.objects.filter(status='pending')
        total = pending_analyses.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS('没有 pending 状态的分析任务'))
            return

        self.stdout.write(f'找到 {total} 个 pending 状态的分析任务')

        recovered = 0
        skipped = 0

        for analysis in pending_analyses:
            # 检查是否有最近创建的相关任务
            recent_tasks = Task.objects.filter(
                func='llm.tasks.execute_analysis_task'
            ).filter(
                started__isnull=True
            ).order_by('-id')[:10]

            # 检查这些任务的参数是否包含当前分析 ID
            has_task = False
            for task in recent_tasks:
                if task.args and str(analysis.id) in task.args:
                    has_task = True
                    break

            if has_task:
                self.stdout.write(f'跳过分析 {analysis.id}: 已有对应的任务')
                skipped += 1
                continue

            # 创建异步任务
            try:
                task_id = async_task(
                    execute_analysis_task,
                    analysis.id,
                    save=True
                )
                recovered += 1
                self.stdout.write(self.style.SUCCESS(f'恢复分析 {analysis.id}: 任务 {task_id} 已创建'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'恢复分析 {analysis.id} 失败: {str(e)}'))

        self.stdout.write(self.style.SUCCESS(f'\n恢复完成: {recovered} 个任务已创建, {skipped} 个已跳过'))
