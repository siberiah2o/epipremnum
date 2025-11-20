import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useApi } from "./use-api";
import { OllamaEndpoint, CreateEndpointRequest } from "../types/ai";

export const useAIEndpoints = () => {
  const [endpoints, setEndpoints] = useState<OllamaEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiRequest, error, setError } = useApi();

  // 获取端点列表
  const fetchEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/ollama/endpoint/");
      // API返回格式: {code:200, message:"...", data:{endpoints:[...], total:number}}
      setEndpoints(data.data?.endpoints || []);
    } catch (err: any) {
      console.error("获取端点失败:", err);
      if (err.status === 401) {
        toast.error("认证失败，请重新登录");
      }
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  // 创建端点
  const createEndpoint = useCallback(
    async (data: CreateEndpointRequest) => {
      try {
        await apiRequest("/api/ollama/endpoint/", {
          method: "POST",
          body: JSON.stringify(data),
        });

        toast.success("端点创建成功");
        await fetchEndpoints();
        return true;
      } catch (err: any) {
        console.error("创建端点失败:", err);
        toast.error("创建端点失败");
        return false;
      }
    },
    [apiRequest, fetchEndpoints]
  );

  // 更新端点
  const updateEndpoint = useCallback(
    async (id: number, data: CreateEndpointRequest) => {
      try {
        await apiRequest(`/api/ollama/endpoint/${id}/`, {
          method: "POST",
          body: JSON.stringify(data),
        });

        toast.success("端点更新成功");
        await fetchEndpoints();
        return true;
      } catch (err: any) {
        console.error("更新端点失败:", err);
        toast.error("更新端点失败");
        return false;
      }
    },
    [apiRequest, fetchEndpoints]
  );

  // 删除端点
  const deleteEndpoint = useCallback(
    async (endpoint: OllamaEndpoint) => {
      if (endpoint.is_default) {
        toast.error("默认端点不能删除");
        return false;
      }

      const confirmMessage = `确定要删除端点"${endpoint.name}"吗？

端点地址: ${endpoint.url}

此操作无法撤销。`;

      if (!confirm(confirmMessage)) return false;

      try {
        await apiRequest(`/api/ollama/endpoint/${endpoint.id}/delete/`, {
          method: "POST",
        });

        toast.success(`端点 "${endpoint.name}" 删除成功`);
        await fetchEndpoints();
        return true;
      } catch (err: any) {
        console.error("删除端点失败:", err);
        toast.error("删除端点失败");
        return false;
      }
    },
    [apiRequest, fetchEndpoints]
  );

  // 测试端点连接
  const testEndpoint = useCallback(
    async (endpointId: number) => {
      try {
        // 端点连接测试可能需要较长时间，设置30秒超时
        const result = await apiRequest(
          `/api/ollama/endpoint/${endpointId}/test/`,
          {},
          30000
        );
        toast.success(result.message || "端点连接成功");
        return true;
      } catch (err: any) {
        toast.error("端点连接失败");
        return false;
      }
    },
    [apiRequest]
  );

  // 获取默认端点
  const getDefaultEndpoint = useCallback(() => {
    return endpoints.find((ep) => ep.is_default);
  }, [endpoints]);

  // 初始化
  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  return {
    endpoints,
    loading,
    error,
    fetchEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
    testEndpoint,
    getDefaultEndpoint,
  };
};
