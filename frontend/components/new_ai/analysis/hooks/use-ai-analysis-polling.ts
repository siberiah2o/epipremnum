"use client";

import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";

interface AnalysisTask {
  id: number; // analysis_id
  mediaId: number;
  taskId?: string; // task_id (UUID)
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  onComplete?: (task: AnalysisTask) => void; // 完成回调
  onError?: (task: AnalysisTask) => void; // 错误回调
}

export function useAIAnalysisPolling() {
  const [tasks, setTasks] = useState<Map<number, AnalysisTask>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  // 使用独立的 ref 存储回调函数，避免 React 状态更新时序问题
  const callbacksRef = useRef<Map<number, { onComplete?: (task: AnalysisTask) => void; onError?: (task: AnalysisTask) => void }>>(new Map());

  // 添加新的分析任务
  const addTask = useCallback((
    analysisData: any,
    onComplete?: (task: AnalysisTask) => void,
    onError?: (task: AnalysisTask) => void
  ) => {
    // 处理新的API响应格式，支持analysis_id和task_id
    const analysisId = analysisData.analysis_id || analysisData.id;
    const taskId = analysisData.task_id; // 使用完整的task_id (UUID)
    const mediaId =
      analysisData.media_info?.id ||
      analysisData.media_id ||
      analysisData.media;

    if (!analysisId) {
      console.error("无法添加任务：缺少analysis_id", analysisData);
      return null;
    }

    if (!taskId) {
      console.error("无法添加任务：缺少task_id", analysisData);
      return null;
    }

    console.log(
      `🔍 [TASK] 添加新任务: analysisId=${analysisId}, taskId=${taskId}, mediaId=${mediaId}`
    );

    console.log(`🔍 [TASK] 创建任务: analysisId=${analysisId}, hasOnComplete=${!!onComplete}, hasOnError=${!!onError}`);

    // 将回调函数存储到 ref 中，避免 React 状态更新时序问题
    callbacksRef.current.set(analysisId, { onComplete, onError });

    const task: AnalysisTask = {
      id: analysisId, // 使用analysis_id作为前端跟踪的ID
      mediaId: mediaId || 0,
      taskId: taskId, // 保存task_id用于API调用
      status: analysisData.status || "processing",
      progress: analysisData.status === "completed" ? 100 : 0,
      result: analysisData,
      createdAt: new Date(analysisData.created_at || Date.now()),
      completedAt: analysisData.analyzed_at
        ? new Date(analysisData.analyzed_at)
        : undefined,
    };

    setTasks((prev) => {
      console.log(
        `🔍 [TASK] 存储任务到Map: analysisId=${analysisId}, tasks=${
          prev.size
        } -> ${prev.size + 1}`
      );
      return new Map(prev).set(analysisId, task);
    });

    // 如果任务未完成，开始轮询
    if (task.status !== "completed" && task.status !== "failed") {
      console.log(`🔍 [TASK] 开始轮询任务: analysisId=${analysisId}`);
      startPolling(task.id);
    } else {
      console.log(
        `🔍 [TASK] 任务已完成或失败，不开始轮询: analysisId=${analysisId}, status=${task.status}`
      );
    }

    return task;
  }, []);

  // 开始轮询单个任务
  const startPolling = useCallback(
    (analysisId: number) => {
      // 如果已经在轮询，先停止
      if (pollingIntervalsRef.current.has(analysisId)) {
        clearInterval(pollingIntervalsRef.current.get(analysisId));
      }

      setIsPolling(true);

      // 延迟开始轮询，确保任务已经保存到数据库
      setTimeout(() => {
        const interval = setInterval(async () => {
          try {
            // 直接调用API查询状态，不依赖本地存储的任务
            console.log(
              `🔍 [POLLING] 轮询任务状态: analysisId=${analysisId}, 时间=${new Date().toISOString()}`
            );

            const response = await apiClient.getAIAnalysisStatus(analysisId);
            console.log(`🔍 [POLLING] API响应:`, response);

            // 处理新的API响应格式: {code, message, data: {status, progress, ...}}
            const statusData = response.data || response;
            const analysisData = statusData.data || statusData;

            if (analysisData) {
              console.log(
                `🔍 [POLLING] 当前任务状态: status=${analysisData.status}, progress=${analysisData.progress}`
              );

              // 优先使用API返回的进度值，否则根据状态设置默认进度
              let progress = 0;
              if (typeof analysisData.progress === "number") {
                progress = analysisData.progress;
              } else if (analysisData.status === "completed") {
                progress = 100;
              } else if (analysisData.status === "processing") {
                progress = Math.max(progress, 50); // 如果没有具体进度，设为50%
              }

              // 从 callbacksRef 获取回调函数，避免 React 状态更新时序问题
              const callbacks = callbacksRef.current.get(analysisId);
              console.log(`🔍 [POLLING] 获取回调函数: analysisId=${analysisId}, hasOnComplete=${!!callbacks?.onComplete}, hasOnError=${!!callbacks?.onError}`);

              // 更新或创建任务
              const updatedTask: AnalysisTask = {
                id: analysisId,
                mediaId:
                  analysisData.media_info?.id || analysisData.media_id || 0,
                taskId: analysisData.task_id,
                status: analysisData.status || "processing",
                progress: progress,
                result: analysisData,
                error:
                  analysisData.status === "failed"
                    ? analysisData.error_message ||
                      analysisData.message ||
                      analysisData.error ||
                      "分析失败"
                    : undefined,
                createdAt: new Date(analysisData.created_at || Date.now()),
                completedAt: analysisData.analyzed_at
                  ? new Date(analysisData.analyzed_at)
                  : undefined,
              };

              console.log(`🔍 [POLLING] 更新任务状态:`, {
                analysisId,
                status: updatedTask.status,
                progress: updatedTask.progress,
                hasError: !!updatedTask.error,
                hasResult: !!updatedTask.result,
              });

              setTasks((prev) => new Map(prev).set(analysisId, updatedTask));

              // 如果任务完成或失败，停止轮询
              if (
                analysisData.status === "completed" ||
                analysisData.status === "failed"
              ) {
                console.log(
                  `🔍 [POLLING] 任务${analysisData.status}，停止轮询: analysisId=${analysisId}`
                );
                clearInterval(interval);
                pollingIntervalsRef.current.delete(analysisId);

                // 调用相应的回调函数
                const finalCallbacks = callbacksRef.current.get(analysisId);
                console.log(`🔍 [POLLING] 最终检查回调函数: analysisId=${analysisId}, status=${analysisData.status}, hasOnComplete=${!!finalCallbacks?.onComplete}, hasOnError=${!!finalCallbacks?.onError}`);

                if (analysisData.status === "completed" && finalCallbacks?.onComplete) {
                  console.log(`🔍 [POLLING] 调用完成回调: analysisId=${analysisId}`);
                  finalCallbacks.onComplete(updatedTask);
                } else if (analysisData.status === "failed" && finalCallbacks?.onError) {
                  console.log(`🔍 [POLLING] 调用错误回调: analysisId=${analysisId}`);
                  finalCallbacks.onError(updatedTask);
                } else {
                  console.log(`🔍 [POLLING] 没有可用的回调函数: analysisId=${analysisId}, status=${analysisData.status}`);
                }

                // 清理回调函数
                callbacksRef.current.delete(analysisId);

                // 任务完成后延迟清理任务状态，让UI有时间显示完成状态
                setTimeout(() => {
                  setTasks((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(analysisId);
                    return newMap;
                  });
                  console.log(`🔍 [POLLING] 已清理完成的任务: analysisId=${analysisId}`);
                }, 1000); // 1秒后清理任务状态

                // 检查是否还有其他任务在轮询
                if (pollingIntervalsRef.current.size === 0) {
                  console.log(`🔍 [POLLING] 所有任务已完成，停止轮询`);
                  setIsPolling(false);
                }
              } else {
                console.log(
                  `🔍 [POLLING] 任务继续，下次轮询: analysisId=${analysisId}, status=${analysisData.status}`
                );
              }
            } else {
              console.warn(
                `🔍 [POLLING] API返回空数据: analysisId=${analysisId}`
              );
            }
          } catch (error) {
            console.error(
              `🔍 [POLLING] 轮询任务 ${analysisId} 状态失败:`,
              error
            );

            // 对于网络错误，不要立即标记为失败，继续轮询
            if (
              error instanceof Error &&
              (error.name === "TypeError" || error.message.includes("Network"))
            ) {
              console.warn(
                `🔍 [POLLING] 网络错误，继续轮询任务 ${analysisId}...`
              );
              return; // 继续下一次轮询
            }

            // 对于其他类型的错误，标记任务为失败状态
            const currentTask = tasks.get(analysisId);
            if (currentTask) {
              const failedTask: AnalysisTask = {
                ...currentTask,
                status: "failed",
                error: error instanceof Error ? error.message : "轮询失败",
              };
              console.log(`🔍 [POLLING] 标记任务失败:`, failedTask);
              setTasks((prev) => new Map(prev).set(analysisId, failedTask));
            }

            clearInterval(interval);
            pollingIntervalsRef.current.delete(analysisId);

            if (pollingIntervalsRef.current.size === 0) {
              setIsPolling(false);
            }
          }
        }, 2000); // 改为每2秒轮询一次，减少服务器压力

        pollingIntervalsRef.current.set(analysisId, interval);
      }, 500); // 延迟500ms开始轮询，确保任务已保存到数据库
    },
    [tasks]
  );

  // 停止轮询单个任务
  const stopPolling = useCallback((taskId: number) => {
    const interval = pollingIntervalsRef.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(taskId);

      if (pollingIntervalsRef.current.size === 0) {
        setIsPolling(false);
      }
    }
  }, []);

  // 停止所有轮询
  const stopAllPolling = useCallback(() => {
    pollingIntervalsRef.current.forEach((interval) => {
      clearInterval(interval);
    });
    pollingIntervalsRef.current.clear();
    setIsPolling(false);
  }, []);

  // 获取任务
  const getTask = useCallback(
    (taskId: number) => {
      return tasks.get(taskId);
    },
    [tasks]
  );

  // 获取媒体文件对应的任务
  const getTaskByMediaId = useCallback(
    (mediaId: number) => {
      for (const task of tasks.values()) {
        if (task.mediaId === mediaId) {
          return task;
        }
      }
      return null;
    },
    [tasks]
  );

  // 清理已完成的旧任务（超过5分钟的）
  const cleanupOldTasks = useCallback(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const tasksToKeep = new Map<number, AnalysisTask>();

    tasks.forEach((task, taskId) => {
      if (
        (task.status === "completed" || task.status === "failed") &&
        task.createdAt < fiveMinutesAgo
      ) {
        // 停止对此任务的轮询
        stopPolling(taskId);
      } else {
        tasksToKeep.set(taskId, task);
      }
    });

    setTasks(tasksToKeep);
  }, [tasks, stopPolling]);

  // 组件卸载时清理
  const cleanup = useCallback(() => {
    stopAllPolling();
    setTasks(new Map());
  }, [stopAllPolling]);

  return {
    tasks: Array.from(tasks.values()),
    getTask,
    getTaskByMediaId,
    addTask,
    startPolling,
    stopPolling,
    stopAllPolling,
    cleanupOldTasks,
    cleanup,
    isPolling,
  };
}
