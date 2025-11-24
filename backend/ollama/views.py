"""
Ollama Views Module - Refactored with Abstraction

This module now imports the abstracted ViewSets from the views package.
The actual implementation is split into specialized handlers:
- endpoint.py: Endpoint CRUD and management
- model.py: Model read operations and management
- connection.py: Connection testing
- sync.py: Model synchronization
- base.py: Common utilities and response handling

This architecture provides:
- Better code organization and maintainability
- Separation of concerns
- Reusable components
- Easier testing
- Cleaner interfaces
"""

# Import the refactored ViewSets from the dispatcher
from .views.dispatcher import OllamaEndpointViewSet, OllamaAIModelViewSet, OllamaAnalysisViewSet

# Export the ViewSets for backward compatibility
__all__ = ['OllamaEndpointViewSet', 'OllamaAIModelViewSet', 'OllamaAnalysisViewSet']
