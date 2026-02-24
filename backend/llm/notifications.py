"""
WebSocket 通知工具

用于发送实时状态更新到前端
"""

import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


def send_analysis_update(user_id, analysis_data):
    """
    发送分析状态更新通知

    Args:
        user_id: 用户 ID
        analysis_data: 分析数据字典，包含:
            - id: 分析 ID
            - status: 状态
            - description: 描述
            - error_message: 错误信息
            - media_filename: 媒体文件名
            - model_name: 模型名称
            - created_at: 创建时间
            - completed_at: 完成时间
    """
    try:
        channel_layer = get_channel_layer()
        group_name = f"analysis_{user_id}"

        logger.info(f"[WebSocket] 发送分析更新通知: user_id={user_id}, analysis_id={analysis_data.get('id')}, status={analysis_data.get('status')}, group={group_name}")

        # 异步发送消息到频道组
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'analysis_update',  # 对应消费者中的 analysis_update 方法
                'data': analysis_data
            }
        )
        logger.info(f"[WebSocket] 分析更新通知已发送: user_id={user_id}, analysis_id={analysis_data.get('id')}")
    except Exception as e:
        logger.error(f"[WebSocket] 发送分析更新失败: user_id={user_id}, error={str(e)}", exc_info=True)


def send_stats_update(user_id, stats_data):
    """
    发送统计信息更新通知

    Args:
        user_id: 用户 ID
        stats_data: 统计数据字典，包含:
            - total: 总数
            - pending: 待处理数
            - processing: 处理中数
            - completed: 已完成数
            - failed: 失败数
    """
    try:
        channel_layer = get_channel_layer()
        group_name = f"analysis_{user_id}"

        logger.info(f"[WebSocket] 发送统计更新通知: user_id={user_id}, stats={stats_data}, group={group_name}")

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'stats_update',  # 对应消费者中的 stats_update 方法
                'data': stats_data
            }
        )
        logger.info(f"[WebSocket] 统计更新通知已发送: user_id={user_id}")
    except Exception as e:
        logger.error(f"[WebSocket] 发送统计更新失败: user_id={user_id}, error={str(e)}", exc_info=True)
