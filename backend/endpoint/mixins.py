"""
Common mixins for endpoint views
"""

from rest_framework import status
from rest_framework.response import Response
from rest_framework import viewsets
from django.shortcuts import get_object_or_404


class StandardResponseMixin:
    """
    Mixin to provide standardized response format
    """

    @staticmethod
    def success_response(message='Success', data=None, code=200, http_status=status.HTTP_200_OK):
        """Return standardized success response"""
        response_data = {
            'code': code,
            'message': message,
            'data': data
        }
        return Response(response_data, status=http_status)

    @staticmethod
    def error_response(message='Error', data=None, code=400, http_status=status.HTTP_400_BAD_REQUEST):
        """Return standardized error response"""
        response_data = {
            'code': code,
            'message': message,
            'data': data
        }
        return Response(response_data, status=http_status)

    @staticmethod
    def created_response(message='Created successfully', data=None):
        """Return standardized created response"""
        return StandardResponseMixin.success_response(
            message=message,
            data=data,
            code=201,
            http_status=status.HTTP_201_CREATED
        )

    @staticmethod
    def not_found_response(message='Resource not found'):
        """Return standardized not found response"""
        return StandardResponseMixin.error_response(
            message=message,
            code=404,
            http_status=status.HTTP_404_NOT_FOUND
        )


class UserFilteredQuerysetMixin:
    """
    Mixin to filter queryset by current user
    """

    def get_queryset(self):
        """Filter queryset to only include user's resources"""
        queryset = super().get_queryset()
        user = self.request.user

        # Handle different user field names
        if hasattr(self.queryset.model, 'created_by'):
            return queryset.filter(created_by=user)
        elif hasattr(self.queryset.model, 'user'):
            return queryset.filter(user=user)
        elif hasattr(self.queryset.model, 'endpoint__created_by'):
            return queryset.filter(endpoint__created_by=user)

        return queryset


class UserPermissionMixin:
    """
    Mixin to check user permissions for objects
    """

    def get_object(self):
        """Get object and check user permission"""
        obj = super().get_object()
        self.check_user_permission(obj)
        return obj

    def check_user_permission(self, obj):
        """Check if user has permission to access the object"""
        user = self.request.user

        # Check different user field relationships
        if hasattr(obj, 'created_by'):
            if obj.created_by != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to access this resource")
        elif hasattr(obj, 'user'):
            if obj.user != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to access this resource")
        elif hasattr(obj, 'endpoint'):
            if obj.endpoint.created_by != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You don't have permission to access this resource")