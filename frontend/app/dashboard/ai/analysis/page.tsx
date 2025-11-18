"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImageAnalysis } from "@/components/ai/image-analysis";
import { apiClient, type MediaListItem } from "@/lib/api";
import { Image, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export default function AIAnalysisPage() {
  useRouteGuard(); // 添加路由保护
  const [mediaFiles, setMediaFiles] = useState<MediaListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [pageSize, setPageSize] = useState(24); // 每页显示数量

  // 获取媒体文件列表
  useEffect(() => {
    fetchMediaFiles();
  }, [currentPage, pageSize]);

  // 处理页面大小变化
  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // 重置到第一页
  };

  // 优化图片文件过滤 - 使用 useMemo 缓存计算结果
  const imageFiles = useMemo(
    () =>
      mediaFiles.filter(
        (file) =>
          file.file_type === "image" && (file.thumbnail_url || file.file_url)
      ),
    [mediaFiles]
  );

  // 优化页码计算 - 使用 useMemo 缓存计算结果
  const paginationButtons = useMemo(() => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;

    // 计算显示的页码范围
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 调整起始页，确保显示足够的页码
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 显示第一页
    if (startPage > 1) {
      pageNumbers.push(
        <Button
          key={1}
          variant={currentPage === 1 ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageClick(1)}
          className="w-14 h-8 p-0 min-w-[3.5rem] text-sm font-medium"
        >
          1
        </Button>
      );

      if (startPage > 2) {
        pageNumbers.push(
          <span key="ellipsis-start" className="px-3 text-muted-foreground">
            ...
          </span>
        );
      }
    }

    // 显示中间页码
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageClick(i)}
          className="w-14 h-8 p-0 min-w-[3.5rem] text-sm font-medium"
        >
          {i}
        </Button>
      );
    }

    // 显示最后一页
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(
          <span key="ellipsis-end" className="px-3 text-muted-foreground">
            ...
          </span>
        );
      }

      pageNumbers.push(
        <Button
          key={totalPages}
          variant={currentPage === totalPages ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageClick(totalPages)}
          className="w-14 h-8 p-0 min-w-[3.5rem] text-sm font-medium"
        >
          {totalPages}
        </Button>
      );
    }

    return <div className="flex items-center gap-3 mx-3">{pageNumbers}</div>;
  }, [currentPage, totalPages]);

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMediaList(currentPage, pageSize);
      if (response.data) {
        setMediaFiles(response.data.results || []);
        const totalPagesValue =
          response.data.total_pages ||
          Math.ceil(response.data.count / pageSize);
        setTotalPages(totalPagesValue);
        setTotalFiles(response.data.count || 0);

        // 如果当前选中的文件不在当前页面，清除选择
        if (
          selectedFile &&
          !response.data.results.some(
            (file: MediaListItem) => file.id === selectedFile.id
          )
        ) {
          setSelectedFile(null);
        }
      }
    } catch (err) {
      console.error("获取媒体文件失败:", err);
    } finally {
      setLoading(false);
    }
  };

  // 刷新媒体文件列表
  const handleMediaUpdate = () => {
    fetchMediaFiles();
  };

  // 翻页控制
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
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
                  <BreadcrumbPage>AI 分析</BreadcrumbPage>
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
                <BreadcrumbPage>AI 分析</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* 左右分栏布局 */}
          <div className="flex flex-1 gap-4 lg:gap-6 h-full min-h-0">
            {/* 左侧素材列 */}
            <div className="w-full lg:w-1/4 xl:w-1/3 flex flex-col min-h-0">
              <Card className="flex-1 flex flex-col min-h-0 gap-2">
                <CardHeader className="pb-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="m-0">图片素材</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {totalFiles} 个
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col pt-0 px-6 pb-6">
                  {imageFiles.length > 0 ? (
                    <div className="flex-1 flex flex-col">
                      {/* 图片网格 */}
                      <div className="overflow-y-auto pr-2">
                        <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1">
                          {loading
                            ? // 加载状态
                              Array.from(
                                {
                                  length:
                                    parseInt(pageSize.toString()) > 12
                                      ? 12
                                      : parseInt(pageSize.toString()),
                                },
                                (_, i) => (
                                  <div
                                    key={`skeleton-${i}`}
                                    className="h-16 border rounded-lg bg-muted animate-pulse"
                                  />
                                )
                              )
                            : imageFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className={`relative group cursor-pointer overflow-hidden transition-all hover:scale-105 rounded-sm h-16 ${
                                    selectedFile?.id === file.id
                                      ? "ring-2 ring-primary ring-opacity-50"
                                      : ""
                                  }`}
                                  onClick={() => setSelectedFile(file)}
                                >
                                  <div className="relative h-full">
                                    <img
                                      src={file.thumbnail_url || file.file_url}
                                      alt={file.title}
                                      className="w-full h-full transition-opacity object-cover object-center"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target =
                                          e.target as HTMLImageElement;
                                        // 使用SVG占位符
                                        target.outerHTML = `
                                        <div class="w-full h-full bg-muted flex items-center justify-center">
                                          <svg class="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                          </svg>
                                        </div>
                                      `;
                                      }}
                                    />
                                    {/* 选中状态指示器 */}
                                    {selectedFile?.id === file.id && (
                                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                        <div className="bg-primary rounded-full p-1">
                                          <svg
                                            className="w-4 h-4 text-white"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                        </div>
                      </div>
                      {/* 分页控制 - 两行布局 */}
                      {totalPages >= 1 && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          {/* 第一行：页面信息和页面大小选择 */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                              第 {currentPage} 页，显示{" "}
                              {(currentPage - 1) * pageSize + 1} -{" "}
                              {Math.min(currentPage * pageSize, totalFiles)}{" "}
                              条，共 {totalFiles} 条
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                每页:
                              </span>
                              <Select
                                value={pageSize.toString()}
                                onValueChange={handlePageSizeChange}
                              >
                                <SelectTrigger className="w-20 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="w-20">
                                  <SelectItem
                                    value="12"
                                    className="text-center"
                                  >
                                    12
                                  </SelectItem>
                                  <SelectItem
                                    value="24"
                                    className="text-center"
                                  >
                                    24
                                  </SelectItem>
                                  <SelectItem
                                    value="36"
                                    className="text-center"
                                  >
                                    36
                                  </SelectItem>
                                  <SelectItem
                                    value="48"
                                    className="text-center"
                                  >
                                    48
                                  </SelectItem>
                                  <SelectItem
                                    value="60"
                                    className="text-center"
                                  >
                                    60
                                  </SelectItem>
                                  <SelectItem
                                    value="96"
                                    className="text-center"
                                  >
                                    96
                                  </SelectItem>
                                  <SelectItem
                                    value="120"
                                    className="text-center"
                                  >
                                    120
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* 第二行：分页按钮控制 */}
                          <div className="flex items-center justify-center">
                            {/* 上一页 */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handlePrevPage}
                              disabled={currentPage === 1}
                              className="mr-6"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              上一页
                            </Button>

                            {/* 页码 - 使用预计算的优化组件 */}
                            {paginationButtons}

                            {/* 下一页 */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleNextPage}
                              disabled={currentPage === totalPages}
                              className="ml-6"
                            >
                              下一页
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        暂无图片文件
                      </h3>
                      <p className="text-muted-foreground">
                        请先上传一些图片文件，然后使用AI分析功能
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 右侧操作面板 */}
            <div className="flex-1 min-h-0">
              {selectedFile ? (
                <div className="h-full overflow-y-auto">
                  <ImageAnalysis
                    mediaFile={selectedFile}
                    onMediaUpdate={handleMediaUpdate}
                  />
                </div>
              ) : (
                <Card className="h-full min-h-[400px] flex items-center justify-center">
                  <CardContent className="text-center p-8">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      选择一张图片开始分析
                    </h3>
                    <p className="text-muted-foreground max-w-sm">
                      从左侧素材列表中选择一张图片，即可开始AI分析
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
