"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { concurrentRequestManager } from "@/lib/ai-service";
import { filterAnalysisResult } from "@/lib/analysis-filter";
import type { MediaFile, AIAnalysisOptions } from "../types/analysis";

export function useAiAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 执行AI分析
  const performAnalysis = async (
    file: MediaFile,
    modelName: string,
    options: AIAnalysisOptions = {},
    onAnalysisComplete?: (updatedFile: MediaFile) => void
  ) => {
    if (!modelName) {
      setAnalysisError("请选择一个AI模型");
      return;
    }

    try {
      setAnalyzing(true);
      setAnalysisError(null);

      // 使用并发管理器执行请求
      const requestFn = () => apiClient.analyzeSingle(file.id, modelName, {
        generate_title: options.generate_title ?? true,
        generate_description: options.generate_description ?? true,
        generate_prompt: options.generate_prompt ?? false, // 默认不生成prompt以提高速度
        generate_categories: options.generate_categories ?? true,
        generate_tags: options.generate_tags ?? true,
        max_categories: options.max_categories ?? 3, // 减少到3个分类
        max_tags: options.max_tags ?? 5, // 减少到5个标签
        // 注意：limited_scenarios 和 confidence_threshold 只在前端使用，不发送到后端
      });

      const response = await concurrentRequestManager.executeRequest(requestFn, file.id, modelName);

      if (response.data) {
        // 原始分析结果
        const rawResult = response.data;

        // 应用前端过滤
        const filteredResult = filterAnalysisResult({
          title: rawResult.title,
          description: rawResult.description,
          categories: rawResult.categories || rawResult.ai_categories,
          tags: rawResult.tags || rawResult.ai_tags,
          prompt: rawResult.prompt || rawResult.ai_prompt
        }, options);

        console.log(`🔍 [AI分析] 过滤统计:`, filteredResult.filter_stats);

        // 分析完成后，更新文件信息
        const updatedFile: MediaFile = {
          ...file,
          ...rawResult,
          // 使用过滤后的结果覆盖原始的分类和标签
          ai_categories: filteredResult.filtered_categories,
          ai_tags: filteredResult.filtered_tags,
          ai_analyzed_at: new Date().toISOString(),
        };

        // 调用回调函数，更新父组件中的文件状态
        if (onAnalysisComplete) {
          onAnalysisComplete(updatedFile);
        }
      }
    } catch (err: any) {
      console.error("AI分析失败:", err);
      let errorMessage = err.message || "AI分析失败";

      // 针对并发错误提供更友好的提示
      if (errorMessage.includes('请求过于频繁') ||
          errorMessage.includes('分析请求过于频繁')) {
        errorMessage = "当前分析请求较多，请稍后重试";
      }

      setAnalysisError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzing,
    analysisError,
    performAnalysis,
    setAnalysisError,
  };
}
