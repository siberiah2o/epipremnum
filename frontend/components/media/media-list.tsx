"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMediaList } from "@/hooks/use-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  Calendar,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Brain,
  Keyboard,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Tag,
} from "lucide-react";
import { MediaListItem, apiClient } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

// 紧凑的标签展示组件（用于表格）
const CompactTagsDisplay = React.memo(
  ({
    items,
    variant = "secondary",
    icon: Icon,
  }: {
    items: Array<{ name: string; id: number }>;
    variant?: "secondary" | "outline";
    icon?: any;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayItems = isExpanded ? items : items.slice(0, 3);
    const hasMore = items.length > 3;

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {displayItems.map((item, index) => (
          <Badge
            key={item.id || `${item.name}-${index}`}
            variant={variant}
            className="text-xs px-2 py-1 hover:opacity-80 transition-opacity cursor-default"
          >
            {Icon && <Icon className="h-3 w-3 mr-1" />}
            {item.name}
          </Badge>
        ))}
        {hasMore && !isExpanded && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsExpanded(true)}
          >
            +{items.length - 3} 更多
          </Badge>
        )}
        {hasMore && isExpanded && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIsExpanded(false)}
          >
            收起
          </Badge>
        )}
      </div>
    );
  }
);

CompactTagsDisplay.displayName = "CompactTagsDisplay";
import { zhCN } from "date-fns/locale";
import { FileIcon } from "@/components/ui/file-icon";
import { getFileInfo } from "@/lib/file-utils";

interface MediaListProps {
  onEdit?: (media: MediaListItem) => void;
  onView?: (media: MediaListItem) => void;
}

