'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient, User, UserProfile, LoginData, RegisterData } from '@/lib/api'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginData) => Promise<{ success: boolean; message: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  refreshUserProfile: () => Promise<void>
  updateUserProfile: (data: any) => Promise<{ success: boolean; message: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (apiClient.isAuthenticated()) {
          // 尝试获取保存的用户信息
          const savedUser = apiClient.getSavedUser()
          if (savedUser) {
            setUser(savedUser)
          }

          // 验证 token 是否仍然有效并获取最新用户信息
          try {
            const userResponse = await apiClient.getCurrentUser()
            if (userResponse.code === 200 && userResponse.data) {
              setUser(userResponse.data)
              apiClient.saveUser(userResponse.data)

              // 同时获取用户详细资料
              await refreshUserProfile()
            }
          } catch (error) {
            console.error('Token 验证失败:', error)
            // Token 无效，清除本地存储
            apiClient.clearTokens()
            apiClient.clearUser()
            setUser(null)
            setUserProfile(null)
          }
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  // 登录函数
  const login = async (data: LoginData): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.login(data)

      if (response.code === 200 && response.data) {
        const { user: userData } = response.data
        setUser(userData)
        apiClient.saveUser(userData)

        // 获取用户详细资料
        await refreshUserProfile()

        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message || '登录失败' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败'
      return { success: false, message }
    }
  }

  // 注册函数
  const register = async (data: RegisterData): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.register(data)

      if (response.code === 201 && response.data) {
        const { user: userData } = response.data
        setUser(userData)
        apiClient.saveUser(userData)

        // 获取用户详细资料
        await refreshUserProfile()

        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message || '注册失败' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败'
      return { success: false, message }
    }
  }

  // 登出函数
  const logout = async (): Promise<void> => {
    try {
      await apiClient.logout()
    } catch (error) {
      console.error('登出请求失败:', error)
      // 即使服务器端登出失败，也要清除本地状态
    } finally {
      // 清除本地状态
      apiClient.clearTokens()
      apiClient.clearUser()
      setUser(null)
      setUserProfile(null)
    }
  }

  // 刷新用户详细资料
  const refreshUserProfile = async (): Promise<void> => {
    try {
      const profileResponse = await apiClient.getUserProfile()
      if (profileResponse.code === 200 && profileResponse.data) {
        setUserProfile(profileResponse.data)
      }
    } catch (error) {
      console.error('获取用户详细资料失败:', error)
    }
  }

  // 更新用户资料
  const updateUserProfile = async (data: any): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.updateProfile(data)

      if (response.code === 200 && response.data) {
        setUserProfile(response.data)

        // 同时更新基础用户信息
        const updatedUser: User = {
          id: response.data.id,
          username: response.data.username,
          email: response.data.email,
          avatar: response.data.avatar,
        }
        setUser(updatedUser)
        apiClient.saveUser(updatedUser)

        return { success: true, message: response.message }
      } else {
        return { success: false, message: response.message || '更新资料失败' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新资料失败'
      return { success: false, message }
    }
  }

  const value: AuthContextType = {
    user,
    userProfile,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUserProfile,
    updateUserProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 自定义 hook 来使用认证上下文
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return context
}