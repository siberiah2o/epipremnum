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
import { BatchAnalysis } from "@/components/ai/batch-analysis";
import { apiClient, type MediaListItem } from "@/lib/api";
import { Layers } from "lucide-react";

export default function BatchAnalysisPage() {
  useRouteGuard(); // 添加路由保护
  const [mediaFiles, setMediaFiles] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取媒体文件列表
  useEffect(() => {
    const fetchMediaFiles = async () => {
      try {
        const response = await apiClient.getMediaList(1, 200); // 获取前200个文件用于批量处理
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

  // 刷新媒体文件列表
  const handleMediaUpdate = () => {
    fetchMediaFiles();
  };

  const fetchMediaFiles = async () => {
    try {
      const response = await apiClient.getMediaList(1, 200);
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
                  <BreadcrumbPage>批量处理</BreadcrumbPage>
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
                <BreadcrumbPage>批量处理</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* 页面标题 */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">AI 批量处理</h1>
            <p className="text-muted-foreground">
              选择多个图片文件进行批量AI分析，提高工作效率
            </p>
          </div>

          {/* 批量分析组件 */}
          <BatchAnalysis
            mediaFiles={mediaFiles}
            onMediaUpdate={handleMediaUpdate}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}