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
    Tag,
} from "lucide-react";
import { MediaListItem, MediaFile, apiClient } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

// 紧凑的标签展示组件（用于表格）
const CompactTagsDisplay = React.memo(
  ({
    items,
    variant = "secondary",
    icon: Icon,
    onViewMore,
  }: {
    items: Array<{ name: string; id: number }>;
    variant?: "secondary" | "outline";
    icon?: any;
    onViewMore?: () => void;
  }) => {
    const displayItems = items.slice(0, 3);
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
        {hasMore && onViewMore && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={onViewMore}
          >
            +{items.length - 3} 更多
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
  const [imageRetryCount, setImageRetryCount] = useState<Map<number, number>>(new Map());
  const MAX_RETRY_ATTEMPTS = 3;
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

  // 媒体详情缓存 (用于获取完整的categories和tags)
  const [mediaDetailsMap, setMediaDetailsMap] = useState<Map<number, MediaFile>>(new Map());

  // 获取媒体详情的函数
  const fetchMediaDetails = async (mediaId: number) => {
    if (mediaDetailsMap.has(mediaId)) {
      return mediaDetailsMap.get(mediaId)!;
    }

    try {
      const response = await apiClient.getMedia(mediaId);
      if (response.data) {
        setMediaDetailsMap(prev => new Map(prev.set(mediaId, response.data)));
        return response.data;
      }
    } catch (error) {
      console.error(`Failed to fetch media details for ID ${mediaId}:`, error);
    }
    return null;
  };

  
  // 每页显示行数选项
  const pageSizeOptions = [8, 12, 16, 20, 24, 30, 40, 50];

  const { mediaList, isLoading, error, refetch } = useMediaList(
    currentPage,
    pageSize,
    debouncedSearchQuery
  );

  // 获取媒体的实际categories和tags
  const getMediaCategories = (media: MediaListItem): any[] | null | undefined => {
    const details = mediaDetailsMap.get(media.id);
    if (details === undefined) {
      return undefined; // 未加载
    }
    return details?.categories || null;
  };

  const getMediaTags = (media: MediaListItem): any[] | null | undefined => {
    const details = mediaDetailsMap.get(media.id);
    if (details === undefined) {
      return undefined; // 未加载
    }
    return details?.tags || null;
  };

  // 预加载当前页所有媒体的详情
  useEffect(() => {
    if (mediaList?.results) {
      mediaList.results.forEach(media => {
        if (!mediaDetailsMap.has(media.id)) {
          fetchMediaDetails(media.id);
        }
      });
    }
  }, [mediaList?.results]);

  // 重置错误状态当媒体列表刷新时
  useEffect(() => {
    if (mediaList?.results?.length) {
      // 清除已删除媒体的错误状态
      setImageErrors((prev) => {
        const newSet = new Set<number>();
        prev.forEach((id) => {
          if (mediaList.results.some((media) => media.id === id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
    }
  }, [mediaList?.results]);

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
    // 获取当前重试次数
    const currentRetryCount = imageRetryCount.get(media.id) || 0;

    // 如果当前使用的是缩略图且是图片文件，尝试回退到原图
    if (
      media.file_type === "image" &&
      media.thumbnail_url &&
      !fallbackToOriginal.has(media.id)
    ) {
      setFallbackToOriginal((prev) => new Set([...prev, media.id]));
      // 清除错误状态，允许重试原图
      setImageErrors((prev) => {
        const newSet = new Set(prev);
        newSet.delete(media.id);
        return newSet;
      });
      // 增加重试计数
      setImageRetryCount((prev) => new Map(prev.set(media.id, currentRetryCount + 1)));
    } else if (currentRetryCount < MAX_RETRY_ATTEMPTS) {
      // 重试原图
      setFallbackToOriginal((prev) => new Set([...prev, media.id]));
      setImageErrors((prev) => {
        const newSet = new Set(prev);
        newSet.delete(media.id);
        return newSet;
      });
      setImageRetryCount((prev) => new Map(prev.set(media.id, currentRetryCount + 1)));
    } else {
      // 已经超过最大重试次数，标记为错误
      setImageErrors((prev) => new Set([...prev, media.id]));
      console.warn(`Failed to load image for media ${media.id} after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
  };

  const getImageSrc = (media: MediaListItem) => {
    // 如果图片加载失败过，返回null以显示fallback图标
    if (imageErrors.has(media.id)) {
      return null;
    }

    let imageUrl = null;

    // 如果是图片且已经回退到原图
    if (media.file_type === "image" && fallbackToOriginal.has(media.id)) {
      imageUrl = media.file_url;
    } else {
      // 优先使用缩略图，如果不存在则使用原图
      imageUrl = media.thumbnail_url || media.file_url;
    }

    // 调试信息：在开发环境下输出URL信息
    if (process.env.NODE_ENV === 'development' && imageUrl) {
      console.log(`Image URL for media ${media.id}:`, imageUrl);
      console.log(`Thumbnail URL:`, media.thumbnail_url);
      console.log(`File URL:`, media.file_url);
    }

    // 确保返回有效的URL
    if (!imageUrl || imageUrl.trim() === '') {
      return null;
    }

    return imageUrl;
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
            className={`group relative bg-gradient-to-br from-background to-muted/20 border rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 ${
              selectedIds.has(media.id)
                ? "ring-2 ring-purple-400/30 ring-offset-2 shadow-purple-500/10 scale-[1.02] border-purple-200/50 dark:border-purple-800/30"
                : "hover:border-gray-200 dark:hover:border-gray-700"
            } ${
              isKeyboardNavEnabled && focusedIndex === index && !selectedIds.has(media.id)
                ? "ring-2 ring-gray-400/30 ring-offset-2 shadow-gray-500/10 scale-[1.01]"
                : ""
            }`}
            onClick={() => {
              setFocusedIndex(index);
              setIsKeyboardNavEnabled(true);
            }}
          >
            {/* 选择框 */}
            <div className="absolute top-2 left-2 z-10">
              <div className="relative">
                <Checkbox
                  checked={selectedIds.has(media.id)}
                  onCheckedChange={() => toggleSelection(media.id)}
                  className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-300 dark:border-gray-600 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-purple-500 data-[state=checked]:to-purple-600 data-[state=checked]:border-purple-500 data-[state=checked]:shadow-lg data-[state=checked]:shadow-purple-500/25 transition-all duration-200"
                />
                {selectedIds.has(media.id) && (
                  <div className="absolute -inset-1 bg-purple-400/20 rounded-md animate-ping" />
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView?.(media);
                  }}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                  title="预览"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(media);
                  }}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                  title="编辑"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(media);
                  }}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                  title="下载"
                >
                  <Download className="h-4 w-4" />
                </Button>
                  <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(media);
                  }}
                  className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 媒体预览区域 */}
            <div
              className="aspect-square bg-gradient-to-br from-gray-50/50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-800/50 relative overflow-hidden cursor-pointer group/image"
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
                      <div className="w-full h-full flex items-center justify-center bg-muted/20">
                        {getImageSrc(media) ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img
                              src={getImageSrc(media)!}
                              alt={media.title}
                              className="max-w-full max-h-full object-contain transition-all duration-300 group-hover/image:scale-105 group-hover/image:shadow-2xl"
                              onError={() => handleImageError(media)}
                              loading="lazy"
                            />
                            {/* 选中状态的光泽效果 */}
                            {selectedIds.has(media.id) && (
                              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent pointer-events-none rounded-lg" />
                            )}
                          </div>
                        ) : (
                          <FileIcon mimeType="image/jpeg" size="lg" />
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {getImageSrc(media) ? (
                          <>
                            <img
                              src={getImageSrc(media)!}
                              alt={media.title}
                              className="max-w-full max-h-full object-contain"
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
                          </>
                        ) : (
                          <div className="bg-black/50 rounded-full p-2">
                            <FileIcon
                              mimeType="video/mp4"
                              size="lg"
                              className="text-white"
                            />
                          </div>
                        )}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onView?.(media);
                  }}
                  title={media.title}
                >
                  {media.title}
                </h4>
                {media.description && (
                  <p
                    onClick={(e) => {
                      e.stopPropagation();
                      onView?.(media);
                    }}
                    className="text-sm text-muted-foreground line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                    title={media.description}
                  >
                    {media.description}
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
                        <Search className="h-3 w-3" />
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
                              D
                            </kbd>{" "}
                            删除
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
                        <TableHead>分类</TableHead>
                        <TableHead>标签</TableHead>
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
                        ${selectedIds.has(media.id)
                          ? "bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20 border-l-4 border-l-purple-400"
                          : ""
                        }
                        ${
                          isKeyboardNavEnabled && focusedIndex === index && !selectedIds.has(media.id)
                            ? "ring-2 ring-gray-400/30 ring-offset-2 bg-gray-50/30 dark:bg-gray-950/20"
                            : ""
                        }
                        cursor-pointer hover:bg-muted/20 transition-all duration-200
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
                                getImageSrc(media) ? (
                                  <img
                                    src={getImageSrc(media)!}
                                    alt={media.title}
                                    className="h-10 w-10 rounded object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                    onError={() => handleImageError(media)}
                                    onClick={() => onView?.(media)}
                                    loading="lazy"
                                    title={
                                      media.file_type === "image"
                                        ? "点击查看图片"
                                        : "点击查看视频"
                                    }
                                  />
                                ) : (
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onView?.(media);
                                  }}
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
                              {(() => {
                                const categories = getMediaCategories(media);
                                if (categories === undefined) {
                                  return <div className="animate-pulse bg-muted rounded h-4 w-12"></div>;
                                }
                                return categories && categories.length > 0 ? (
                                  <CompactTagsDisplay
                                    items={categories}
                                    variant="secondary"
                                    icon={Tag}
                                    onViewMore={() => onView?.(media)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              {(() => {
                                const tags = getMediaTags(media);
                                if (tags === undefined) {
                                  return <div className="animate-pulse bg-muted rounded h-4 w-12"></div>;
                                }
                                return tags && tags.length > 0 ? (
                                  <CompactTagsDisplay
                                    items={tags}
                                    variant="outline"
                                    icon={Tag}
                                    onViewMore={() => onView?.(media)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                );
                              })()}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onView?.(media);
                                }}
                                title="预览"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit?.(media);
                                }}
                                title="编辑"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(media);
                                }}
                                title="下载"
                              >
                                <Download className="h-4 w-4" />
                              </Button>

  
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(media);
                                }}
                                title="删除"
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
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-background to-muted/20 backdrop-blur-xl border border-purple-200/30 dark:border-purple-800/30 rounded-2xl shadow-2xl shadow-purple-500/10 p-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-3 h-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-purple-400/30 rounded-full animate-ping"></div>
              </div>
              <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
                已选择 {selectedIds.size} 个文件
              </span>
            </div>
            <div className="h-4 w-px bg-gradient-to-b from-transparent via-border to-transparent"></div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteDialogOpen(true)}
              disabled={isProcessingBatch}
              className="h-8 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 shadow-lg shadow-red-500/25 transition-all duration-200"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={isProcessingBatch}
              className="h-8 bg-background/50 backdrop-blur-sm hover:bg-muted/50 border-purple-200/50 dark:border-purple-800/50 transition-all duration-200"
            >
              取消选择
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
