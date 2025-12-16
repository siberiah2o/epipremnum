"""
Connection testing view handlers
"""

import time
import requests
from rest_framework import status
from .base import BaseResponseHandler, BaseViewSetMixin
from ..clients.client_factory import ClientFactory


class ConnectionTestHandler(BaseViewSetMixin):
    """Handler for endpoint connection testing"""

    def __init__(self, viewset_instance):
        self.viewset = viewset_instance
        self.request = viewset_instance.request

    def test_connection(self, pk=None):
        """Test endpoint connection"""
        endpoint = self.viewset.get_object()
        self.validate_user_access(endpoint)

        start_time = time.time()
        connection_result = self._perform_connection_test(endpoint, start_time)

        # Return appropriate response based on connection status
        if connection_result['status'] == 'success':
            return BaseResponseHandler.success_response(
                message=f'端点连接测试成功，响应时间: {connection_result["response_time"]}',
                data=connection_result['data']
            )
        else:
            http_status = self._get_http_status_by_error(connection_result['status'])
            return BaseResponseHandler.error_response(
                message=connection_result['message'],
                data=connection_result['data'],
                http_status=http_status
            )

    def _perform_connection_test(self, endpoint, start_time):
        """Perform the actual connection test"""
        try:
            # 使用客户端工厂测试连接
            test_result = ClientFactory.test_endpoint_connection(endpoint)

            end_time = time.time()
            response_time = int((end_time - start_time) * 1000)

            # 构造返回数据
            return {
                'status': 'success' if test_result['success'] else 'error',
                'response_time': f'{response_time}ms',
                'message': test_result['message'],
                'data': {
                    'endpoint_id': endpoint.id,
                    'provider': endpoint.provider,
                    'connection_status': 'success' if test_result['success'] else 'error',
                    'response_time': f'{response_time}ms',
                    'details': test_result.get('details', {})
                }
            }

        except Exception as e:
            end_time = time.time()
            response_time = int((end_time - start_time) * 1000)
            return {
                'status': 'error',
                'response_time': f'{response_time}ms',
                'message': f'端点连接测试失败: {str(e)}',
                'data': {
                    'endpoint_id': endpoint.id,
                    'provider': endpoint.provider,
                    'connection_status': 'error',
                    'response_time': f'{response_time}ms'
                }
            }

    def _get_http_status_by_error(self, error_status):
        """Map error status to HTTP status code"""
        status_mapping = {
            'success': status.HTTP_200_OK,
            'error': status.HTTP_400_BAD_REQUEST,
            'timeout': status.HTTP_408_REQUEST_TIMEOUT,
            'connection_error': status.HTTP_503_SERVICE_UNAVAILABLE
        }
        return status_mapping.get(error_status, status.HTTP_400_BAD_REQUEST)