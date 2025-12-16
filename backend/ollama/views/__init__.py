"""
Ollama Views Package

This package provides abstracted view handlers for Ollama analysis tasks.
Endpoint and model management have been moved to the endpoint app.
"""

from .dispatcher import OllamaAnalysisViewSet

__all__ = ['OllamaAnalysisViewSet']