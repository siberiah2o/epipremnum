'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // 如果已登录，不渲染任何内容（将重定向到dashboard）
  if (isAuthenticated) {
    return null
  }

  // 未登录用户看到欢迎页面
  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">欢迎使用 Epipremnum</CardTitle>
          <CardDescription>
            用户管理系统 - 基于 Next.js 和 shadcn/ui 构建
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/login">
              <Button className="w-full" variant="default">
                登录
              </Button>
            </Link>
            <Link href="/register">
              <Button className="w-full" variant="outline">
                注册
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>请登录或注册以开始使用</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}