/**
 * 轮询 Hook
 * 统一的轮询机制，支持条件轮询和手动控制
 */
import { useEffect, useRef, useCallback } from 'react';

export interface UsePollingOptions {
  /** 轮询间隔（毫秒） */
  interval?: number;
  /** 是否启用轮询 */
  enabled?: boolean;
  /** 是否立即执行一次 */
  immediate?: boolean;
  /** 条件函数，返回 false 时暂停轮询 */
  condition?: () => boolean;
  /** 错误处理 */
  onError?: (error: Error) => void;
}

export interface UsePollingReturn {
  /** 手动触发 */
  trigger: () => void;
  /** 暂停轮询 */
  pause: () => void;
  /** 恢复轮询 */
  resume: () => void;
  /** 是否正在轮询 */
  isPolling: boolean;
}

/**
 * 轮询 Hook
 * @param callback 轮询回调函数
 * @param options 配置选项
 */
export function usePolling(
  callback: () => Promise<void> | void,
  options: UsePollingOptions = {}
): UsePollingReturn {
  const {
    interval = 5000,
    enabled = true,
    immediate = false,
    condition,
    onError,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(enabled);
  const callbackRef = useRef(callback);
  const conditionRef = useRef(condition);
  const onErrorRef = useRef(onError);

  // 更新 refs
  useEffect(() => {
    callbackRef.current = callback;
    conditionRef.current = condition;
    onErrorRef.current = onError;
  }, [callback, condition, onError]);

  const executeCallback = useCallback(async () => {
    // 检查条件
    if (conditionRef.current && !conditionRef.current()) {
      return;
    }

    try {
      await callbackRef.current();
    } catch (error) {
      if (onErrorRef.current) {
        onErrorRef.current(error instanceof Error ? error : new Error(String(error)));
      } else {
        console.error('Polling error:', error);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    isPollingRef.current = true;
    intervalRef.current = setInterval(executeCallback, interval);
  }, [interval, executeCallback]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const trigger = useCallback(() => {
    executeCallback();
  }, [executeCallback]);

  const pause = useCallback(() => {
    stopPolling();
  }, [stopPolling]);

  const resume = useCallback(() => {
    if (enabled) {
      startPolling();
    }
  }, [enabled, startPolling]);

  // 处理 enabled 变化
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // 立即执行
  useEffect(() => {
    if (immediate && enabled) {
      executeCallback();
    }
  }, [immediate, enabled]); // 注意：不包含 executeCallback

  return {
    trigger,
    pause,
    resume,
    isPolling: isPollingRef.current,
  };
}

/**
 * 条件轮询 Hook
 * 当条件满足时自动开始轮询，条件不满足时自动停止
 * @param callback 轮询回调函数
 * @param shouldPoll 是否应该轮询的条件
 * @param interval 轮询间隔（毫秒）
 */
export function useConditionalPolling(
  callback: () => Promise<void> | void,
  shouldPoll: boolean,
  interval: number = 3000
): void {
  usePolling(callback, {
    interval,
    enabled: shouldPoll,
    immediate: shouldPoll,
  });
}
