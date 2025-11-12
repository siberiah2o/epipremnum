'use client'

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { User, Mail, Phone, Calendar, Settings, LogOut } from "lucide-react"

export default function DashboardPage() {
  const { user, userProfile, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  仪表板
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>概览</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* 欢迎信息 */}
          <div className="text-center">
            <h1 className="text-3xl font-bold">
              欢迎回来，{user?.username}！
            </h1>
            <p className="text-muted-foreground mt-2">
              这是您的个人仪表板
            </p>
          </div>

          {/* 用户信息卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">用户名</span>
                  </div>
                  <p className="font-medium">{user?.username}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">邮箱</span>
                  </div>
                  <p className="font-medium">{user?.email}</p>
                </div>

                {userProfile?.phone && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">手机号</span>
                    </div>
                    <p className="font-medium">{userProfile.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  账户信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">注册时间</span>
                  <p className="font-medium">
                    {userProfile?.created_at &&
                      new Date(userProfile.created_at).toLocaleDateString('zh-CN')
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">最后更新</span>
                  <p className="font-medium">
                    {userProfile?.updated_at &&
                      new Date(userProfile.updated_at).toLocaleDateString('zh-CN')
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">账户状态</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <p className="font-medium">正常</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>
                常用的账户管理功能
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline">
                  <Settings className="mr-2 h-4 w-4" />
                  编辑资料
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/test')
                      const data = await response.json()
                      console.log('后端测试结果:', data)
                      alert(`后端连接: ${data.success ? '成功' : '失败'}`)
                    } catch (error) {
                      console.error('测试失败:', error)
                      alert('测试失败: ' + error)
                    }
                  }}
                >
                  测试后端连接
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
