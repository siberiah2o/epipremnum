import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useApi } from "./use-api";
import { ConnectionState } from "../types/ai";

export const useAIConnection = () => {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionState>("idle");
  const [isTesting, setIsTesting] = useState(false);
  const { apiRequest } = useApi();

  // 测试连接
  const testConnection = useCallback(
    async (endpointId: number) => {
      setConnectionStatus("checking");
      setIsTesting(true);

      try {
        // 连接测试可能需要较长时间，设置30秒超时
        const result = await apiRequest(
          `/api/ollama/endpoints/${endpointId}/test_connection/`,
          {
            method: "POST",
          },
          30000
        );

        // 检查是否是认证失败的响应
        if (result && result.authError) {
          setConnectionStatus("failed");
          toast.error(result.message);
          return false;
        }

        setConnectionStatus("connected");
        toast.success("连接测试成功");
        return true;
      } catch (err: any) {
        console.error("连接测试失败:", err);
        setConnectionStatus("failed");
        toast.error("连接测试失败");
        return false;
      } finally {
        setIsTesting(false);
      }
    },
    [apiRequest]
  );

  // 重置连接状态
  const resetConnectionStatus = useCallback(() => {
    setConnectionStatus("idle");
  }, []);

  return {
    connectionStatus,
    isTesting,
    testConnection,
    resetConnectionStatus,
  };
};
