"""
强制停止所有图片分析相关的进程
停止worker进程、清理数据库状态、取消后台任务
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
import logging
import subprocess
import signal
import os
import time

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '强制停止所有图片分析进程和任务'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='强制停止所有进程，不询问确认',
        )
        parser.add_argument(
            '--kill-workers',
            action='store_true',
            help='强制杀死所有worker进程',
        )

    def handle(self, *args, **options):
        """执行强制停止操作"""
        self.stdout.write(self.style.WARNING('🛑 开始强制停止所有图片分析进程...'))

        if not options['force']:
            confirm = input('确认要强制停止所有图片分析进程吗？这将终止所有正在运行的任务。[y/N]: ')
            if confirm.lower() != 'y':
                self.stdout.write(self.style.WARNING('⚠️ 操作已取消'))
                return

        try:
            # 1. 停止所有数据库任务
            self.stdout.write('🔄 步骤1: 停止数据库中的分析任务...')
            self._stop_database_tasks()

            # 2. 停止后台异步任务
            self.stdout.write('🔄 步骤2: 停止后台异步任务...')
            self._stop_background_tasks()

            # 3. 杀死worker进程（如果指定）
            if options['kill_workers']:
                self.stdout.write('🔄 步骤3: 杀死worker进程...')
                self._kill_worker_processes()

            # 4. 清理并发控制器状态
            self.stdout.write('🔄 步骤4: 清理并发控制器状态...')
            self._clean_concurrency_controller()

            # 5. 强制垃圾回收
            self.stdout.write('🔄 步骤5: 执行系统清理...')
            self._system_cleanup()

            self.stdout.write(self.style.SUCCESS('✅ 所有图片分析进程已强制停止！'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 执行过程中发生错误: {str(e)}'))
            logger.exception("强制停止进程时发生异常")

    def _stop_database_tasks(self):
        """停止数据库中的所有分析任务"""
        try:
            from ollama.models import OllamaImageAnalysis
            from django_async_manager.models import Task as AsyncTask

            # 停止所有分析任务
            running_analyses = OllamaImageAnalysis.objects.filter(
                status__in=['pending', 'processing']
            )

            count = running_analyses.count()
            if count > 0:
                running_analyses.update(
                    status='failed',
                    error_message='任务被管理员强制停止',
                    completed_at=timezone.now()
                )
                self.stdout.write(f'  ✅ 已停止 {count} 个分析任务')

            # 停止所有相关后台任务
            # 注意：现在使用新的批量处理器架构，通过用户ID来管理任务
            from ollama.tasks.batch_handler import batch_handler

            # 获取所有活跃用户的任务信息
            try:
                active_info = batch_handler.get_global_batch_status()
                active_user_ids = set(active_info['user_task_stats'].keys())

                # AsyncTask模型也没有user_id字段，通过任务名称过滤
                background_tasks = AsyncTask.objects.filter(
                    status__in=['pending', 'in_progress']
                ).filter(
                    Q(name__contains='analyze_images') |
                    Q(name__contains='analysis') |
                    Q(name__contains='ollama')
                )
            except:
                # 如果获取批量状态失败，则查找所有可能的分析任务
                background_tasks = AsyncTask.objects.filter(
                    status__in=['pending', 'in_progress']
                ).filter(
                    Q(name__contains='analyze_images') |
                    Q(name__contains='analysis') |
                    Q(name__contains='ollama')
                )

            bg_count = background_tasks.count()
            if bg_count > 0:
                background_tasks.update(
                    status='failed',
                    last_errors=['任务被管理员强制停止'],
                    completed_at=timezone.now()
                )
                self.stdout.write(f'  ✅ 已停止 {bg_count} 个后台任务')

        except Exception as e:
            self.stdout.write(f'  ❌ 停止数据库任务失败: {str(e)}')

    def _stop_background_tasks(self):
        """停止后台异步任务管理器中的任务"""
        try:
            # 尝试停止django_async_manager的任务调度器
            # 注意：这取决于具体的django_async_manager实现
            try:
                from django_async_manager import get_background_task
                background_task = get_background_task()

                # 如果有停止方法，调用它
                if hasattr(background_task, 'stop_scheduler'):
                    background_task.stop_scheduler()
                    self.stdout.write('  ✅ 已停止后台任务调度器')

            except ImportError:
                pass  # django_async_manager不可用
            except Exception as e:
                logger.warning(f"停止后台任务调度器失败: {str(e)}")

        except Exception as e:
            self.stdout.write(f'  ❌ 停止后台任务失败: {str(e)}')

    def _kill_worker_processes(self):
        """强制杀死所有worker进程"""
        try:
            # 查找所有manage.py run_worker进程
            result = subprocess.run(
                ['ps', 'aux'],
                capture_output=True,
                text=True
            )

            killed_count = 0
            for line in result.stdout.split('\n'):
                if 'manage.py run_worker' in line and 'grep' not in line:
                    try:
                        pid = int(line.split()[1])
                        os.kill(pid, signal.SIGTERM)
                        killed_count += 1
                        self.stdout.write(f'  ✅ 已发送SIGTERM到worker进程 {pid}')
                    except (ValueError, ProcessLookupError, PermissionError):
                        continue

            if killed_count > 0:
                # 等待进程优雅退出
                time.sleep(2)

                # 强制杀死仍在运行的进程
                for line in result.stdout.split('\n'):
                    if 'manage.py run_worker' in line and 'grep' not in line:
                        try:
                            pid = int(line.split()[1])
                            os.kill(pid, signal.SIGKILL)
                            self.stdout.write(f'  ⚠️ 已强制杀死worker进程 {pid}')
                        except (ValueError, ProcessLookupError, PermissionError):
                            continue

            else:
                self.stdout.write('  ℹ️ 未发现运行中的worker进程')

        except Exception as e:
            self.stdout.write(f'  ❌ 杀死worker进程失败: {str(e)}')

    def _clean_concurrency_controller(self):
        """清理并发控制器状态"""
        try:
            from ollama.tasks.concurrency_manager import concurrency_manager

            # 清理所有状态
            if hasattr(concurrency_manager, 'active_threads'):
                concurrency_manager.active_threads.clear()
            if hasattr(concurrency_manager, 'user_semaphores'):
                concurrency_manager.user_semaphores.clear()
            if hasattr(concurrency_manager, '_cancel_flags'):
                concurrency_manager._cancel_flags.clear()

            self.stdout.write('  ✅ 已清理并发控制器状态')

        except Exception as e:
            self.stdout.write(f'  ❌ 清理并发控制器失败: {str(e)}')

    def _system_cleanup(self):
        """执行系统清理"""
        try:
            import gc
            gc.collect()
            self.stdout.write('  ✅ 已执行垃圾回收')

        except Exception as e:
            self.stdout.write(f'  ❌ 系统清理失败: {str(e)}')