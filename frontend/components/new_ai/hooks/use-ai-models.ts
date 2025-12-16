import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useApi } from "./use-api";
import { OllamaModel, ModelStatistics } from "../types/ai";

export const useAIModels = () => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { apiRequest, error, setError } = useApi();

  // 获取模型列表 - 获取默认端点的模型
  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/endpoint/models/");

      // 检查是否是认证失败的响应
      if (data && data.authError) {
        toast.error(data.message);
        setModels([]);
        return;
      }

      // API返回格式: {code:200, message:"...", data:[...]}
      setModels(data.data || []);
    } catch (err: any) {
      console.error("获取模型失败:", err);
      setError("无法获取模型列表: " + err.message);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, setError]);

  // 刷新模型 - 直接重新获取，因为模型数据应该通过其他方式同步
  const refreshModels = useCallback(
    async () => {
      setIsRefreshing(true);
      setError(null);

      try {
        await fetchModels(); // 重新获取模型列表
        toast.success("模型列表已刷新");
      } catch (err: any) {
        console.error("刷新模型失败:", err);
        setError("刷新模型失败: " + err.message);
        toast.error("刷新模型失败: " + err.message);
      } finally {
        setIsRefreshing(false);
      }
    },
    [fetchModels, setError]
  );

  // 获取模型统计
  const getModelStats = useCallback((): ModelStatistics => {
    const total = models.length;
    const active = models.filter((model) => model.is_active).length;
    const vision = models.filter((model) => model.is_vision_capable).length;

    return { total, active, vision };
  }, [models]);

  // 初始化
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    loading,
    isRefreshing,
    error,
    fetchModels,
    refreshModels,
    getModelStats,
  };
};
