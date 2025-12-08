import os
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.files import File
from io import BytesIO
from PIL import Image
import tempfile

User = get_user_model()


def user_media_path(instance, filename):
    """
    生成用户媒体文件的存储路径
    格式: media/images/{user_id}/{year}/{month}/{uuid}_{ext} 或 media/videos/{user_id}/{year}/{month}/{uuid}_{ext}
    """
    now = timezone.now()
    file_type = 'images' if instance.file_type == 'image' else 'videos'

    # 生成唯一的文件名
    file_extension = os.path.splitext(filename)[1]  # 获取文件扩展名
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"  # 使用UUID生成唯一文件名

    return os.path.join(
        file_type,
        str(instance.user.id),
        str(now.year),
        str(now.month),
        unique_filename
    )


def thumbnail_path(instance, filename):
    """
    生成缩略图的存储路径
    格式: media/{file_type}/{user_id}/{year}/{month}/thumbnails/{uuid}_{ext}
    """
    now = timezone.now()

    # 生成唯一的缩略图文件名
    file_extension = os.path.splitext(filename)[1]  # 获取文件扩展名
    unique_filename = f"{uuid.uuid4().hex}{file_extension}"  # 使用UUID生成唯一文件名

    # 根据媒体文件类型选择目录
    file_type = 'images' if instance.file_type == 'image' else 'videos'

    return os.path.join(
        file_type,
        str(instance.user.id),
        str(now.year),
        str(now.month),
        'thumbnails',
        unique_filename
    )


class Category(models.Model):
    """媒体内容分类模型"""
    name = models.CharField(max_length=100, verbose_name='分类名称')
    description = models.TextField(blank=True, null=True, verbose_name='分类描述')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_categories', verbose_name='创建者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        unique_together = ['user', 'name']  # 同一用户下分类名称唯一

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Tag(models.Model):
    """媒体内容标签模型"""
    name = models.CharField(max_length=50, verbose_name='标签名称')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_tags', verbose_name='创建者')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '标签'
        verbose_name_plural = '标签'
        unique_together = ['user', 'name']  # 同一用户下标签名称唯一

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Media(models.Model):
    """媒体内容模型"""
    FILE_TYPE_CHOICES = [
        ('image', '图片'),
        ('video', '视频'),
    ]

    title = models.CharField(max_length=200, blank=True, null=True, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='AI描述')
    file = models.FileField(upload_to=user_media_path, verbose_name='文件')
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, verbose_name='文件类型')
    file_size = models.BigIntegerField(verbose_name='文件大小(字节)')
    thumbnail = models.FileField(upload_to=thumbnail_path, blank=True, null=True, verbose_name='缩略图')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media_files', verbose_name='上传者')
    categories = models.ManyToManyField(Category, blank=True, related_name='media_files', verbose_name='分类')
    tags = models.ManyToManyField(Tag, blank=True, related_name='media_files', verbose_name='标签')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '媒体文件'
        verbose_name_plural = '媒体文件'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title or self.file.name}"

    def save(self, *args, **kwargs):
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"保存媒体文件: {self.file.name if self.file else 'None'}")
        
        # 保存文件大小
        if self.file and not self.file_size:
            self.file_size = self.file.size
            logger.info(f"设置文件大小: {self.file_size}")
        
        # 根据文件扩展名自动设置文件类型
        if self.file and not self.file_type:
            file_extension = os.path.splitext(self.file.name)[1].lower()
            logger.info(f"文件扩展名: {file_extension}")
            
            if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                self.file_type = 'image'
                logger.info("设置文件类型: image")
            elif file_extension in ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']:
                self.file_type = 'video'
                logger.info("设置文件类型: video")
            else:
                logger.error(f"不支持的文件类型: {file_extension}")
                raise ValueError('不支持的文件类型')

        try:
            super().save(*args, **kwargs)
            logger.info("媒体文件保存成功")
        except Exception as e:
            logger.error(f"保存媒体文件失败: {str(e)}")
            raise

    def delete(self, *args, **kwargs):
        # 删除文件和缩略图
        if self.file:
            if default_storage.exists(self.file.name):
                default_storage.delete(self.file.name)
        
        if self.thumbnail:
            if default_storage.exists(self.thumbnail.name):
                default_storage.delete(self.thumbnail.name)
        
        super().delete(*args, **kwargs)

    def generate_thumbnail(self):
        """生成缩略图"""
        if self.file_type == 'image':
            self._generate_image_thumbnail()
        elif self.file_type == 'video':
            self._generate_video_thumbnail()

    def _generate_image_thumbnail(self):
        """为图片生成缩略图"""
        try:
            # 打开原始图片
            with Image.open(self.file.path) as img:
                # 转换为RGB模式（如果是RGBA或其他模式）
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background

                # 设置缩略图尺寸
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)

                # 创建临时文件
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
                    img.save(temp_file, 'JPEG', quality=85, optimize=True)
                    temp_path = temp_file.name

                # 保存缩略图
                with open(temp_path, 'rb') as temp_file:
                    thumbnail_name = f"thumb_{self.file.name.split('/')[-1].split('.')[0]}.jpg"
                    self.thumbnail.save(thumbnail_name, File(temp_file), save=False)

                # 删除临时文件
                os.unlink(temp_path)

        except Exception as e:
            print(f"图片缩略图生成失败: {e}")
            # 如果生成失败，不保存缩略图

    def _generate_video_thumbnail(self):
        """为视频生成缩略图"""
        try:
            import cv2

            # 打开视频文件
            video_path = self.file.path
            cap = cv2.VideoCapture(video_path)

            if not cap.isOpened():
                print(f"无法打开视频文件: {video_path}")
                return

            # 跳到第1秒的位置
            cap.set(cv2.CAP_PROP_POS_FRAMES, cap.get(cv2.CAP_PROP_FPS) * 1)

            # 读取帧
            ret, frame = cap.read()

            if ret:
                # 转换为RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # 转换为PIL Image
                img = Image.fromarray(frame_rgb)

                # 调整尺寸为16:9比例
                target_width = 300
                target_height = 169  # 16:9 比例
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)

                # 创建临时文件
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
                    img.save(temp_file, 'JPEG', quality=85, optimize=True)
                    temp_path = temp_file.name

                # 保存缩略图
                with open(temp_path, 'rb') as temp_file:
                    thumbnail_name = f"thumb_{self.file.name.split('/')[-1].split('.')[0]}.jpg"
                    self.thumbnail.save(thumbnail_name, File(temp_file), save=False)

                # 删除临时文件
                os.unlink(temp_path)

            cap.release()

        except ImportError:
            print("OpenCV未安装，无法生成视频缩略图")
        except Exception as e:
            print(f"视频缩略图生成失败: {e}")

    @property
    def file_url(self):
        """获取文件URL"""
        return self.file.url if self.file else None

    @property
    def thumbnail_url(self):
        """获取缩略图URL"""
        return self.thumbnail.url if self.thumbnail else None


# 信号处理器：在Media文件保存后自动生成缩略图
@receiver(post_save, sender=Media)
def generate_media_thumbnail(sender, instance, created, **kwargs):
    """
    Media文件保存后自动生成缩略图
    只在文件首次创建时生成缩略图，避免重复生成
    """
    if created and instance.file:
        try:
            instance.generate_thumbnail()
            # 保存缩略图，但不触发新的信号
            Media.objects.filter(pk=instance.pk).update(thumbnail=instance.thumbnail)
        except Exception as e:
            print(f"自动生成缩略图失败: {e}")
