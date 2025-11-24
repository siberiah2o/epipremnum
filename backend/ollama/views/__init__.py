"""
Ollama Views Package

This package provides abstracted view handlers for Ollama endpoints and models.
The main dispatcher is available in this module for backward compatibility.
"""

from .dispatcher import OllamaEndpointViewSet, OllamaAIModelViewSet, OllamaAnalysisViewSet

__all__ = ['OllamaEndpointViewSet', 'OllamaAIModelViewSet', 'OllamaAnalysisViewSet']