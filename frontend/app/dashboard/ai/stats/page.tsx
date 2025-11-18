"use client";

import { useState, useEffect } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiClient, type MediaListItem } from "@/lib/api";
import { BarChart3, Image, Brain, Settings, Layers } from "lucide-react";

export default function AIStatsPage() {
  useRouteGuard(); // 添加路由保护
  const [mediaFiles, setMediaFiles] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取媒体文件列表
  useEffect(() => {
    const fetchMediaFiles = async () => {
      try {
        const response = await apiClient.getMediaList(1, 1000); // 获取所有文件用于统计
        if (response.data?.results) {
          setMediaFiles(response.data.results);
        }
      } catch (err) {
        console.error("获取媒体文件失败:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMediaFiles();
  }, []);

  const fetchMediaFiles = async () => {
    try {
      const response = await apiClient.getMediaList(1, 1000);
      if (response.data?.results) {
        setMediaFiles(response.data.results);
      }
    } catch (err) {
      console.error("获取媒体文件失败:", err);
    }
  };

  if (loading) {
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
                  <BreadcrumbLink href="/dashboard/ai">AI 工具</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>使用统计</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex items-center justify-center flex-1">
              <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">加载中...</p>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const imageFiles = mediaFiles.filter((file) => file.file_type === "image");

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
                <BreadcrumbLink href="/dashboard/ai">AI 工具</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>使用统计</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* 页面标题 */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">AI 使用统计</h1>
            <p className="text-muted-foreground">
              查看 AI 工具的使用情况和媒体文件统计分析
            </p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  总文件数
                </CardTitle>
                <Image className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {mediaFiles.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  图片: {imageFiles.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  图片文件
                </CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {imageFiles.length}
                </div>
                <p className="text-xs text-muted-foreground">支持AI分析</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  存储空间
                </CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(
                    mediaFiles.reduce(
                      (total, file) => total + file.file_size,
                      0
                    ) /
                    1024 /
                    1024 /
                    1024
                  ).toFixed(1)}
                  GB
                </div>
                <p className="text-xs text-muted-foreground">
                  总存储使用量
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  文件类型
                </CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(mediaFiles.map((file) => file.file_type)).size}
                </div>
                <p className="text-xs text-muted-foreground">
                  不同文件类型
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 文件类型分布 */}
          <Card>
            <CardHeader>
              <CardTitle>文件类型分布</CardTitle>
              <CardDescription>
                按文件类型统计的媒体文件分布情况
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(
                  mediaFiles.reduce((acc, file) => {
                    acc[file.file_type] = (acc[file.file_type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-primary rounded"></div>
                      <span className="text-sm font-medium capitalize">
                        {type}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {count} 个文件
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}