export function MediaList({ onEdit, onView }: MediaListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [fallbackToOriginal, setFallbackToOriginal] = useState<Set<number>>(
    new Set()
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pageSize, setPageSize] = useState(12);

  // 多选相关状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<MediaListItem | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // 键盘导航相关状态
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isKeyboardNavEnabled, setIsKeyboardNavEnabled] = useState(false);

  // 每页显示行数选项
  const pageSizeOptions = [8, 12, 16, 20, 24, 30, 40, 50];

  const { mediaList, isLoading, error, refetch } = useMediaList(
    currentPage,
    pageSize,
    debouncedSearchQuery
  );

  // 键盘导航逻辑
  useEffect(() => {
    if (!mediaList?.results?.length) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 只在没有焦点在输入框时响应键盘导航
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const itemCount = mediaList.results.length;
      const currentIndex = focusedIndex ?? -1;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (viewMode === "grid") {
            // 网格模式：向下移动一行
            const cols = getGridColumnCount();
            const newIndex = Math.min(currentIndex + cols, itemCount - 1);
            setFocusedIndex(newIndex);
          } else {
            // 列表模式：移动到下一项
            const newIndex = Math.min(currentIndex + 1, itemCount - 1);
            setFocusedIndex(newIndex);
          }
          setIsKeyboardNavEnabled(true);
          break;

        case "ArrowUp":
          event.preventDefault();
          if (viewMode === "grid") {
            // 网格模式：向上移动一行
            const cols = getGridColumnCount();
            const newIndex = Math.max(currentIndex - cols, 0);
            setFocusedIndex(newIndex);
          } else {
            // 列表模式：移动到上一项
            const newIndex = Math.max(currentIndex - 1, 0);
            setFocusedIndex(newIndex);
          }
          setIsKeyboardNavEnabled(true);
          break;

        case "ArrowRight":
          event.preventDefault();
          if (viewMode === "grid") {
            // 网格模式：向右移动一列
            const newIndex = Math.min(currentIndex + 1, itemCount - 1);
            setFocusedIndex(newIndex);
          }
          setIsKeyboardNavEnabled(true);
          break;

        case "ArrowLeft":
          event.preventDefault();
          if (viewMode === "grid") {
            // 网格模式：向左移动一列
            const newIndex = Math.max(currentIndex - 1, 0);
            setFocusedIndex(newIndex);
          }
          setIsKeyboardNavEnabled(true);
          break;

        case "Enter":
        case " ":
          event.preventDefault();
          if (currentIndex >= 0 && currentIndex < itemCount) {
            const selectedMedia = mediaList.results[currentIndex];
            onView?.(selectedMedia);
          }
          break;

        case "e":
          event.preventDefault();
          if (currentIndex >= 0 && currentIndex < itemCount) {
            const selectedMedia = mediaList.results[currentIndex];
            onEdit?.(selectedMedia);
          }
          break;

        case "d":
          event.preventDefault();
          if (currentIndex >= 0 && currentIndex < itemCount) {
            const selectedMedia = mediaList.results[currentIndex];
            handleDeleteClick(selectedMedia);
          }
          break;

        case "a":
          event.preventDefault();
          if (currentIndex >= 0 && currentIndex < itemCount) {
            const selectedMedia = mediaList.results[currentIndex];
            if (selectedMedia.file_type === "image") {
              handleAIAnalysis(selectedMedia);
            }
          }
          break;

        case "Escape":
          event.preventDefault();
          setFocusedIndex(null);
          setIsKeyboardNavEnabled(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mediaList, focusedIndex, viewMode, currentPage]);

  // 获取网格列数
  const getGridColumnCount = () => {
    if (viewMode !== "grid") return 1;

    // 根据屏幕宽度返回列数
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width >= 1536) return 6; // 2xl
      if (width >= 1280) return 5; // xl
      if (width >= 1024) return 4; // lg
      if (width >= 768) return 3; // md
      return 2; // 默认和 sm
    }
    return 4; // 默认值
  };

  // 防抖处理搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // 搜索时重置到第一页
      setFocusedIndex(null); // 搜索时重置焦点
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 分页大小改变时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
    setFocusedIndex(null); // 分页大小改变时重置焦点
  }, [pageSize]);

  // 键盘快捷键提示组件
  const KeyboardShortcutsHelp = () => (
    <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Keyboard className="h-3 w-3" />
        <span className="font-medium">键盘快捷键</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <ArrowUp className="h-3 w-3" />
          <span>上移</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowDown className="h-3 w-3" />
          <span>下移</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          <span>左移</span>
        </div>
        <div className="flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          <span>右移</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
            Enter
          </kbd>
          <span>查看</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
            E
          </kbd>
          <span>编辑</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
            D
          </kbd>
          <span>删除</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
            A
          </kbd>
          <span>AI分析</span>
        </div>
        <div className="flex items-center gap-1 col-span-2">
          <kbd className="px-1 py-0.5 bg-background border rounded text-xs">
            ESC
          </kbd>
          <span>取消选择</span>
        </div>
      </div>
    </div>
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handlePageSizeChange = (newPageSize: string) => {
    const size = parseInt(newPageSize);
    setPageSize(size);
    setCurrentPage(1); // 重置到第一页
  };

  // 多选功能
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (mediaList?.results) {
      const allIds = mediaList.results.map((item) => item.id);
      if (selectedIds.size === allIds.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(allIds));
      }
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessingBatch(true);
    try {
      await apiClient.batchDeleteMedia({ ids: Array.from(selectedIds) });
      toast.success(`成功删除 ${selectedIds.size} 个文件`);
      clearSelection();
      refetch();
    } catch (error) {
      console.error("批量删除失败:", error);
      toast.error(error instanceof Error ? error.message : "批量删除失败");
    } finally {
      setIsProcessingBatch(false);
      setBatchDeleteDialogOpen(false);
    }
  };

  const handleDownload = async (media: MediaListItem) => {
    try {
      const response = await fetch(media.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("文件下载开始");
    } catch (error) {
      toast.error("下载失败");
    }
  };

  const handleDeleteClick = (media: MediaListItem) => {
    setMediaToDelete(media);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!mediaToDelete) return;

    setIsDeleting(true);
    try {
      await apiClient.deleteMedia(mediaToDelete.id);
      toast.success("媒体文件删除成功");
      setDeleteDialogOpen(false);
      setMediaToDelete(null);
      // Refresh the media list
      refetch();
    } catch (error) {
      console.error("删除失败:", error);
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setMediaToDelete(null);
  };

  const handleAIAnalysis = async (media: MediaListItem) => {
    if (media.file_type !== "image") {
      toast.error("只有图片文件支持AI分析");
      return;
    }

    try {
      // 使用完整分析功能
      const response = await apiClient.generateCombined(media.id, {
        generateTitle: true,
        generateDescription: true,
        generatePrompt: true,
        generateCategories: true,
        generateTags: true,
        maxCategories: 5,
        maxTags: 10,
      });

      if (response.data) {
        toast.success("图片分析完成！");
        // 刷新媒体列表
        refetch();
      }
    } catch (error: any) {
      console.error("AI分析失败:", error);
      toast.error(error.message || "AI分析失败");
    }
  };

  const getFileIcon = (fileType: string) => {
    return <FileIcon mimeType={fileType} size="sm" />;
  };

  const getFileTypeDisplayName = (fileType: string) => {
    return getFileInfo(fileType).displayName;
  };

  const getFileFormatName = (fileName: string) => {
    // 从文件名获取格式名称
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension?.toUpperCase() || "Unknown";
  };

  const getDisplayFileName = (fileUrl: string) => {
    // 从URL中提取文件名用于显示
    if (!fileUrl) return "Unknown";

    try {
      // 如果是完整URL，提取路径部分
      const url = new URL(fileUrl);
      const pathname = url.pathname;

      // 获取最后一部分作为文件名
      const fileName = pathname.split("/").pop() || pathname;

      // 如果是UUID格式，尝试显示更有意义的信息
      if (fileName.length === 32 || fileName.length === 36) {
        // 这是一个UUID，我们可以只显示类型和ID的一部分
        const parts = fileName.split(".");
        const fileExtension = parts[1] ? parts[1].toUpperCase() : "FILE";
        return `媒体文件 (${fileExtension})`;
      }

      return fileName;
    } catch {
      // 如果不是有效的URL，直接返回
      const fileName = fileUrl.split("/").pop() || fileUrl;

      // 检查是否是UUID格式
      if (fileName.length === 32 || fileName.length === 36) {
        const parts = fileName.split(".");
        const fileExtension = parts[1] ? parts[1].toUpperCase() : "FILE";
        return `媒体文件 (${fileExtension})`;
      }

      return fileName;
    }
  };

  const handleImageError = (media: MediaListItem) => {
    // 如果当前使用的是缩略图且是图片文件，尝试回退到原图
    if (
      media.file_type === "image" &&
      media.thumbnail_url &&
      !fallbackToOriginal.has(media.id)
    ) {
      setFallbackToOriginal((prev) => new Set([...prev, media.id]));
    } else {
      // 如果已经尝试过原图或者不是图片文件，则标记为错误
      setImageErrors((prev) => new Set([...prev, media.id]));
    }
  };

  const getImageSrc = (media: MediaListItem) => {
    // 如果图片加载失败过
    if (imageErrors.has(media.id)) {
      return null;
    }

    // 如果是图片且已经回退到原图
    if (media.file_type === "image" && fallbackToOriginal.has(media.id)) {
      return media.file_url;
    }

    // 优先使用缩略图，如果不存在则使用原图
    return media.thumbnail_url || media.file_url;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 网格视图组件
  const GridView = () => {
    if (!mediaList?.results?.length) return null;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {mediaList.results.map((media, index) => (
          <div
            key={media.id}
            ref={
              isKeyboardNavEnabled && focusedIndex === index
                ? (el) => el?.focus()
                : undefined
            }
            tabIndex={isKeyboardNavEnabled && focusedIndex === index ? 0 : -1}
            className={`group relative bg-background border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 ${
              selectedIds.has(media.id)
                ? "ring-2 ring-primary ring-offset-2"
                : ""
            } ${
              isKeyboardNavEnabled && focusedIndex === index
                ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-105"
                : ""
            }`}
            onClick={() => {
              setFocusedIndex(index);
              setIsKeyboardNavEnabled(true);
            }}
          >
            {/* 选择框 */}
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedIds.has(media.id)}
                onCheckedChange={() => toggleSelection(media.id)}
                className="bg-background/80 backdrop-blur-sm"
              />
            </div>

            {/* 操作按钮 */}
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onView?.(media)}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit?.(media)}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownload(media)}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {media.file_type === "image" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAIAnalysis(media)}
                    className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                    title="AI分析"
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick(media)}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 媒体预览区域 */}
            <div
              className="aspect-square bg-muted/50 relative overflow-hidden cursor-pointer"
              onClick={() => onView?.(media)}
            >
              {(media.file_type === "image" || media.file_type === "video") &&
              (media.thumbnail_url || media.file_url) ? (
                imageErrors.has(media.id) ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileIcon
                      mimeType={
                        media.file_type === "image" ? "image/jpeg" : "video/mp4"
                      }
                      size="lg"
                    />
                  </div>
                ) : (
                  <>
                    {media.file_type === "image" ? (
                      <img
                        src={getImageSrc(media) || undefined}
                        alt={media.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={() => handleImageError(media)}
                        loading="lazy"
                      />
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={getImageSrc(media) || undefined}
                          alt={media.title}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(media)}
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-2">
                            <FileIcon
                              mimeType="video/mp4"
                              size="sm"
                              className="text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileIcon
                    mimeType={
                      media.file_type === "video"
                        ? "video/mp4"
                        : "application/octet-stream"
                    }
                    size="lg"
                  />
                </div>
              )}
            </div>

            {/* 文件信息 */}
            <div className="p-3">
              <div className="mb-2">
                <h4
                  className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => onView?.(media)}
                  title={media.title}
                >
                  {media.title}
                </h4>
                {(media.ai_description || media.description) && (
                  <p
                    onClick={() => onView?.(media)}
                    className="text-sm text-muted-foreground line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                    title={
                      media.ai_description || media.description || undefined
                    }
                  >
                    {media.ai_description || media.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <FileIcon mimeType={media.file_type} size="sm" />
                  <Badge variant="outline" className="text-xs">
                    {getFileTypeDisplayName(media.file_type)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(media.file_size)}</span>
                <span>
                  {formatDistanceToNow(new Date(media.created_at), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalPages = mediaList?.total_pages || 0;
  const totalItems = mediaList?.count || 0;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>媒体文件</CardTitle>
              <CardDescription>
                共 {totalItems} 个文件，第 {currentPage} / {totalPages} 页
                {selectedIds.size > 0 && (
                  <span className="text-blue-600 font-medium">
                    ，已选择 {selectedIds.size} 个
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* 每页显示行数选择器 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>每页:</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={handlePageSizeChange}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs"
                >
                  取消选择
                </Button>
              )}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索媒体文件..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 w-64"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-6 w-6 p-0"
                        onMouseEnter={() => setIsKeyboardNavEnabled(true)}
                        onMouseLeave={() =>
                          !focusedIndex && setIsKeyboardNavEnabled(false)
                        }
                      >
                        <Keyboard className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-md">
                      <div className="space-y-2">
                        <p className="font-medium">键盘导航已启用</p>
                        <p className="text-xs text-muted-foreground">
                          使用方向键浏览图片，快捷键操作：
                        </p>
                        <div className="text-xs space-y-1">
                          <div>
                            •{" "}
                            <kbd className="px-1 py-0.5 bg-background border rounded">
                              ↑↓←→
                            </kbd>{" "}
                            浏览图片
                          </div>
                          <div>
                            •{" "}
                            <kbd className="px-1 py-0.5 bg-background border rounded">
                              Enter
                            </kbd>{" "}
                            查看图片
                          </div>
                          <div>
                            •{" "}
                            <kbd className="px-1 py-0.5 bg-background border rounded">
                              E
                            </kbd>{" "}
                            编辑
                          </div>
                          <div>
                            •{" "}
                            <kbd className="px-1 py-0.5 bg-background border rounded">
                              A
                            </kbd>{" "}
                            AI分析
                          </div>
                          <div>
                            •{" "}
                            <kbd className="px-1 py-0.5 bg-background border rounded">
                              ESC
                            </kbd>{" "}
                            取消选择
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {[...Array(pageSize)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-background border rounded-lg overflow-hidden"
                  >
                    <Skeleton className="aspect-square" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {/* 根据视图模式显示 */}
              {viewMode === "grid" ? (
                <GridView />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              mediaList?.results
                                ? selectedIds.size === mediaList.results.length
                                : false
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>文件</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>AI分类</TableHead>
                        <TableHead>AI标签</TableHead>
                        <TableHead>大小</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mediaList?.results?.map((media, index) => (
                        <TableRow
                          key={media.id}
                          ref={
                            isKeyboardNavEnabled && focusedIndex === index
                              ? (el) => el?.focus()
                              : undefined
                          }
                          tabIndex={
                            isKeyboardNavEnabled && focusedIndex === index
                              ? 0
                              : -1
                          }
                          className={`
                        ${selectedIds.has(media.id) ? "bg-muted/50" : ""}
                        ${
                          isKeyboardNavEnabled && focusedIndex === index
                            ? "ring-2 ring-blue-500 ring-offset-2"
                            : ""
                        }
                        cursor-pointer hover:bg-muted/30 transition-colors
                      `}
                          onClick={() => {
                            setFocusedIndex(index);
                            setIsKeyboardNavEnabled(true);
                            onView?.(media);
                          }}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(media.id)}
                              onCheckedChange={() => toggleSelection(media.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {(media.file_type === "image" ||
                                media.file_type === "video") &&
                              (media.thumbnail_url || media.file_url) ? (
                                imageErrors.has(media.id) ? (
                                  <div
                                    className="h-10 w-10 rounded bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => onView?.(media)}
                                    title="缩略图加载失败，点击查看详情"
                                  >
                                    <FileIcon
                                      mimeType={
                                        media.file_type === "image"
                                          ? "image/jpeg"
                                          : "video/mp4"
                                      }
                                      size="sm"
                                    />
                                  </div>
                                ) : (
                                  <img
                                    src={getImageSrc(media) || undefined}
                                    alt={media.title}
                                    className="h-10 w-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                    onError={() => handleImageError(media)}
                                    onClick={() => onView?.(media)}
                                    loading="lazy"
                                    title={
                                      media.file_type === "image"
                                        ? "点击查看图片"
                                        : "点击查看视频"
                                    }
                                  />
                                )
                              ) : (
                                <div
                                  className="h-10 w-10 rounded bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                                  onClick={() => onView?.(media)}
                                  title={
                                    media.file_type === "video"
                                      ? "视频缩略图生成中..."
                                      : "点击查看详情"
                                  }
                                >
                                  <FileIcon
                                    mimeType={
                                      media.file_type === "video"
                                        ? "video/mp4"
                                        : "application/octet-stream"
                                    }
                                    size="sm"
                                  />
                                </div>
                              )}
                              <div>
                                <p
                                  className="font-medium cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => onView?.(media)}
                                >
                                  {media.title}
                                </p>
                                <p
                                  className="text-sm text-muted-foreground truncate max-w-xs"
                                  title={media.file_url}
                                >
                                  {getDisplayFileName(media.file_url)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1 w-fit"
                            >
                              {getFileIcon(media.file_type)}
                              {getFileTypeDisplayName(media.file_type)} (
                              {getFileFormatName(media.file_url)})
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {media.ai_categories && media.ai_categories.length > 0 ? (
                                <CompactTagsDisplay
                                  items={media.ai_categories}
                                  variant="secondary"
                                  icon={Brain}
                                />
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {media.ai_tags && media.ai_tags.length > 0 ? (
                                <CompactTagsDisplay
                                  items={media.ai_tags}
                                  variant="outline"
                                  icon={Tag}
                                />
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {formatFileSize(media.file_size)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(media.created_at), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onView?.(media)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onEdit?.(media)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(media)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>

                              {media.file_type === "image" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAIAnalysis(media)}
                                  title="AI分析"
                                >
                                  <Brain className="h-4 w-4" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(media)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 键盘导航提示 */}
              {isKeyboardNavEnabled && (
                <div className="mt-4 flex justify-center">
                  <KeyboardShortcutsHelp />
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    第 {currentPage} 页，显示 {(currentPage - 1) * pageSize + 1}{" "}
                    - {Math.min(currentPage * pageSize, totalItems)} 条，共{" "}
                    {totalItems} 条（每页 {pageSize} 条）
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>

                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        // 只显示当前页附近的页码
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 2 && page <= currentPage + 2)
                        ) {
                          return (
                            <Button
                              key={page}
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              className="w-8 h-8 p-0"
                            >
                              {page}
                            </Button>
                          );
                        }
                        // 显示省略号
                        if (
                          page === currentPage - 3 ||
                          page === currentPage + 3
                        ) {
                          return (
                            <span
                              key={page}
                              className="px-2 text-muted-foreground"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* 空状态 */}
              {mediaList?.results?.length === 0 && (
                <div className="text-center py-12">
                  <FileIcon
                    mimeType="image/jpeg"
                    size="lg"
                    className="mx-auto text-muted-foreground mb-4"
                  />
                  <h3 className="text-lg font-medium mb-2">暂无媒体文件</h3>
                  <p className="text-muted-foreground">
                    上传您的第一个媒体文件开始管理
                  </p>
                </div>
              )}

              {/* 删除确认对话框 */}
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认删除</DialogTitle>
                    <DialogDescription>
                      您确定要删除媒体文件 "{mediaToDelete?.title}"
                      吗？此操作无法撤销。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={handleDeleteCancel}
                      disabled={isDeleting}
                    >
                      取消
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteConfirm}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "删除中..." : "确认删除"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 批量删除确认对话框 */}
              <Dialog
                open={batchDeleteDialogOpen}
                onOpenChange={setBatchDeleteDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>批量删除确认</DialogTitle>
                    <DialogDescription>
                      您确定要删除选中的 {selectedIds.size}{" "}
                      个媒体文件吗？此操作无法撤销。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setBatchDeleteDialogOpen(false)}
                      disabled={isProcessingBatch}
                    >
                      取消
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleBatchDelete}
                      disabled={isProcessingBatch}
                    >
                      {isProcessingBatch ? "删除中..." : "确认删除"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      {/* 浮动批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">
                已选择 {selectedIds.size} 个文件
              </span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteDialogOpen(true)}
              disabled={isProcessingBatch}
              className="h-8"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={isProcessingBatch}
              className="h-8"
            >
              取消选择
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
