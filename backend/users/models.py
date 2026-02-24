from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """自定义用户模型"""

    email = models.EmailField('邮箱', unique=True)
    username = models.CharField('用户名', max_length=150, unique=True)
    phone = models.CharField('手机号', max_length=20, blank=True, null=True)
    avatar = models.ImageField('头像', upload_to='avatars/%Y/%m/', blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'
        db_table = 'users_user'

    def __str__(self):
        return self.email
