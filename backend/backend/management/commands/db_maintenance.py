"""
数据库维护管理命令
提供数据库健康检查、优化和修复功能
"""

import sys
import time
import logging
from django.core.management.base import BaseCommand
from utils.db_utils import (
    get_comprehensive_db_stats,
    optimize_sqlite_connection,
    check_database_health,
    cleanup_database,
    health_monitor,
    connection_pool,
    SQLiteBulkWriter
)

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = '数据库维护和健康检查'

    def add_arguments(self, parser):
        parser.add_argument(
            '--action',
            type=str,
            choices=['health', 'optimize', 'cleanup', 'stats', 'monitor', 'repair'],
            default='health',
            help='要执行的维护操作'
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=300,
            help='监控模式下的检查间隔（秒）'
        )
        parser.add_argument(
            '--daemon',
            action='store_true',
            help='以守护进程模式运行监控'
        )

    def handle(self, *args, **options):
        action = options['action']
        interval = options['interval']
        daemon = options['daemon']

        self.stdout.write(
            self.style.SUCCESS(f'🚀 开始执行数据库维护操作: {action}')
        )

        if action == 'health':
            self._check_health()
        elif action == 'optimize':
            self._optimize_database()
        elif action == 'cleanup':
            self._cleanup_database()
        elif action == 'stats':
            self._show_stats()
        elif action == 'monitor':
            if daemon:
                self._start_monitoring_daemon(interval)
            else:
                self._run_monitoring_cycle(interval)
        elif action == 'repair':
            self._repair_database()

    def _check_health(self):
        """检查数据库健康状态"""
        self.stdout.write('📊 检查数据库健康状态...')
        
        health_ok = check_database_health()
        
        if health_ok:
            self.stdout.write(
                self.style.SUCCESS('✅ 数据库健康状态良好')
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️ 数据库存在健康问题')
            )

    def _optimize_database(self):
        """优化数据库连接"""
        self.stdout.write('🔧 优化数据库连接...')
        
        try:
            optimize_sqlite_connection()
            self.stdout.write(
                self.style.SUCCESS('✅ 数据库优化完成')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 数据库优化失败: {e}')
            )

    def _cleanup_database(self):
        """清理数据库"""
        self.stdout.write('🧹 清理数据库...')
        
        try:
            cleanup_database()
            self.stdout.write(
                self.style.SUCCESS('✅ 数据库清理完成')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 数据库清理失败: {e}')
            )

    def _show_stats(self):
        """显示数据库统计信息"""
        self.stdout.write('📈 获取数据库统计信息...')
        
        try:
            stats = get_comprehensive_db_stats()
            
            # 显示连接统计
            conn_stats = stats.get('connection_stats', {})
            self.stdout.write('\n📊 连接统计:')
            for key, value in conn_stats.items():
                if isinstance(value, dict):
                    self.stdout.write(f'  {key}:')
                    for k, v in value.items():
                        self.stdout.write(f'    {k}: {v}')
                else:
                    self.stdout.write(f'  {key}: {value}')

            # 显示连接池统计
            pool_stats = stats.get('pool_stats', {})
            self.stdout.write('\n🏊 连接池统计:')
            for key, value in pool_stats.items():
                self.stdout.write(f'  {key}: {value}')

            # 显示健康报告
            health_report = stats.get('health_report', {})
            self.stdout.write('\n🏥 健康报告:')
            self.stdout.write(f'  健康分数: {health_report.get("health_score", 0)}/100')
            issues = health_report.get('issues', [])
            if issues:
                self.stdout.write('  发现问题:')
                for issue in issues:
                    self.stdout.write(f'    - {issue}')
            else:
                self.stdout.write('  未发现问题')

            # 显示批量写入统计
            bulk_stats = stats.get('bulk_writer_stats', {})
            if bulk_stats:
                self.stdout.write('\n📝 批量写入统计:')
                for key, value in bulk_stats.items():
                    self.stdout.write(f'  {key}: {value}')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 获取统计信息失败: {e}')
            )

    def _repair_database(self):
        """修复数据库问题"""
        self.stdout.write('🔧 开始数据库修复...')
        
        try:
            # 1. 优化连接
            self.stdout.write('  1. 优化数据库连接...')
            optimize_sqlite_connection()
            
            # 2. 执行清理
            self.stdout.write('  2. 清理数据库...')
            cleanup_database()
            
            # 3. 检查健康状态
            self.stdout.write('  3. 检查健康状态...')
            health_ok = check_database_health()
            
            if health_ok:
                self.stdout.write(
                    self.style.SUCCESS('✅ 数据库修复完成')
                )
            else:
                self.stdout.write(
                    self.style.WARNING('⚠️ 数据库仍存在问题，建议重启应用')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 数据库修复失败: {e}')
            )

    def _start_monitoring_daemon(self, interval):
        """启动监控守护进程"""
        self.stdout.write(f'🕷️ 启动数据库健康监控守护进程 (间隔: {interval}s)')
        
        try:
            health_monitor.check_interval = interval
            health_monitor.start_monitoring()
            
            self.stdout.write(
                self.style.SUCCESS('✅ 监控守护进程已启动')
            )
            self.stdout.write('按 Ctrl+C 停止监控...')
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stdout.write('\n🛑 停止监控守护进程...')
                health_monitor.stop_monitoring()
                self.stdout.write(
                    self.style.SUCCESS('✅ 监控守护进程已停止')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 启动监控守护进程失败: {e}')
            )

    def _run_monitoring_cycle(self, interval):
        """运行监控周期"""
        self.stdout.write(f'🔄 运行数据库健康监控周期 (间隔: {interval}s)')
        
        try:
            for i in range(5):  # 运行5个周期
                self.stdout.write(f'\n📊 第 {i+1}/5 个监控周期:')
                self._show_stats()
                time.sleep(interval)
            
            self.stdout.write(
                self.style.SUCCESS('✅ 监控周期完成')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ 监控周期失败: {e}')
            )