"""
标记所有worker任务为失败的管理命令
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '将所有当前运行中的worker任务标记为失败状态'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='强制标记所有任务为失败，包括pending和processing状态的任务',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅显示将要标记为失败的任务数量，不实际执行操作',
        )

    def handle(self, *args, **options):
        """执行标记所有任务为失败的操作"""
        self.stdout.write(self.style.SUCCESS('🚀 开始标记所有worker任务为失败...'))

        try:
            from ollama.models import OllamaImageAnalysis
            from django_async_manager.models import Task

            # 查询所有正在运行的任务（pending和processing状态）
            running_analyses = OllamaImageAnalysis.objects.filter(
                status__in=['pending', 'processing']
            ).select_related('media', 'model')

            total_count = running_analyses.count()

            if total_count == 0:
                self.stdout.write(self.style.WARNING('⚠️ 没有找到正在运行的任务'))
                return

            self.stdout.write(f'📊 找到 {total_count} 个正在运行的任务')

            # 如果是dry-run，只显示信息
            if options['dry_run']:
                self.stdout.write(self.style.WARNING('⚠️ DRY RUN模式 - 不会实际修改任务状态'))

                # 按状态统计
                status_counts = {}
                for analysis in running_analyses:
                    status_counts[analysis.status] = status_counts.get(analysis.status, 0) + 1

                for status, count in status_counts.items():
                    self.stdout.write(f'   {status}: {count} 个任务')

                self.stdout.write(self.style.WARNING(f'总共将标记 {total_count} 个任务为失败'))
                return

            # 确认操作
            if not options['force']:
                confirm = input(f'确认要将所有 {total_count} 个运行中的任务标记为失败吗？[y/N]: ')
                if confirm.lower() != 'y':
                    self.stdout.write(self.style.WARNING('⚠️ 操作已取消'))
                    return

            # 批量标记OllamaImageAnalysis任务为失败
            failed_count = 0
            error_count = 0

            self.stdout.write('🔄 开始标记分析任务为失败...')

            for analysis in running_analyses:
                try:
                    # 取消关联的异步任务（如果存在）
                    if analysis.task_id:
                        try:
                            task = Task.objects.get(id=analysis.task_id)
                            if task.status in ['pending', 'in_progress']:
                                task.status = 'failed'
                                task.last_errors = ['任务被管理员手动标记为失败']
                                task.completed_at = timezone.now()
                                task.save()
                                logger.info(f"✅ 异步任务已标记为失败: task_id={analysis.task_id}")
                        except Task.DoesNotExist:
                            logger.warning(f"⚠️ 异步任务不存在: task_id={analysis.task_id}")
                        except Exception as e:
                            logger.error(f"❌ 更新异步任务状态失败: task_id={analysis.task_id}, error={str(e)}")

                    # 更新分析任务状态
                    analysis.status = 'failed'
                    analysis.error_message = '任务被管理员手动标记为失败'
                    analysis.completed_at = timezone.now()
                    analysis.save(update_fields=['status', 'error_message', 'completed_at'])

                    failed_count += 1
                    logger.info(f"✅ 分析任务已标记为失败: analysis_id={analysis.id}, media_id={analysis.media.id}")

                except Exception as e:
                    error_count += 1
                    logger.error(f"❌ 标记分析任务失败: analysis_id={analysis.id}, error={str(e)}")

            # 清理并发控制器中的活跃线程
            try:
                from workflow.concurrency_manager import concurrency_manager
                active_info = concurrency_controller.get_active_tasks_info()
                total_active_tasks = active_info.get('total_active_tasks', 0)
                global_active_threads = active_info.get('global_active_threads', 0)

                if total_active_tasks > 0 or global_active_threads > 0:
                    logger.info(f"📊 发现活跃任务: total_tasks={total_active_tasks}, threads={global_active_threads}")

                    # 取消所有活跃任务
                    cancelled_count = 0
                    for user_id in active_info.get('user_task_counts', {}).keys():
                        result = concurrency_controller.cancel_user_tasks(user_id)
                        cancelled_count += result.get('cancelled_count', 0)

                    logger.info(f"✅ 已清理 {cancelled_count} 个活跃任务记录")

            except Exception as e:
                logger.error(f"❌ 清理并发控制器失败: {str(e)}")

            # 停止所有相关的后台任务
            try:
                from django_async_manager import get_background_task
                from django_async_manager.models import Task as AsyncTask

                # 获取所有相关的后台任务
                # 使用新的批量处理器架构来查找任务
                from workflow.batch_handler import batch_handler

                try:
                    # 直接查找所有可能的分析任务
                    background_tasks = AsyncTask.objects.filter(
                        status__in=['pending', 'in_progress']
                    ).filter(
                        Q(name__contains='analyze_images') |
                        Q(name__contains='analysis') |
                        Q(name__contains='ollama') |
                        Q(name__contains='batch_processor')
                    )
                except Exception as e:
                    logger.warning(f"⚠️ 查找后台任务时出错: {str(e)}")
                    # 如果查找失败，返回空列表
                    background_tasks = AsyncTask.objects.none()

                stopped_tasks = 0
                for task in background_tasks:
                    try:
                        task.status = 'failed'
                        task.last_errors = ['任务被管理员手动停止']
                        task.completed_at = timezone.now()
                        task.save()
                        stopped_tasks += 1
                        logger.info(f"✅ 后台任务已停止: task_id={task.id}")
                    except Exception as e:
                        logger.error(f"❌ 停止后台任务失败: task_id={task.id}, error={str(e)}")

                if stopped_tasks > 0:
                    logger.info(f"✅ 已停止 {stopped_tasks} 个后台任务")

            except Exception as e:
                logger.error(f"❌ 停止后台任务失败: {str(e)}")

            # 强制垃圾回收，清理可能残留的异步任务引用
            try:
                import gc
                gc.collect()
                logger.info("✅ 已执行垃圾回收")
            except Exception as e:
                logger.error(f"❌ 垃圾回收失败: {str(e)}")

            # 输出结果
            self.stdout.write(self.style.SUCCESS(f'✅ 成功标记 {failed_count} 个任务为失败'))
            if error_count > 0:
                self.stdout.write(self.style.ERROR(f'❌ {error_count} 个任务标记失败'))

            self.stdout.write(self.style.SUCCESS('🎉 所有worker任务标记失败操作完成！'))

        except ImportError as e:
            self.stdout.write(self.style.ERROR(f'❌ 无法导入必要的模块: {e}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ 执行过程中发生错误: {str(e)}'))
            logger.exception("标记所有任务为失败时发生异常")