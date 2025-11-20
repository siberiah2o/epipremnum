from django.urls import path
from . import views

app_name = 'llms'

urlpatterns = [
    # 端点管理
    path('endpoint/', views.OllamaEndpointViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='endpoint_list'),

    path('endpoint/<int:pk>/', views.OllamaEndpointViewSet.as_view({
        'get': 'retrieve',
        'post': 'update'
    }), name='endpoint_detail'),

    path('endpoint/<int:pk>/test/', views.OllamaEndpointViewSet.as_view({
        'get': 'test'
    }), name='endpoint_test'),

    path('endpoint/<int:pk>/delete/', views.OllamaEndpointViewSet.as_view({
        'post': 'destroy'
    }), name='endpoint_delete'),

    # 模型管理
    path('models/', views.AIModelViewSet.as_view({
        'get': 'list'
    }), name='models_list'),

    path('models/default/', views.AIModelViewSet.as_view({
        'get': 'list_default'
    }), name='models_default'),

    path('models/refresh/', views.AIModelViewSet.as_view({
        'post': 'refresh'
    }), name='models_refresh'),

    path('models/<int:pk>/', views.AIModelViewSet.as_view({
        'get': 'retrieve'
    }), name='models_detail'),

    path('models/<int:pk>/test/', views.AIModelViewSet.as_view({
        'get': 'test'
    }), name='models_test'),

    path('models/<int:pk>/default/', views.AIModelViewSet.as_view({
        'post': 'default'
    }), name='models_default'),

    path('models/set-default/', views.AIModelViewSet.as_view({
        'post': 'set_default_by_name'
    }), name='models_set_default'),

    # 分析接口 - 统一使用POST请求
    path('analyze/list/', views.AIAnalysisViewSet.as_view({
        'post': 'list'
    }), name='analyze_list'),

    path('analyze/detail/', views.AIAnalysisViewSet.as_view({
        'post': 'retrieve'
    }), name='analyze_detail'),

    path('analyze/delete/', views.AIAnalysisViewSet.as_view({
        'post': 'destroy'
    }), name='analyze_delete'),

    path('analyze/single/', views.AIAnalysisViewSet.as_view({
        'post': 'single'
    }), name='analyze_single'),

    path('analyze/apply/', views.AIAnalysisViewSet.as_view({
        'post': 'apply'
    }), name='analyze_apply'),

    path('analyze/status/', views.AIAnalysisViewSet.as_view({
        'post': 'status'
    }), name='analyze_status'),

    path('analyze/retry/', views.AIAnalysisViewSet.as_view({
        'post': 'retry'
    }), name='analyze_retry'),

  ]