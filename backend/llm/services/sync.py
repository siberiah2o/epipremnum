"""
模型同步服务

提供 AI 模型列表同步功能
"""

import logging
from typing import Dict, Any

from django.utils import timezone

from .providers import get_provider
from llm.models import Endpoint, AIModel
from llm.exceptions import ModelNotFoundError, APIError

logger = logging.getLogger(__name__)


class SyncService:
    """
    模型同步服务

    负责从 AI 端点同步可用模型列表到本地数据库
    """

    @staticmethod
    def sync_models(endpoint_id: int, user_id: int) -> Dict[str, Any]:
        """
        同步端点的模型列表

        Args:
            endpoint_id: 端点 ID
            user_id: 用户 ID

        Returns:
            dict: 同步结果，包含:
                - endpoint_id: 端点 ID
                - total_models: 总模型数
                - created: 新建数量
                - updated: 更新数量
                - synced_at: 同步时间

        Raises:
            ModelNotFoundError: 端点不存在或无权访问
            APIError: API 调用失败
        """
        # 验证端点
        try:
            endpoint = Endpoint.objects.get(id=endpoint_id, owner_id=user_id)
        except Endpoint.DoesNotExist:
            raise ModelNotFoundError(f"端点不存在或无权访问: endpoint_id={endpoint_id}")

        # 获取提供商并获取模型列表
        try:
            # 创建一个临时模型用于获取提供商实例
            # 注意：获取模型列表不需要具体模型
            provider = get_provider(endpoint, None)
            model_names = provider.get_available_models()
        except Exception as e:
            logger.error(f"获取模型列表失败: endpoint_id={endpoint_id}, error={str(e)}")
            raise APIError(f"获取模型列表失败: {str(e)}")

        # 同步到数据库
        created_count = 0
        updated_count = 0

        for i, model_name in enumerate(model_names):
            model, created = AIModel.objects.update_or_create(
                endpoint=endpoint,
                name=model_name,
                defaults={
                    'is_default': i == 0  # 第一个模型设为默认
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        result = {
            'endpoint_id': endpoint_id,
            'total_models': len(model_names),
            'created': created_count,
            'updated': updated_count,
            'synced_at': timezone.now().isoformat(),
        }

        logger.info(f"模型同步完成: {result}")
        return result

    @staticmethod
    def sync_all_endpoints(user_id: int) -> Dict[str, Any]:
        """
        同步用户所有端点的模型列表

        Args:
            user_id: 用户 ID

        Returns:
            dict: 同步结果汇总
        """
        endpoints = Endpoint.objects.filter(owner_id=user_id)

        results = []
        total_created = 0
        total_updated = 0
        failed = []

        for endpoint in endpoints:
            try:
                result = SyncService.sync_models(endpoint.id, user_id)
                results.append(result)
                total_created += result['created']
                total_updated += result['updated']
            except Exception as e:
                failed.append({
                    'endpoint_id': endpoint.id,
                    'endpoint_name': endpoint.name,
                    'error': str(e)
                })
                logger.error(f"同步端点失败: endpoint_id={endpoint.id}, error={str(e)}")

        return {
            'total_endpoints': len(endpoints),
            'success_count': len(results),
            'failed_count': len(failed),
            'total_created': total_created,
            'total_updated': total_updated,
            'failed': failed,
        }
