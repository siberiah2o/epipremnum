from django.urls import path
from . import views

app_name = 'ollama_ai'

urlpatterns = [
    # 单张图片分析
    path('analyze/', views.AnalyzeImageView.as_view(), name='analyze_image'),

    # 批量分析
    path('batch-analyze/', views.BatchAnalyzeView.as_view(), name='batch_analyze'),
    path('batch-analyze/<uuid:job_id>/status/', views.BatchAnalysisStatusView.as_view(), name='batch_analysis_status'),

    # 分析结果
    path('analysis/<int:media_id>/', views.AnalysisResultView.as_view(), name='analysis_result'),
    path('analysis/<int:media_id>/apply/', views.ApplyAnalysisSuggestionsView.as_view(), name='apply_analysis_suggestions'),

    # 单独的生成接口
    path('generate/title/', views.GenerateTitleView.as_view(), name='generate_title'),
    path('generate/description/', views.GenerateDescriptionView.as_view(), name='generate_description'),
    path('generate/prompt/', views.GeneratePromptView.as_view(), name='generate_prompt'),
    path('generate/categories/', views.GenerateCategoriesView.as_view(), name='generate_categories'),
    path('generate/tags/', views.GenerateTagsView.as_view(), name='generate_tags'),

    # 组合分析接口
    path('generate/combined/', views.CombinedAnalysisView.as_view(), name='combined_analysis'),

    # 模型管理
    path('models/', views.AvailableModelsView.as_view(), name='available_models'),
    path('models/sync/', views.SyncOllamaModels.as_view(), name='sync_models'),

    # 端点管理
    path('endpoints/', views.OllamaEndpointManager.as_view(), name='endpoint_manager'),
    path('endpoints/<int:endpoint_id>/', views.OllamaEndpointDetail.as_view(), name='endpoint_detail'),
    path('endpoints/<int:endpoint_id>/test/', views.TestOllamaEndpoint.as_view(), name='test_endpoint'),
    path('endpoints/test/', views.TestOllamaEndpoint.as_view(), name='test_default_endpoint'),

    # 测试连接
    path('test-connection/', views.test_ollama_connection, name='test_ollama_connection'),
]