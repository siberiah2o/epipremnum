"""
WebSocket 消费者 - 处理分析状态更新的实时通知
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class AnalysisStatusConsumer(AsyncWebsocketConsumer):
    """
    分析状态更新消费者

    每个用户连接到其专属的频道: analysis_{user_id}
    """

    async def connect(self):
        """接受 WebSocket 连接"""
        # 从 URL 获取用户 ID（通过认证中间件验证）
        user = self.scope["user"]
        if user.is_anonymous or not user.is_active:
            await self.close()
            return

        self.user_id = self.scope["user"].id
        # 用户专属频道名称
        self.channel_name = f"analysis_{self.user_id}"

        # 加入频道组
        await self.channel_layer.group_add(
            f"analysis_{self.user_id}",
            self.channel_name
        )

        await self.accept()
        logger.info(f"WebSocket connected: user_id={self.user_id}")

    async def disconnect(self, close_code):
        """断开 WebSocket 连接"""
        if hasattr(self, 'user_id'):
            await self.channel_layer.group_discard(
                f"analysis_{self.user_id}",
                self.channel_name
            )
            logger.info(f"WebSocket disconnected: user_id={self.user_id}")

    async def analysis_update(self, event):
        """
        处理分析状态更新事件

        事件格式:
        {
            'type': 'analysis_update',
            'analysis_id': int,
            'status': str,
            'description': str,
            'error_message': str,
            ...
        }
        """
        logger.info(f"[Consumer] 收到分析更新事件: user_id={self.user_id}, event={event}")
        # 发送更新到客户端
        await self.send(text_data=json.dumps({
            'type': 'analysis_update',
            'data': event['data']
        }))
        logger.info(f"[Consumer] 已发送分析更新到客户端: user_id={self.user_id}")

    async def stats_update(self, event):
        """
        处理统计信息更新事件

        事件格式:
        {
            'type': 'stats_update',
            'total': int,
            'pending': int,
            'processing': int,
            'completed': int,
            'failed': int
        }
        """
        logger.info(f"[Consumer] 收到统计更新事件: user_id={self.user_id}, event={event}")
        await self.send(text_data=json.dumps({
            'type': 'stats_update',
            'data': event['data']
        }))
        logger.info(f"[Consumer] 已发送统计更新到客户端: user_id={self.user_id}")

    async def receive(self, text_data):
        """
        接收来自客户端的消息（如 ping/pong）
        """
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                # 响应 ping 消息
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received: {text_data}")
