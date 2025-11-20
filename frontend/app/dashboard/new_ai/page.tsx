"use client";

import { useRouteGuard } from "@/hooks/useRouteGuard";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Settings,
  Activity,
  ArrowRight,
  Image,
  Layers,
  BarChart3,
} from "lucide-react";

export default function NewAIPage() {
  useRouteGuard();

  const features = [
    {
      title: "模型管理",
      description: "管理和配置AI模型，设置服务端点",
      icon: <Settings className="h-8 w-8 text-blue-600" />,
      href: "/dashboard/new_ai/models",
      color: "border-blue-200 bg-blue-50 hover:bg-blue-100",
      badge: "已集成",
    },
    {
      title: "图片分析",
      description: "智能识别图片内容，自动生成标签",
      icon: <Image className="h-8 w-8 text-green-600" />,
      href: "/dashboard/new_ai/analysis",
      color: "border-green-200 bg-green-50 hover:bg-green-100",
      badge: "推荐",
    },
    {
      title: "批量处理",
      description: "一次性处理多张图片，提升效率",
      icon: <Layers className="h-8 w-8 text-purple-600" />,
      href: "/dashboard/new_ai/batch",
      color: "border-purple-200 bg-purple-50 hover:bg-purple-100",
      badge: "高效率",
    },
    {
      title: "使用统计",
      description: "查看AI使用情况和数据分析",
      icon: <BarChart3 className="h-8 w-8 text-orange-600" />,
      href: "/dashboard/new_ai/stats",
      color: "border-orange-200 bg-orange-50 hover:bg-orange-100",
      badge: "数据",
    },
  ];

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
                <BreadcrumbLink href="/dashboard">仪表板</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>新AI工作台</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-6">
          {/* 页面标题 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">新AI工作台</h1>
              <Badge variant="secondary" className="text-sm">
                智能分析
              </Badge>
            </div>
            <p className="text-muted-foreground text-lg">
              下一代智能媒体分析平台，提供更强大的AI功能和更好的用户体验
            </p>
          </div>

          {/* 功能卡片网格 */}
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <Card
                key={index}
                className={`group cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${feature.color}`}
                onClick={() => (window.location.href = feature.href)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {feature.icon}
                      <div>
                        <CardTitle className="text-xl">
                          {feature.title}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {feature.description}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    进入功能
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 状态概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                系统状态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">服务状态</p>
                    <p className="text-sm text-muted-foreground">正常运行</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">AI模型</p>
                    <p className="text-sm text-muted-foreground">已配置</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <Settings className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">配置完成</p>
                    <p className="text-sm text-muted-foreground">就绪</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
