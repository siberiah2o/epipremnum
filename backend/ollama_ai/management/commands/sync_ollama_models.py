"""Django管理命令：同步Ollama模型"""

from django.core.management.base import BaseCommand, CommandError
from ollama_ai.utils import sync_ollama_models, create_sample_models


class Command(BaseCommand):
    help = '同步Ollama服务中的视觉模型到数据库'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-samples',
            action='store_true',
            help='创建示例模型（如果Ollama服务不可用）',
        )

    def handle(self, *args, **options):
        self.stdout.write('开始同步Ollama模型...')

        if options['create_samples']:
            # 创建示例模型
            count = create_sample_models()
            self.stdout.write(
                self.style.SUCCESS(f'成功创建 {count} 个示例模型')
            )
        else:
            # 从Ollama服务同步
            try:
                count = sync_ollama_models()
                self.stdout.write(
                    self.style.SUCCESS(f'成功同步 {count} 个视觉模型')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'同步失败: {str(e)}')
                )
                self.stdout.write(
                    self.style.WARNING('提示: 使用 --create-samples 创建示例模型')
                )

        self.stdout.write('同步完成！')