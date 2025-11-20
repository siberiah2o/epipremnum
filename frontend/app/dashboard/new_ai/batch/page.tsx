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
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { SimpleBatchAnalysis } from "@/components/new_ai/analysis/components/simple-batch-analysis";
import { apiClient, type MediaListItem } from "@/lib/api";
import { Download, RefreshCw } from "lucide-react";

export default function NewBatchAnalysisPage() {
  useRouteGuard(); // 添加路由保护
  const [mediaFiles, setMediaFiles] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [pageSize] = useState(100); // 每页显示100个文件用于批量处理

  // 获取媒体文件列表
  const fetchMediaFiles = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiClient.getMediaList(
        page,
        pageSize,
        undefined,
        undefined,
        undefined,
        "image"
      ); // 只获取图片文件
      if (response.data) {
        if (page === 1) {
          setMediaFiles(response.data.results || []);
        } else {
          setMediaFiles((prev) => [...prev, ...(response.data.results || [])]);
        }
        setTotalFiles(response.data.count || 0);
      }
    } catch (err) {
      console.error("获取媒体文件失败:", err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化时获取媒体文件列表
  useEffect(() => {
    fetchMediaFiles();
  }, []);

  // 刷新媒体文件列表
  const handleMediaUpdate = async () => {
    await fetchMediaFiles(1);

    // 触发全局媒体更新事件，通知其他页面刷新数据
    window.dispatchEvent(new CustomEvent("media-updated"));

    // 使用localStorage跨标签页同步
    localStorage.setItem("media-analysis-completed", Date.now().toString());

    // 清除localStorage标记（避免累积）
    setTimeout(() => {
      localStorage.removeItem("media-analysis-completed");
    }, 1000);
  };

  // 加载更多文件
  const loadMoreFiles = async () => {
    const nextPage = currentPage + 1;
    await fetchMediaFiles(nextPage);
    setCurrentPage(nextPage);
  };

  // 刷新文件列表
  const refreshFiles = async () => {
    setCurrentPage(1);
    await fetchMediaFiles(1);
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
                  <BreadcrumbLink href="/dashboard/new_ai">
                    新AI工作台
                  </BreadcrumbLink>
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
                <BreadcrumbLink href="/dashboard/new_ai">
                  新AI工作台
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>批量处理</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* 批量分析组件 */}
          <SimpleBatchAnalysis
            mediaFiles={mediaFiles}
            totalFiles={totalFiles}
            loading={loading}
            onRefresh={refreshFiles}
            onMediaUpdate={handleMediaUpdate}
          />

          {/* 加载更多按钮 */}
          {mediaFiles.length < totalFiles && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={loadMoreFiles}
                disabled={loading}
                className="min-w-32"
              >
                <Download className="h-4 w-4 mr-2" />
                加载更多文件
              </Button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
