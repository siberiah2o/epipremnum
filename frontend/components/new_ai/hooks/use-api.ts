import { useState, useCallback } from "react";

// 使用相对路径，通过Next.js代理访问后端
const API_BASE_URL = "";

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取认证token
  const getAuthToken = useCallback(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token")
      );
    }
    return null;
  }, []);

  // API请求头
  const getHeaders = useCallback(() => {
    const token = getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, [getAuthToken]);

  // 通用API请求函数
  const apiRequest = useCallback(
    async (
      url: string,
      options: RequestInit = {},
      timeoutMs: number = 30000 // 默认30秒超时
    ) => {
      try {
        setLoading(true);
        setError(null);

        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${API_BASE_URL}${url}`, {
          headers: getHeaders(),
          signal: controller.signal,
          ...options,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            // 认证失败不抛出错误，返回特殊结构让调用方处理
            return {
              authError: true,
              message: "认证失败，请重新登录",
              status: 401
            };
          } else if (response.status === 403) {
            throw new Error("权限不足");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 只有在响应成功时才尝试解析JSON
        try {
          return await response.json();
        } catch (parseError) {
          throw new Error("响应格式错误，无法解析JSON");
        }
      } catch (err: any) {
        let errorMessage = err.message || "请求失败";
        if (err.name === "AbortError") {
          errorMessage = `请求超时，请检查网络连接 (${timeoutMs / 1000}秒)`;
        }
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getHeaders]
  );

  return {
    loading,
    error,
    setError,
    apiRequest,
    getAuthToken,
    getHeaders,
  };
};
