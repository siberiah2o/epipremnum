from django.contrib import admin
from .models import Project, ProjectMedia


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """项目管理后台"""
    list_display = ['id', 'name', 'owner', 'media_count', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['name', 'description', 'owner__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'


@admin.register(ProjectMedia)
class ProjectMediaAdmin(admin.ModelAdmin):
    """项目媒体关联管理后台"""
    list_display = ['id', 'project', 'media', 'order', 'added_at']
    list_filter = ['added_at', 'project']
    search_fields = ['project__name', 'media__filename', 'notes']
    readonly_fields = ['added_at']
    date_hierarchy = 'added_at'
