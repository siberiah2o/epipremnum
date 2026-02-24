'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, userApi } from '@/lib/api-client';
import type { User, RegisterRequest } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendError: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterRequest) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [backendError, setBackendError] = useState(false);

  // 刷新用户信息 - 使用 useCallback 避免依赖问题
  const refreshUser = useCallback(async () => {
    try {
      const response = await userApi.getProfile();
      // 连接成功，清除错误状态
      setBackendError(false);

      if (response.code === 200) {
        setUser(response.data);
        setIsAuthenticated(true);
      } else if (response.code === 401) {
        // 认证失败，清除状态
        setUser(null);
        setIsAuthenticated(false);
      }
      // 检查是否是后端连接错误
      if (response.message?.includes('ECONNREFUSED') ||
          response.message?.includes('fetch failed') ||
          response.code === 500) {
        setBackendError(true);
      }
    } catch (error: any) {
      console.error('Failed to fetch user profile:', error);
      // 检测是否是连接错误
      if (error?.message?.includes('fetch') || error?.message?.includes('ECONNREFUSED')) {
        setBackendError(true);
      }
    }
  }, []);

  // 初始化：尝试获取用户信息（如果有 Cookie）
  useEffect(() => {
    const initAuth = async () => {
      await refreshUser();
      setIsLoading(false);
    };

    initAuth();
  }, [refreshUser]);

  // 登录
  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);

      if (response.code === 200 && response.data) {
        // API 路由已经设置了 HttpOnly Cookie
        // 只需要保存用户信息并更新认证状态
        setUser(response.data.user);
        setIsAuthenticated(true);
        return { success: true, message: response.message };
      }

      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '登录失败，请稍后重试'
      };
    }
  };

  // 注册
  const register = async (data: RegisterRequest) => {
    try {
      const response = await authApi.register(data);

      if (response.code === 201) {
        return { success: true, message: response.message };
      }

      return { success: false, message: response.message || response.detail || '注册失败' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '注册失败，请稍后重试'
      };
    }
  };

  // 登出
  const logout = async () => {
    try {
      // 调用 logout API 清除 Cookie
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 无论是否成功，都清除本地状态
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    backendError,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
