'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

// 受保护的路由列表
const protectedRoutes = ['/profile', '/dashboard', '/settings']
const authRoutes = ['/login', '/register']

export function useRouteGuard() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return

    const isProtectedRoute = protectedRoutes.some(route =>
      pathname.startsWith(route)
    )
    const isAuthRoute = authRoutes.includes(pathname)

    // 如果访问受保护的路由但未认证，重定向到登录页面
    if (isProtectedRoute && !isAuthenticated) {
      const redirectUrl = encodeURIComponent(pathname)
      router.push(`/login?redirect=${redirectUrl}`)
      return
    }

    // 如果已认证但访问认证页面，重定向到首页
    if (isAuthRoute && isAuthenticated) {
      // 检查是否有重定向参数
      const urlParams = new URLSearchParams(window.location.search)
      const redirect = urlParams.get('redirect')

      if (redirect) {
        // 有重定向参数，跳转到目标页面
        router.push(decodeURIComponent(redirect))
      } else {
        // 没有重定向参数，跳转到首页
        router.push('/')
      }
      return
    }
  }, [isLoading, isAuthenticated, pathname, router])
}