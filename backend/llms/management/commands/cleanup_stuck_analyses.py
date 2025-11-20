from django.core.management.base import BaseCommand
from django.utils import timezone
import datetime
from llms.models import AIAnalysis


class Command(BaseCommand):
    help = '清理超时的AI分析记录'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=10,
            help='超时分钟数（默认10分钟）'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='只显示将要清理的记录，不实际执行'
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        dry_run = options['dry_run']
        
        cutoff_time = timezone.now() - datetime.timedelta(minutes=minutes)
        stuck_analyses = AIAnalysis.objects.filter(
            status='processing',
            created_at__lt=cutoff_time
        )
        
        if stuck_analyses.exists():
            self.stdout.write(
                self.style.WARNING(
                    f'发现 {stuck_analyses.count()} 个超过 {minutes} 分钟仍在处理中的记录:'
                )
            )
            
            for analysis in stuck_analyses:
                duration = timezone.now() - analysis.created_at
                self.stdout.write(
                    f'  ID: {analysis.id}, Media: {analysis.media.id}, '
                    f'创建时间: {analysis.created_at}, 持续时间: {duration}'
                )
            
            if not dry_run:
                updated_count = stuck_analyses.update(
                    status='failed',
                    error_message=f'分析超时（超过{minutes}分钟），可能由于网络问题或服务不可用'
                )
                self.stdout.write(
                    self.style.SUCCESS(f'已将 {updated_count} 个记录标记为失败')
                )
            else:
                self.stdout.write(self.style.WARNING('DRY RUN: 未实际执行清理'))
        else:
            self.stdout.write(
                self.style.SUCCESS(f'没有发现超过 {minutes} 分钟的处理中记录')
            )
