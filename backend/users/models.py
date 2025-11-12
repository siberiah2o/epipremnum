from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """
    自定义用户模型，继承自 Django 的 AbstractUser
    """
    email = models.EmailField(unique=True, verbose_name='邮箱')
    phone = models.CharField(max_length=11, blank=True, null=True, verbose_name='手机号')
    avatar = models.URLField(blank=True, null=True, verbose_name='头像')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    USERNAME_FIELD = 'email'  # 使用邮箱作为用户名
    REQUIRED_FIELDS = ['username']  # 创建用户时必须填写的字段

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return self.email
