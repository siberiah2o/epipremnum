"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAIAnalysisPolling } from "./use-ai-analysis-polling";
import { toast } from "sonner";
import type { MediaListItem } from "@/lib/api";

interface SyncBatchAnalysisTask {
  id: number;
  mediaId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: any;
}

interface SyncBatchAnalysisState {
  tasks: SyncBatchAnalysisTask[];
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  total: number;
  isRunning: boolean;
  currentTaskIndex: number;
  startTime?: Date;
}

export function useSyncBatchAnalysis() {
  const [state, setState] = useState<SyncBatchAnalysisState>({
    tasks: [],
    completed: 0,
    failed: 0,
    processing: 0,
    pending: 0,
    total: 0,
    isRunning: false,
    currentTaskIndex: 0,
  });

  const { addTask, getTaskByMediaId, cleanup } = useAIAnalysisPolling();

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 等待单个任务完成的辅助函数
  const waitForTaskCompletion = useCallback(async (mediaId: number, analysisId: number, maxWaitTime: number = 600000): Promise<boolean> => {
    const startTime = Date.now();
    const checkInterval = 1000; // 每秒检查一次

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await apiClient.getAIAnalysisStatus(analysisId);

        if (response.data && response.data.data) {
          const analysisData = response.data.data;

          console.log(`任务 ${analysisId} 状态:`, analysisData.status);

          // 更新进度
          const progress = analysisData.status === 'completed' ? 100 :
                         analysisData.status === 'processing' ? 50 :
                         analysisData.status === 'failed' ? 0 : 20;

          setState((prev) => {
            const updatedTasks = prev.tasks.map((task) =>
              task.mediaId === mediaId ? { ...task, progress } : task
            );
            return { ...prev, tasks: updatedTasks };
          });

          if (analysisData.status === 'completed') {
            console.log(`任务 ${analysisId} 完成，结果:`, analysisData);

            setState((prev) => {
              const updatedTasks = prev.tasks.map((task) =>
                task.mediaId === mediaId ? {
                  ...task,
                  status: 'completed',
                  progress: 100,
                  result: analysisData
                } : task
              );
              return { ...prev, tasks: updatedTasks };
            });

            return true;
          } else if (analysisData.status === 'failed') {
            console.error(`任务 ${analysisId} 失败:`, analysisData.error_message);

            setState((prev) => {
              const updatedTasks = prev.tasks.map((task) =>
                task.mediaId === mediaId ? {
                  ...task,
                  status: 'failed',
                  error: analysisData.error_message || '分析失败'
                } : task
              );
              return { ...prev, tasks: updatedTasks };
            });

            return false;
          }
        }

        // 等待指定时间后再次检查
        await new Promise(resolve => setTimeout(resolve, checkInterval));

      } catch (error) {
        console.error(`检查任务 ${analysisId} 状态失败:`, error);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    // 超时处理
    console.error(`任务 ${analysisId} 等待超时`);
    setState((prev) => {
      const updatedTasks = prev.tasks.map((task) =>
        task.mediaId === mediaId ? {
          ...task,
          status: 'failed',
          error: '任务超时'
        } : task
      );
      return { ...prev, tasks: updatedTasks };
    });

    return false;
  }, [apiClient]);

  // 更新任务状态
  const updateTaskStatus = useCallback((mediaId: number, updates: Partial<SyncBatchAnalysisTask>) => {
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

  // 执行同步批量分析（一个接一个处理）
  const performSyncBatchAnalysis = async (
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
        currentTaskIndex: 0,
        startTime: new Date(),
      });

      toast.info(`开始顺序分析 ${imageFiles.length} 张图片，每张完成后才开始下一张...`);

      // 顺序处理，一个接一个分析
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];

        try {
          console.log(`开始分析第 ${i + 1}/${imageFiles.length} 张图片: ${file.id}`);

          // 更新状态为处理中
          updateTaskStatus(file.id, { status: 'processing', progress: 20 });
          setState((prev) => ({ ...prev, currentTaskIndex: i }));

          // 发起分析请求
          const response = await apiClient.analyzeSingle(
            file.id,
            modelName,
            {
              generate_title: options.generate_title ?? true,
              generate_description: options.generate_description ?? true,
              generate_prompt: options.generate_prompt ?? false,
              generate_categories: options.generate_categories ?? true,
              generate_tags: options.generate_tags ?? true,
              max_categories: options.max_categories ?? 3, // 减少默认数量
              max_tags: options.max_tags ?? 5, // 减少默认数量
              limited_scenarios: options.limited_scenarios ?? true, // 启用有限场景
              confidence_threshold: options.confidence_threshold ?? 0.7, // 置信度阈值
            }
          );

          if (response.data && response.data.data) {
            const analysisData = response.data.data;
            console.log(`图片 ${file.id} 分析请求已提交，分析ID: ${analysisData.analysis_id}`);

            // 同步等待这个任务完成
            const success = await waitForTaskCompletion(file.id, analysisData.analysis_id);

            if (success) {
              console.log(`图片 ${file.id} 分析成功完成`);

              const currentTask = getTaskByMediaId(file.id);
              if (currentTask && currentTask.result) {
                if (onTaskComplete) {
                  onTaskComplete(file.id, currentTask.result);
                }
              }
            } else {
              console.log(`图片 ${file.id} 分析失败`);
            }

            // 在处理下一个任务之前，添加短暂延迟，避免过于频繁的请求
            if (i < imageFiles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            console.error('分析请求响应格式错误:', response);
            throw new Error(`分析请求失败：响应数据格式错误，响应: ${JSON.stringify(response)}`);
          }
        } catch (error: any) {
          console.error(`图片 ${file.id} 分析失败:`, error);
          updateTaskStatus(file.id, { status: 'failed', error: error.message });
          toast.error(`图片 ${file.id} 分析失败: ${error.message}`);
        }
      }

      // 所有任务完成
      const finalState = state;
      const successCount = finalState.completed;
      const failedCount = finalState.failed;

      toast.success(`批量分析完成！成功: ${successCount}，失败: ${failedCount}`);

      if (onJobComplete) {
        onJobComplete(successCount, failedCount);
      }

      // 触发全局媒体更新事件
      window.dispatchEvent(new CustomEvent("media-updated"));
      localStorage.setItem("media-analysis-completed", Date.now().toString());

      setTimeout(() => {
        localStorage.removeItem("media-analysis-completed");
      }, 1000);

    } catch (error: any) {
      console.error("同步批量分析失败:", error);
      toast.error(`批量分析失败: ${error.message}`);
    } finally {
      setState((prev) => ({ ...prev, isRunning: false, currentTaskIndex: 0 }));
    }
  };

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      tasks: [],
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0,
      total: 0,
      isRunning: false,
      currentTaskIndex: 0,
    });
  }, []);

  return {
    state,
    performSyncBatchAnalysis,
    resetState,
  };
}