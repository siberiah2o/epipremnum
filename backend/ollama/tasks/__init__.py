"""
Ollama Tasks Package

This package contains task-related components for Ollama image analysis:
- manager.py: Task management and coordination
- image_analyzer.py: Image analysis logic
- async_tasks.py: Asynchronous task definitions
- concurrency_controller.py: Concurrency control for batch processing
- analysis_templates.py: Analysis prompt templates
"""

from .manager import OllamaTaskManager
from .image_analyzer import OllamaImageAnalyzer
from .async_tasks import analyze_image_with_ollama_task, cancel_analysis_task, analyze_batch_images_task, cancel_batch_tasks_task, cancel_all_user_tasks_task
from .concurrency_controller import concurrency_controller
from .batch_processor import batch_processor, analyze_images_with_concurrency_task

__all__ = [
    'OllamaTaskManager',
    'OllamaImageAnalyzer',
    'concurrency_controller',
    'batch_processor',
    'analyze_images_with_concurrency_task',
    'analyze_image_with_ollama_task',
    'cancel_analysis_task',
    'analyze_batch_images_task',
    'cancel_batch_tasks_task',
    'cancel_all_user_tasks_task'
]