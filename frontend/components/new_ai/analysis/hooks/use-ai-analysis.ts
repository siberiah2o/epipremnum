"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";
import { concurrentRequestManager } from "@/lib/ai-service";
import type { MediaFile } from "../types/analysis";

export function useAiAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // 执行AI分析
  const performAnalysis = async (
    file: MediaFile,
    modelName: string,
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
      const requestFn = () => apiClient.analyzeSingle(file.id, modelName, true, {
        generate_title: true,
        generate_description: true,
        generate_prompt: false, // 默认不生成prompt以提高速度
        generate_categories: true,
        generate_tags: true,
        max_categories: 5,
        max_tags: 10,
      });

      const response = await concurrentRequestManager.executeRequest(requestFn, file.id, modelName);

      if (response.data) {
        // 分析完成后，更新文件信息
        const updatedFile: MediaFile = {
          ...file,
          ...response.data,
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
