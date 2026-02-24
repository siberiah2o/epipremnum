'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface AnalysisUpdateMessage {
  type: 'analysis_update' | 'stats_update' | 'pong';
  data?: any;
}

export function useAnalysisWebSocket(options: {
  onAnalysisUpdate?: (data: any) => void;
  onStatsUpdate?: (stats: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // 关闭现有连接
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    // 构建 WebSocket URL
    // 使用 cookie 进行认证，不需要 token 参数
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'localhost:8000';
    const wsUrl = `${protocol}//${wsHost}/ws/analysis/`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        options.onConnected?.();

        // 启动心跳
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // 每30秒发送一次心跳
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: AnalysisUpdateMessage = JSON.parse(event.data);

          if (message.type === 'analysis_update' && message.data) {
            options.onAnalysisUpdate?.(message.data);
          } else if (message.type === 'stats_update' && message.data) {
            options.onStatsUpdate?.(message.data);
          } else if (message.type === 'pong') {
            // 心跳响应，无需处理
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        options.onDisconnected?.();

        // 清理心跳
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // 自动重连（5秒后）
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Reconnecting WebSocket...');
          connect();
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // 连接和断开管理
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    disconnect,
  };
}
