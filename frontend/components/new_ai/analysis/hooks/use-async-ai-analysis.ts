"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAIAnalysisPolling } from "./use-ai-analysis-polling";
import type { MediaFile } from "../types/analysis";
import { toast } from "sonner";

export function useAsyncAIAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingMediaId, setAnalyzingMediaId] = useState<number | null>(null);
  const { addTask, getTaskByMediaId, cleanupOldTasks, cleanup, isPolling } =
    useAIAnalysisPolling();

  // 定期清理旧任务
  useEffect(() => {
    const interval = setInterval(cleanupOldTasks, 60000); // 每分钟清理一次
    return () => clearInterval(interval);
  }, [cleanupOldTasks]);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 执行异步AI分析
  const performAsyncAnalysis = async (
    file: MediaFile,
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
    onAnalysisComplete?: (updatedFile: MediaFile, result: any) => void,
    onProgress?: (progress: number) => void
  ) => {
    if (!modelName) {
      setAnalysisError("请选择一个AI模型");
      return;
    }

    try {
      setAnalyzing(true);
      setAnalyzingMediaId(file.id);
      setAnalysisError(null);

      // 发起分析请求
      const response = await apiClient.analyzeSingle(file.id, modelName, {
        generate_title: options.generate_title ?? true,
        generate_description: options.generate_description ?? true,
        generate_prompt: options.generate_prompt ?? false,
        generate_categories: options.generate_categories ?? true,
        generate_tags: options.generate_tags ?? true,
        max_categories: options.max_categories ?? 3, // 减少默认数量
        max_tags: options.max_tags ?? 5, // 减少默认数量
        limited_scenarios: options.limited_scenarios ?? true, // 启用有限场景
        confidence_threshold: options.confidence_threshold ?? 0.7, // 置信度阈值
      });

      // 处理新的API响应格式: {code, message, data: {analysis_id, task_id, status, media_info}}
      const taskResult = response.data || response;

      if (taskResult && (taskResult.analysis_id || taskResult.task_id)) {
        // 添加到轮询任务，传入回调函数
        const task = addTask(
          taskResult,
          // 完成回调
          (completedTask) => {
            console.log(`🔍 [ASYNC] 轮询回调：任务完成，重置分析状态`);
            setAnalyzing(false);
            setAnalyzingMediaId(null);

            const result = completedTask.result;
            // 处理新的API响应格式，可能包含在data字段中
            const analysisData = result.data || result;

            const updatedFile: MediaFile = {
              ...file,
              title:
                analysisData.media_info?.title ||
                analysisData.title ||
                file.title,
              description:
                analysisData.media_info?.description ||
                analysisData.description ||
                file.description,
              ai_description:
                analysisData.description || analysisData.ai_description,
              ai_prompt: analysisData.prompt || analysisData.ai_prompt,
              ai_categories:
                analysisData.suggested_categories ||
                analysisData.categories ||
                [],
              ai_tags: analysisData.suggested_tags || analysisData.tags || [],
              ai_analyzed_at: completedTask.completedAt?.toISOString(),
            };

            toast.success("图片分析完成！");

            if (onAnalysisComplete) {
              onAnalysisComplete(updatedFile, analysisData);
            }
          },
          // 错误回调
          (failedTask) => {
            console.log(`🔍 [ASYNC] 轮询回调：任务失败，重置分析状态`);
            setAnalyzing(false);
            setAnalyzingMediaId(null);
            setAnalysisError(failedTask.error || "分析失败");
            toast.error(failedTask.error || "图片分析失败");
          }
        );

        toast.success("分析任务已启动，正在后台处理...");

        // 设置最大等待时间（10分钟），防止无限等待
        setTimeout(() => {
          const currentTask = getTaskByMediaId(file.id);
          if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed') {
            console.log(`🔍 [ASYNC] 任务超时，重置分析状态`);
            setAnalyzing(false);
            setAnalyzingMediaId(null);
            setAnalysisError("分析任务超时，请重试");
            toast.error("分析任务超时，请重试");
          }
        }, 600000);
      } else {
        // 如果没有返回有效的任务ID，重置analyzing状态
        setAnalyzing(false);
        setAnalyzingMediaId(null);
        throw new Error("创建分析任务失败，未返回任务ID");
      }
    } catch (err: any) {
      console.error("AI分析失败:", err);
      const errorMessage = err.message || "AI分析失败";
      setAnalysisError(errorMessage);
      setAnalyzing(false);
      setAnalyzingMediaId(null);
      toast.error(errorMessage);
    }
  };

  // 获取分析状态
  const getAnalysisStatus = (mediaId: number) => {
    return getTaskByMediaId(mediaId);
  };

  return {
    analyzing,
    analyzingMediaId,
    analysisError,
    isPolling,
    performAsyncAnalysis,
    getAnalysisStatus,
    setAnalysisError,
  };
}
