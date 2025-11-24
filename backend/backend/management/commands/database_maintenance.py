"""
数据库维护管理命令
定期执行数据库健康检查和清理任务
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '执行数据库维护任务，包括健康检查和清理过期数据'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force-cleanup',
            action='store_true',
            help='强制执行清理任务',
        )
        parser.add_argument(
            '--health-check-only',
            action='store_true',
            help='仅执行健康检查，不进行清理',
        )

    def handle(self, *args, **options):
        """执行数据库维护任务"""
        self.stdout.write(self.style.SUCCESS('🚀 开始执行数据库维护任务...'))

        # 导入维护函数
        try:
            from llms.tasks import database_health_check, cleanup_stale_tasks
        except ImportError as e:
            self.stdout.write(self.style.ERROR(f'❌ 无法导入维护函数: {e}'))
            return

        # 执行健康检查
        self.stdout.write('📊 执行数据库健康检查...')
        if database_health_check():
            self.stdout.write(self.style.SUCCESS('✅ 数据库健康检查完成'))
        else:
            self.stdout.write(self.style.ERROR('❌ 数据库健康检查失败'))

        # 如果指定只执行健康检查，则跳过清理
        if options['health_check_only']:
            self.stdout.write(self.style.WARNING('⚠️ 仅执行健康检查，跳过清理任务'))
            return

        # 执行清理任务
        if options['force_cleanup']:
            self.stdout.write('🧹 强制执行清理任务...')
        else:
            self.stdout.write('🧹 执行清理任务...')

        if cleanup_stale_tasks():
            self.stdout.write(self.style.SUCCESS('✅ 清理任务完成'))
        else:
            self.stdout.write(self.style.ERROR('❌ 清理任务失败'))

        self.stdout.write(self.style.SUCCESS('🎉 数据库维护任务执行完成！'))