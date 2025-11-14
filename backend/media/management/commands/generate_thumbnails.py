from django.core.management.base import BaseCommand
from django.db import models
from media.models import Media


class Command(BaseCommand):
    help = '为现有的媒体文件生成缩略图'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='覆盖已存在的缩略图',
        )

    def handle(self, *args, **options):
        overwrite = options['overwrite']

        # 查询所有需要生成缩略图的媒体文件
        if overwrite:
            media_files = Media.objects.all()
            self.stdout.write('为所有媒体文件生成缩略图（包括已有缩略图的）...')
        else:
            # 检查 thumbnail 字段是否为空
            media_files = Media.objects.filter(
                models.Q(thumbnail__isnull=True) | models.Q(thumbnail='')
            )
            self.stdout.write('为没有缩略图的媒体文件生成缩略图...')

        total_count = media_files.count()
        if total_count == 0:
            self.stdout.write(self.style.SUCCESS('没有需要处理的媒体文件'))
            return

        success_count = 0
        error_count = 0

        for i, media in enumerate(media_files, 1):
            try:
                self.stdout.write(f'处理 ({i}/{total_count}): {media.title or media.file.name}')

                # 生成缩略图 - 直接调用方法不触发信号
                media.generate_thumbnail()
                # 只更新缩略图字段，不触发 save 信号
                Media.objects.filter(pk=media.pk).update(thumbnail=media.thumbnail)

                self.stdout.write(f'✓ 成功生成缩略图: {media.title}')
                success_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'✗ 生成缩略图失败 {media.title}: {str(e)}')
                )
                error_count += 1

        # 输出结果统计
        self.stdout.write('\n' + '='*50)
        self.stdout.write(f'处理完成！')
        self.stdout.write(f'总计: {total_count} 个文件')
        self.stdout.write(self.style.SUCCESS(f'成功: {success_count} 个文件'))
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'失败: {error_count} 个文件'))
        self.stdout.write('='*50)