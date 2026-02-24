"""
LLM 模块 Admin 配置
"""

from django.contrib import admin
from .models import Endpoint, AIModel, ImageAnalysis


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    """AI 模型管理"""

    list_display = ['name', 'endpoint', 'is_default', 'created_at']
    list_filter = ['endpoint', 'is_default', 'created_at']
    search_fields = ['name', 'endpoint__name']
    ordering = ['-is_default', 'endpoint', 'name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Endpoint)
class EndpointAdmin(admin.ModelAdmin):
    """API 端点管理"""

    list_display = ['name', 'provider_type', 'display_api_key', 'owner', 'created_at']
    list_filter = ['provider_type', 'created_at']
    search_fields = ['name', 'base_url', 'owner__username']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']

    def display_api_key(self, obj):
        """脱敏显示 API Key"""
        return obj.get_masked_api_key()
    display_api_key.short_description = 'API Key'


@admin.register(ImageAnalysis)
class ImageAnalysisAdmin(admin.ModelAdmin):
    """图片分析管理"""

    list_display = ['id', 'media', 'model', 'status', 'error_type', 'retry_count', 'created_at']
    list_filter = ['status', 'error_type', 'created_at']
    search_fields = ['media__filename', 'description', 'error_message']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'completed_at']

    def get_queryset(self, request):
        """优化查询"""
        return super().get_queryset(request).select_related('media', 'model', 'endpoint', 'user')
