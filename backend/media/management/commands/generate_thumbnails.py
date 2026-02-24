"""
Django management command: 为现有媒体文件生成缩略图
使用方法: python manage.py generate_thumbnails
"""

from django.core.management.base import BaseCommand
from media.models import Media
from media.serializers import generate_thumbnail


class Command(BaseCommand):
    help = '为所有没有缩略图的图片生成缩略图'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            dest='overwrite',
            help='覆盖已存在的缩略图',
        )

    def handle(self, *args, **options):
        overwrite = options.get('overwrite', False)

        # 获取所有图片类型的媒体文件
        queryset = Media.objects.filter(type='image')

        if not overwrite:
            # 只处理没有缩略图的
            queryset = queryset.filter(thumbnail__isnull=True)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('没有需要处理的图片'))
            return

        self.stdout.write(f'开始处理 {total} 张图片...')

        success_count = 0
        failed_count = 0

        for media in queryset:
            try:
                if overwrite and media.thumbnail:
                    # 删除旧缩略图
                    media.thumbnail.delete(save=False)

                # 生成新缩略图
                thumbnail = generate_thumbnail(media.file)
                media.thumbnail.save(thumbnail.name, thumbnail, save=True)

                success_count += 1
                self.stdout.write(f'  ✓ {media.filename}', ending='\n')
            except Exception as e:
                failed_count += 1
                self.stdout.write(
                    self.style.ERROR(f'  ✗ {media.filename}: {str(e)}'),
                    ending='\n'
                )

        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS(f'完成！成功: {success_count}, 失败: {failed_count}'))
