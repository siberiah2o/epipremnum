"""
Workflow任务管理模块
从ollama.tasks迁移过来的任务处理模块
"""

# 版本信息
__version__ = '2.0.0'

# 延迟加载函数
def _lazy_import(module_name, item_names):
    """延迟导入模块的函数"""
    module = __import__(module_name, fromlist=item_names)
    return {name: getattr(module, name) for name in item_names}

# 定义延迟加载的属性
_lazy_attrs = {
    'PromptTemplates': lambda: _lazy_import('.prompt_templates', ['PromptTemplates'])['PromptTemplates'],
    'TaskConfig': lambda: _lazy_import('.prompt_templates', ['TaskConfig'])['TaskConfig'],
    'state_manager': lambda: _lazy_import('.state_manager', ['state_manager'])['state_manager'],
    'batch_handler': lambda: _lazy_import('.batch_handler', ['batch_handler'])['batch_handler'],
    'concurrency_manager': lambda: _lazy_import('.concurrency_manager', ['concurrency_manager'])['concurrency_manager'],
    'OllamaImageAnalyzer': lambda: _lazy_import('.ollama_client', ['OllamaImageAnalyzer'])['OllamaImageAnalyzer'],
    'task_service': lambda: _lazy_import('.task_service', ['task_service'])['task_service'],
}

# 任务函数需要特别处理，因为它们是装饰器返回的
_task_functions = None

def _get_task_functions():
    global _task_functions
    if _task_functions is None:
        _task_functions = _lazy_import('.task_workers', [
            'analyze_image_task',
            'cancel_analysis_task',
            'analyze_batch_task',
            'cancel_all_user_tasks_task'
        ])
    return _task_functions

# 实现__getattr__以支持延迟加载
def __getattr__(name):
    if name in _lazy_attrs:
        return _lazy_attrs[name]()
    elif name in ['analyze_image_task', 'cancel_analysis_task', 'analyze_batch_task', 'cancel_all_user_tasks_task']:
        return _get_task_functions()[name]
    raise AttributeError(f"module 'workflow' has no attribute '{name}'")

# 导出的公共接口
__all__ = [
    'PromptTemplates',
    'TaskConfig',
    'analyze_image_task',
    'cancel_analysis_task',
    'analyze_batch_task',
    'cancel_all_user_tasks_task',
    'state_manager',
    'batch_handler',
    'concurrency_manager',
    'OllamaImageAnalyzer',
    'task_service',
]