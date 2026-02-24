"""
Django Q2 Cluster 启动命令（支持优雅退出）

使用 ORM broker（数据库），无需 Redis/MQ
按 Ctrl+C 优雅退出，再按一次强制退出
"""

import os
import sys
import signal
import threading
from django.core.management.base import BaseCommand
from django_q.cluster import Cluster
from django_q.conf import Conf


class Command(BaseCommand):
    help = 'Starts Django Q2 Cluster with graceful shutdown support'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('启动 Django Q2 Cluster (ORM Broker)'))
        self.stdout.write('按 Ctrl+C 停止，再按一次强制退出')

        cluster_instance = None
        stop_requested = False
        force_exit_timer = None

        def force_exit():
            """2秒后强制退出"""
            self.stdout.write(self.style.ERROR('强制退出...'))
            os._exit(1)

        def signal_handler(signum, frame):
            """处理 SIGINT/SIGTERM 信号"""
            nonlocal stop_requested, force_exit_timer

            if stop_requested:
                self.stdout.write(self.style.ERROR('\n收到第二次中断信号，立即退出'))
                os._exit(1)

            stop_requested = True
            self.stdout.write(self.style.WARNING('\n正在停止 Q Cluster...'))
            
            # 设置2秒强制退出定时器
            force_exit_timer = threading.Timer(2.0, force_exit)
            force_exit_timer.daemon = True
            force_exit_timer.start()

            # 停止集群
            if cluster_instance:
                try:
                    cluster_instance.stop()
                    cluster_instance.sentinel = 0
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'停止时出错: {e}'))

            # 取消定时器
            if force_exit_timer and force_exit_timer.is_alive():
                force_exit_timer.cancel()
            
            self.stdout.write(self.style.SUCCESS('Q Cluster 已停止'))
            sys.exit(0)

        # 注册信号处理器
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        try:
            # 启动集群（自动使用配置中的 ORM broker）
            cluster_instance = Cluster()
            cluster_instance.start()
        except KeyboardInterrupt:
            signal_handler(signal.SIGINT, None)
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'启动失败: {e}'))
            import traceback
            traceback.print_exc()
            sys.exit(1)
