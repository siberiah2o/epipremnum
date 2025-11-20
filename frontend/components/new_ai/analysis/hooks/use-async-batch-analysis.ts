"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAIAnalysisPolling } from "./use-ai-analysis-polling";
import { toast } from "sonner";
import type { MediaListItem } from "@/lib/api";

interface BatchAnalysisTask {
  id: number;
  mediaId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: any;
}

interface BatchAnalysisState {
  tasks: BatchAnalysisTask[];
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  total: number;
  isRunning: boolean;
  startTime?: Date;
}

export function useAsyncBatchAnalysis() {
  const [state, setState] = useState<BatchAnalysisState>({
    tasks: [],
    completed: 0,
    failed: 0,
    processing: 0,
    pending: 0,
    total: 0,
    isRunning: false,
  });

  const { addTask, getTaskByMediaId, cleanup, isPolling } = useAIAnalysisPolling();

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 更新任务状态
  const updateTaskStatus = useCallback((mediaId: number, updates: Partial<BatchAnalysisTask>) => {
    setState((prev) => {
      const updatedTasks = prev.tasks.map((task) =>
        task.mediaId === mediaId ? { ...task, ...updates } : task
      );

      const completed = updatedTasks.filter((t) => t.status === 'completed').length;
      const failed = updatedTasks.filter((t) => t.status === 'failed').length;
      const processing = updatedTasks.filter((t) => t.status === 'processing').length;
      const pending = updatedTasks.filter((t) => t.status === 'pending').length;

      return {
        ...prev,
        tasks: updatedTasks,
        completed,
        failed,
        processing,
        pending,
      };
    });
  }, []);

  // 监听轮询任务完成
  const checkTaskCompletion = useCallback((mediaId: number) => {
    const pollingTask = getTaskByMediaId(mediaId);
    if (!pollingTask) return;

    updateTaskStatus(mediaId, {
      status: pollingTask.status,
      progress: pollingTask.progress,
      result: pollingTask.result,
      error: pollingTask.error,
    });
  }, [getTaskByMediaId, updateTaskStatus]);

  // 执行异步批量分析
  const performBatchAnalysis = async (
    mediaFiles: MediaListItem[],
    modelName: string,
    options: {
      generate_title?: boolean;
      generate_description?: boolean;
      generate_prompt?: boolean;
      generate_categories?: boolean;
      generate_tags?: boolean;
      max_categories?: number;
      max_tags?: number;
    } = {},
    concurrencyLimit: number = 3,
    onJobComplete?: (successCount: number, failedCount: number) => void,
    onTaskComplete?: (mediaId: number, result: any) => void
  ) => {
    if (!modelName) {
      toast.error("请选择一个AI模型");
      return;
    }

    const imageFiles = mediaFiles.filter((file) => file.file_type === 'image');
    if (imageFiles.length === 0) {
      toast.error("请选择要分析的图片文件");
      return;
    }

    try {
      setState({
        tasks: imageFiles.map((file, index) => ({
          id: index,
          mediaId: file.id,
          status: 'pending' as const,
          progress: 0,
        })),
        completed: 0,
        failed: 0,
        processing: 0,
        pending: imageFiles.length,
        total: imageFiles.length,
        isRunning: true,
        startTime: new Date(),
      });

      toast.info(`开始批量分析 ${imageFiles.length} 张图片...`);

      // 创建并发控制器
      const semaphore = {
        value: concurrencyLimit,
        wait: () => new Promise<void>((resolve) => {
          const check = () => {
            if (semaphore.value > 0) {
              semaphore.value--;
              resolve();
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        }),
        release: () => {
          semaphore.value++;
        },
      };

      // 启动分析任务
      const analysisPromises = imageFiles.map(async (file) => {
        await semaphore.wait();

        try {
          updateTaskStatus(file.id, { status: 'processing', progress: 10 });

          // 发起异步分析请求
          const response = await apiClient.analyzeSingle(
            file.id,
            modelName,
            options
          );

          // 处理新的API响应格式: {code, message, data: {analysis_id, task_id, status, media_info}}
          const taskResult = response.data || response;

          if (taskResult && (taskResult.analysis_id || taskResult.task_id)) {
            // 添加到轮询任务
            const pollingTask = addTask(taskResult);

            // 监听任务状态变化
            const checkInterval = setInterval(() => {
              const currentTask = getTaskByMediaId(file.id);

              if (currentTask) {
                updateTaskStatus(file.id, {
                  progress: currentTask.progress,
                });

                if (currentTask.status === 'completed') {
                  clearInterval(checkInterval);
                  updateTaskStatus(file.id, { status: 'completed', progress: 100, result: currentTask.result });

                  if (onTaskComplete) {
                    onTaskComplete(file.id, currentTask.result);
                  }
                } else if (currentTask.status === 'failed') {
                  clearInterval(checkInterval);
                  updateTaskStatus(file.id, { status: 'failed', error: currentTask.error });
                }
              }
            }, 1000);

            // 设置最大等待时间
            setTimeout(() => {
              clearInterval(checkInterval);
              const currentTask = getTaskByMediaId(file.id);
              if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed') {
                updateTaskStatus(file.id, { status: 'failed', error: '任务超时' });
              }
            }, 600000); // 10分钟超时
          }
        } catch (error: any) {
          updateTaskStatus(file.id, { status: 'failed', error: error.message });
        } finally {
          semaphore.release();
        }
      });

      // 等待所有任务完成（不包括轮询）
      await Promise.all(analysisPromises);

    } catch (error: any) {
      console.error("批量分析失败:", error);
      toast.error(`批量分析失败: ${error.message}`);
    } finally {
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  };

  // 监听任务完成
  useEffect(() => {
    if (state.isRunning && state.completed + state.failed === state.total && state.total > 0) {
      const successCount = state.completed;
      const failedCount = state.failed;

      toast.success(`批量分析完成！成功: ${successCount}，失败: ${failedCount}`);

      // 触发全局媒体更新事件
      window.dispatchEvent(new CustomEvent("media-updated"));
      localStorage.setItem("media-analysis-completed", Date.now().toString());

      setTimeout(() => {
        localStorage.removeItem("media-analysis-completed");
      }, 1000);
    }
  }, [state.isRunning, state.completed, state.failed, state.total]);

  const resetState = useCallback(() => {
    setState({
      tasks: [],
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0,
      total: 0,
      isRunning: false,
    });
  }, []);

  return {
    state,
    performBatchAnalysis,
    resetState,
    isPolling,
  };
}