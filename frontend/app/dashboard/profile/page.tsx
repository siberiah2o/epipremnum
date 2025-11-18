'use client'

import { useRouteGuard } from "@/hooks/useRouteGuard"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { User, Mail, Phone, Calendar, Camera, Save, Loader2, Eye, Edit3 } from "lucide-react"
import { useState, useEffect } from "react"

export default function ProfilePage() {
  useRouteGuard()
  const { user, userProfile, updateUserProfile } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    phone: "",
    avatar: "",
  })
  const [activeTab, setActiveTab] = useState("view")

  // 初始化表单数据
  useEffect(() => {
    if (user && userProfile) {
      setFormData({
        username: userProfile.username || user.username || "",
        phone: userProfile.phone || "",
        avatar: userProfile.avatar || "",
      })
    }
  }, [user, userProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // 验证用户名格式（3-20个字符，只允许字母、数字和下划线）
    if (formData.username && !/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
      toast.error("用户名必须是3-20个字符，只能包含字母、数字和下划线")
      setIsLoading(false)
      return
    }

    // 验证手机号格式（如果填写了）
    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      toast.error("请输入有效的11位手机号码")
      setIsLoading(false)
      return
    }

    // 验证头像URL格式（如果填写了）
    if (formData.avatar && !/^https?:\/\/.+/.test(formData.avatar)) {
      toast.error("请输入有效的头像URL地址")
      setIsLoading(false)
      return
    }

    try {
      const updateData = {
        username: formData.username,
        phone: formData.phone,
        avatar: formData.avatar,
      }

      const result = await updateUserProfile(updateData)

      if (result.success) {
        toast.success("资料更新成功！")
        setTimeout(() => setActiveTab("view"), 1500)
      } else {
        toast.error(result.message || "更新失败，请稍后重试")
      }
    } catch (err) {
      toast.error("更新过程中发生错误，请稍后重试")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const InfoItem = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | null | undefined }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="font-mono text-xs">{value || '未设置'}</p>
    </div>
  )

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
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">仪表板</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>用户管理</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-5">
          {/* 用户头像和基本信息 */}
          <Card className="border-2 bg-gradient-to-r from-background to-muted/20">
            <CardContent className="pt-3">
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* 头像区域 */}
                <div className="relative group">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="用户头像"
                      className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center border-4 border-primary/20 shadow-md">
                      <User className="w-12 h-12 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* 基本信息 */}
                <div className="text-center md:text-left flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-semibold">{user?.username}</h1>
                    <Badge variant="secondary" className="hidden sm:flex text-xs">
                      ID: {user?.id}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span className="text-sm">{user?.email}</span>
                    </div>
                    <Badge variant="outline" className="hidden sm:flex text-xs">
                      正常
                    </Badge>
                  </div>
                </div>

                {/* 状态徽章 */}
                <div className="flex flex-col gap-1">
                  <Badge variant="default" className="w-fit mx-auto md:ml-auto text-xs">
                    账户正常
                  </Badge>
                  <p className="text-xs text-muted-foreground text-center md:text-right">
                    {userProfile?.updated_at
                      ? `更新于 ${new Date(userProfile.updated_at).toLocaleDateString('zh-CN')}`
                      : '尚未更新'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab切换 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="view" className="flex items-center gap-2 text-sm">
                <Eye className="h-3 w-3" />
                查看资料
              </TabsTrigger>
              <TabsTrigger value="edit" className="flex items-center gap-2 text-sm">
                <Edit3 className="h-3 w-3" />
                编辑资料
              </TabsTrigger>
            </TabsList>

            {/* 查看资料Tab */}
            <TabsContent value="view" className="space-y-5 mt-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 账户信息 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4" />
                      账户信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <InfoItem
                      icon={User}
                      label="用户名"
                      value={user?.username}
                    />
                    <InfoItem
                      icon={Mail}
                      label="邮箱地址"
                      value={user?.email}
                    />
                    <InfoItem
                      icon={Camera}
                      label="头像URL"
                      value={user?.avatar}
                    />
                  </CardContent>
                </Card>

                {/* 联系信息 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Phone className="h-4 w-4" />
                      联系信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <InfoItem
                      icon={Phone}
                      label="手机号码"
                      value={userProfile?.phone}
                    />
                    <InfoItem
                      icon={Camera}
                      label="头像状态"
                      value={user?.avatar ? '已设置' : '未设置'}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* 时间信息 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    时间记录
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem
                      icon={Calendar}
                      label="注册时间"
                      value={userProfile?.created_at
                        ? new Date(userProfile.created_at).toLocaleString('zh-CN')
                        : '未知'
                      }
                    />
                    <InfoItem
                      icon={Calendar}
                      label="最后更新"
                      value={userProfile?.updated_at
                        ? new Date(userProfile.updated_at).toLocaleString('zh-CN')
                        : '未知'
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 编辑资料Tab */}
            <TabsContent value="edit" className="mt-5">
              <Card>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* 编辑表单 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <h3 className="text-base font-medium">基本信息</h3>

                        <div className="space-y-1">
                          <Label htmlFor="username">用户名</Label>
                          <Input
                            id="username"
                            name="username"
                            type="text"
                            placeholder="请输入3-20位用户名"
                            value={formData.username}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            className="font-mono h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            3-20个字符，只能包含字母、数字和下划线
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="email">邮箱地址</Label>
                          <Input
                            id="email"
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="font-mono bg-muted h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            邮箱地址不可修改
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-base font-medium">联系方式</h3>

                        <div className="space-y-1">
                          <Label htmlFor="phone">手机号码</Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            placeholder="请输入11位手机号"
                            value={formData.phone}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            className="font-mono h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            请输入有效的11位手机号码（可选）
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="avatar">头像URL</Label>
                          <Input
                            id="avatar"
                            name="avatar"
                            type="url"
                            placeholder="https://example.com/avatar.jpg"
                            value={formData.avatar}
                            onChange={handleInputChange}
                            disabled={isLoading}
                            className="font-mono h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            请输入有效的图片URL地址（可选）
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 提交按钮 */}
                    <div className="flex justify-end pt-4 border-t">
                      <Button type="submit" disabled={isLoading} className="min-w-[100px] h-9 text-sm">
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            更新中...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-3 w-3" />
                            保存更改
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}