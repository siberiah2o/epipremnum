"""
Ollama图片分析任务模块
重构后的模块结构，提供更清晰的代码组织
"""

# 导入核心类和实例
from .prompt_templates import PromptTemplates, TaskConfig
from .task_workers import analyze_image_task, cancel_analysis_task, analyze_batch_task, cancel_all_user_tasks_task
from .state_manager import state_manager
from .batch_handler import batch_handler
from .concurrency_manager import concurrency_manager
from .ollama_client import OllamaImageAnalyzer
from .task_service import task_service


# 导出的公共接口
__all__ = [
    # 核心类和实例
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

# 版本信息
__version__ = '2.0.0'