from django.contrib import admin
from django.utils.html import format_html
from .models import AIAnalysis, OllamaModel, BatchAnalysisJob, SuggestedCategory, SuggestedTag, OllamaEndpoint


@admin.register(AIAnalysis)
class AIAnalysisAdmin(admin.ModelAdmin):
    list_display = ['id', 'media', 'status', 'model_used', 'created_at', 'analyzed_at']
    list_filter = ['status', 'model_used', 'created_at']
    search_fields = ['media__title', 'ai_title', 'model_used']
    readonly_fields = ['id', 'created_at', 'updated_at', 'analyzed_at']

    fieldsets = (
        ('基本信息', {
            'fields': ('media', 'status', 'model_used')
        }),
        ('AI生成内容', {
            'fields': ('ai_title', 'ai_description', 'ai_prompt')
        }),
        ('分析结果', {
            'fields': ('analysis_result', 'error_message')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at', 'analyzed_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(OllamaModel)
class OllamaModelAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'name', 'is_active', 'is_vision_capable', 'model_size', 'created_at']
    list_filter = ['is_active', 'is_vision_capable', 'created_at']
    search_fields = ['name', 'display_name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'display_name', 'description')
        }),
        ('配置', {
            'fields': ('is_active', 'is_vision_capable', 'model_size', 'api_endpoint')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


class SuggestedCategoryInline(admin.TabularInline):
    model = SuggestedCategory
    extra = 0
    readonly_fields = ['created_at']


class SuggestedTagInline(admin.TabularInline):
    model = SuggestedTag
    extra = 0
    readonly_fields = ['created_at']


@admin.register(BatchAnalysisJob)
class BatchAnalysisJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'total_files', 'processed_files', 'progress_percentage', 'created_at']
    list_filter = ['status', 'created_at', 'model']
    search_fields = ['user__username', 'id']
    readonly_fields = ['id', 'created_at', 'updated_at', 'started_at', 'completed_at', 'progress_percentage']

    fieldsets = (
        ('任务信息', {
            'fields': ('id', 'user', 'model', 'status')
        }),
        ('进度', {
            'fields': ('total_files', 'processed_files', 'failed_files', 'progress_percentage')
        }),
        ('时间信息', {
            'fields': ('started_at', 'completed_at', 'created_at', 'updated_at')
        }),
        ('错误信息', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'model')


@admin.register(SuggestedCategory)
class SuggestedCategoryAdmin(admin.ModelAdmin):
    list_display = ['ai_analysis', 'category', 'confidence', 'created_at']
    list_filter = ['confidence', 'created_at']
    search_fields = ['category__name', 'ai_analysis__media__title']
    readonly_fields = ['created_at']


@admin.register(SuggestedTag)
class SuggestedTagAdmin(admin.ModelAdmin):
    list_display = ['ai_analysis', 'tag', 'confidence', 'created_at']
    list_filter = ['confidence', 'created_at']
    search_fields = ['tag__name', 'ai_analysis__media__title']
    readonly_fields = ['created_at']


@admin.register(OllamaEndpoint)
class OllamaEndpointAdmin(admin.ModelAdmin):
    list_display = ['name', 'url', 'is_active', 'is_default', 'timeout', 'created_by', 'created_at']
    list_filter = ['is_active', 'is_default', 'created_at']
    search_fields = ['name', 'url', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('基本信息', {
            'fields': ('name', 'url', 'description')
        }),
        ('配置', {
            'fields': ('is_active', 'is_default', 'timeout')
        }),
        ('创建信息', {
            'fields': ('created_by',)
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(self.readonly_fields)
        if obj:  # 编辑现有对象时
            readonly_fields.append('created_by')
        return readonly_fields

    def save_model(self, request, obj, form, change):
        if not change:  # 创建新对象时
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    actions = ['test_connection']

    def test_connection(self, request, queryset):
        """测试选中的端点连接"""
        for endpoint in queryset:
            try:
                result = endpoint.test_connection()
                if result['success']:
                    self.message_user(request, f"端点 '{endpoint.name}' 连接成功，发现 {result['models_count']} 个模型", level='SUCCESS')
                else:
                    self.message_user(request, f"端点 '{endpoint.name}' 连接失败: {result['error']}", level='ERROR')
            except Exception as e:
                self.message_user(request, f"端点 '{endpoint.name}' 测试失败: {str(e)}", level='ERROR')

    test_connection.short_description = '测试选中端点的连接'
