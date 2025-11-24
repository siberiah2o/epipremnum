"""
Base view utilities and common response handlers
"""

from rest_framework import status
from rest_framework.response import Response
from typing import Any, Dict, Optional, Union


class BaseResponseHandler:
    """Base class for standardized API responses"""

    @staticmethod
    def success_response(
        message: str,
        data: Any = None,
        code: int = 200,
        http_status: int = status.HTTP_200_OK
    ) -> Response:
        """Return standardized success response"""
        response_data = {
            'code': code,
            'message': message,
            'data': data
        }
        return Response(response_data, status=http_status)

    @staticmethod
    def error_response(
        message: str,
        data: Any = None,
        code: int = 400,
        http_status: int = status.HTTP_400_BAD_REQUEST
    ) -> Response:
        """Return standardized error response"""
        response_data = {
            'code': code,
            'message': message,
            'data': data
        }
        return Response(response_data, status=http_status)

    @staticmethod
    def not_found_response(
        message: str = "Resource not found",
        data: Any = None
    ) -> Response:
        """Return standardized not found response"""
        return BaseResponseHandler.error_response(
            message=message,
            data=data,
            code=404,
            http_status=status.HTTP_404_NOT_FOUND
        )

    @staticmethod
    def created_response(
        message: str,
        data: Any = None
    ) -> Response:
        """Return standardized created response"""
        return BaseResponseHandler.success_response(
            message=message,
            data=data,
            code=200,
            http_status=status.HTTP_201_CREATED
        )


class BaseViewSetMixin:
    """Common Mixin for Ollama ViewSets"""

    def get_user_queryset(self, model_class):
        """Get queryset filtered by current user"""
        if hasattr(model_class, 'created_by'):
            return model_class.objects.filter(created_by=self.request.user)
        elif hasattr(model_class, 'endpoint__created_by'):
            return model_class.objects.filter(endpoint__created_by=self.request.user)
        return model_class.objects.all()

    def get_serializer_class_by_action(self, serializer_mapping: Dict[str, type]):
        """Get serializer class based on current action"""
        return serializer_mapping.get(self.action, serializer_mapping.get('default'))

    def validate_user_access(self, instance):
        """Validate that user has access to the instance"""
        if hasattr(instance, 'created_by'):
            if instance.created_by != self.request.user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to access this resource")
        elif hasattr(instance, 'endpoint'):
            if instance.endpoint.created_by != self.request.user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to access this resource")