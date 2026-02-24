"""
Django management command: 为现有媒体文件生成 hash
使用方法: python manage.py generate_file_hashes
"""

from django.core.management.base import BaseCommand
from media.models import Media


class Command(BaseCommand):
    help = '为所有没有 file_hash 的图片生成 SHA256 哈希'

    def handle(self, *args, **options):
        # 获取所有没有 file_hash 的图片
        queryset = Media.objects.filter(file_hash__isnull=True)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('所有图片都已有 hash 值'))
            return

        self.stdout.write(f'开始处理 {total} 张图片...')

        success_count = 0
        failed_count = 0
        duplicate_count = 0

        for media in queryset:
            try:
                # 计算 hash
                file_hash = Media.calculate_file_hash(media.file.path)

                # 检查是否有重复（同用户）
                duplicate = Media.objects.filter(
                    owner=media.owner,
                    file_hash=file_hash
                ).exclude(id=media.id).first()

                if duplicate:
                    # 发现重复，删除当前记录
                    self.stdout.write(
                        self.style.WARNING(f'  ⊗ {media.filename} 与 {duplicate.filename} 重复，已删除')
                    )
                    media.delete()
                    duplicate_count += 1
                else:
                    # 保存 hash
                    media.file_hash = file_hash
                    media.save(update_fields=['file_hash'])
                    success_count += 1
                    self.stdout.write(f'  ✓ {media.filename} -> {file_hash[:16]}...')

            except Exception as e:
                failed_count += 1
                self.stdout.write(
                    self.style.ERROR(f'  ✗ {media.filename}: {str(e)}'),
                    ending='\n'
                )

        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS(
            f'完成！成功: {success_count}, 重复删除: {duplicate_count}, 失败: {failed_count}'
        ))
