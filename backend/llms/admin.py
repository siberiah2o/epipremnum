from django.contrib import admin
from .models import AIModel, AIAnalysis, OllamaEndpoint


@admin.register(OllamaEndpoint)
class OllamaEndpointAdmin(admin.ModelAdmin):
    list_display = ('name', 'url', 'is_active', 'created_by', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'url', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'name', 'endpoint', 'is_active', 'is_vision_capable', 'is_default')
    list_filter = ('is_active', 'is_vision_capable', 'is_default', 'endpoint')
    search_fields = ('name', 'display_name', 'description')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AIAnalysis)
class AIAnalysisAdmin(admin.ModelAdmin):
    list_display = ('media', 'status', 'model_used', 'analyzed_at')
    list_filter = ('status', 'analyzed_at', 'model_used')
    search_fields = ('media__title', 'model_used')
    readonly_fields = ('id', 'created_at', 'updated_at', 'analyzed_at')

    fieldsets = (
        ('基本信息', {
            'fields': ('media', 'status', 'model_used')
        }),
        ('分析结果', {
            'fields': ('title', 'description', 'prompt')
        }),
        ('建议内容', {
            'fields': ('suggested_categories', 'suggested_tags')
        }),
        ('错误信息', {
            'fields': ('error_message',)
        }),
        ('时间戳', {
            'fields': ('created_at', 'updated_at', 'analyzed_at'),
            'classes': ('collapse',)
        }),
    )