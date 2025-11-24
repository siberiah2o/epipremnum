"""
Connection testing view handlers
"""

import time
import requests
from rest_framework import status
from .base import BaseResponseHandler, BaseViewSetMixin


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
        connection_status = 'success'
        error_message = None

        try:
            # Test Ollama API basic connection
            response = requests.get(
                f"{endpoint.url.rstrip('/')}/api/version",
                timeout=10
            )

            if response.status_code == 200:
                end_time = time.time()
                response_time = int((end_time - start_time) * 1000)

                return {
                    'status': 'success',
                    'response_time': f'{response_time}ms',
                    'message': f'端点连接测试成功，响应时间: {response_time}ms',
                    'data': {
                        'endpoint_id': endpoint.id,
                        'connection_status': 'success',
                        'response_time': f'{response_time}ms'
                    }
                }
            else:
                end_time = time.time()
                response_time = int((end_time - start_time) * 1000)
                connection_status = 'error'
                error_message = f'HTTP {response.status_code}'

                return {
                    'status': 'error',
                    'response_time': f'{response_time}ms',
                    'message': f'端点连接失败: {error_message}',
                    'data': {
                        'endpoint_id': endpoint.id,
                        'connection_status': 'error',
                        'response_time': f'{response_time}ms'
                    }
                }

        except requests.exceptions.Timeout:
            end_time = time.time()
            response_time = int((end_time - start_time) * 1000)
            return {
                'status': 'timeout',
                'response_time': f'{response_time}ms',
                'message': '端点连接测试超时',
                'data': {
                    'endpoint_id': endpoint.id,
                    'connection_status': 'timeout',
                    'response_time': f'{response_time}ms'
                }
            }

        except requests.exceptions.ConnectionError:
            end_time = time.time()
            response_time = int((end_time - start_time) * 1000)
            return {
                'status': 'connection_error',
                'response_time': f'{response_time}ms',
                'message': '端点连接失败：无法连接到指定URL',
                'data': {
                    'endpoint_id': endpoint.id,
                    'connection_status': 'connection_error',
                    'response_time': f'{response_time}ms'
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