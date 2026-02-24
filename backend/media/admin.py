from django.contrib import admin
from .models import Media, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']


@admin.register(Media)
class MediaAdmin(admin.ModelAdmin):
    list_display = ['filename', 'owner', 'category', 'file_size_mb', 'created_at']
    list_filter = ['category', 'created_at']
    search_fields = ['filename', 'owner__username']
    ordering = ['-created_at']
    readonly_fields = ['file_size_mb', 'created_at', 'updated_at']

    def file_size_mb(self, obj):
        return round(obj.file_size / 1024 / 1024, 2)
    file_size_mb.short_description = '文件大小(MB)'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('owner', 'category')
