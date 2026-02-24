"""
公共分页器

提供统一的分页响应格式
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    标准分页器

    统一的分页响应格式:
    {
        "code": 200,
        "message": "获取成功",
        "data": [...],
        "pagination": {
            "count": 100,
            "next": "http://...",
            "previous": "http://...",
            "page_size": 20,
            "current_page": 1,
            "total_pages": 5
        }
    }
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        """返回自定义格式的分页响应"""
        return Response({
            'code': 200,
            'message': '获取成功',
            'data': data,
            'pagination': {
                'count': self.page.paginator.count,
                'next': self.get_next_link(),
                'previous': self.get_previous_link(),
                'page_size': self.page_size,
                'current_page': self.page.number,
                'total_pages': self.page.paginator.num_pages,
            }
        })

    def get_paginated_response_schema(self, schema):
        """OpenAPI schema"""
        return {
            'type': 'object',
            'properties': {
                'code': {'type': 'integer', 'example': 200},
                'message': {'type': 'string', 'example': '获取成功'},
                'data': schema,
                'pagination': {
                    'type': 'object',
                    'properties': {
                        'count': {'type': 'integer'},
                        'next': {'type': 'string', 'nullable': True},
                        'previous': {'type': 'string', 'nullable': True},
                        'page_size': {'type': 'integer'},
                        'current_page': {'type': 'integer'},
                        'total_pages': {'type': 'integer'},
                    }
                }
            }
        }


class LargePagination(StandardPagination):
    """大分页器 - 支持更多数据"""
    max_page_size = 1000


class SmallPagination(StandardPagination):
    """小分页器 - 适用于下拉列表等"""
    page_size = 10
    max_page_size = 50
