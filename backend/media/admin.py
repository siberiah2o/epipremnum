from django.contrib import admin
from .models import Media, Category, Tag


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """分类管理"""
    list_display = ('name', 'user', 'created_at')
    list_filter = ('user', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """标签管理"""
    list_display = ('name', 'user', 'created_at')
    list_filter = ('user', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    """媒体文件管理"""
    list_display = ('title', 'file_type', 'file_size', 'user', 'created_at')
    list_filter = ('file_type', 'user', 'created_at', 'categories')
    search_fields = ('title', 'description', 'prompt')
    readonly_fields = ('file_size', 'file_type', 'created_at', 'updated_at')
    filter_horizontal = ('categories', 'tags')
    
    fieldsets = (
        ('基本信息', {
            'fields': ('title', 'description', 'prompt', 'user')
        }),
        ('文件信息', {
            'fields': ('file', 'thumbnail', 'file_type', 'file_size')
        }),
        ('分类和标签', {
            'fields': ('categories', 'tags')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
