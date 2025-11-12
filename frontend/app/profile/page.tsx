'use client'

import { useState, useEffect } from 'react'
import { useRouteGuard } from '@/hooks/useRouteGuard'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, User, Mail, Phone, Calendar } from 'lucide-react'

// 更新资料表单验证模式
const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少3位字符')
    .max(20, '用户名最多20位字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  phone: z
    .string()
    .min(11, '请输入11位手机号')
    .max(11, '请输入11位手机号')
    .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号'),
  avatar: z.string().url('请输入有效的头像URL').optional().or(z.literal('')),
})

type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>

export default function ProfilePage() {
  // 路由保护
  useRouteGuard()

  const router = useRouter()
  const { user, userProfile, isAuthenticated, updateUserProfile, logout } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      username: '',
      phone: '',
      avatar: '',
    },
  })

  // 初始化表单数据
  useEffect(() => {
    if (userProfile) {
      form.reset({
        username: userProfile.username,
        phone: userProfile.phone || '',
        avatar: userProfile.avatar || '',
      })
    }
  }, [userProfile, form])

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  const onSubmit = async (data: UpdateProfileFormValues) => {
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await updateUserProfile({
        ...data,
        avatar: data.avatar || null,
      })

      if (result.success) {
        setMessage({ type: 'success', text: result.message })
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (err) {
      setMessage({ type: 'error', text: '更新资料过程中发生错误，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (!isAuthenticated || !user || !userProfile) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">用户资料</h1>
          <p className="text-muted-foreground">查看和管理您的个人信息</p>
        </div>

        {/* 基本信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
            <CardDescription>
              您的账户基本信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  用户名
                </label>
                <p className="text-sm text-muted-foreground">{user.username}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  邮箱
                </label>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 更新资料表单 */}
        <Card>
          <CardHeader>
            <CardTitle>更新资料</CardTitle>
            <CardDescription>
              更新您的个人信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            {message && (
              <Alert
                variant={message.type === 'success' ? 'default' : 'destructive'}
                className="mb-4"
              >
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入用户名"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手机号</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入手机号"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>头像URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入头像URL"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLoading ? '更新中...' : '更新资料'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 账户信息 */}
        <Card>
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
            <CardDescription>
              您的账户创建时间等信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  注册时间
                </label>
                <p className="text-sm text-muted-foreground">
                  {new Date(userProfile.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  最后更新
                </label>
                <p className="text-sm text-muted-foreground">
                  {new Date(userProfile.updated_at).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            {userProfile.phone && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  手机号
                </label>
                <p className="text-sm text-muted-foreground">{userProfile.phone}</p>
              </div>
            )}

            {userProfile.avatar && (
              <div className="space-y-2">
                <label className="text-sm font-medium">当前头像</label>
                <div className="flex items-center gap-4">
                  <img
                    src={userProfile.avatar}
                    alt="用户头像"
                    className="h-16 w-16 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = ''
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 危险操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">危险操作</CardTitle>
            <CardDescription>
              这些操作会影响您的账户安全
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout}>
              退出登录
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}