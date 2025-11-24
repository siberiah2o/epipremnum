"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaListItem, MediaFile } from "@/lib/api";
import { FileIcon } from "@/components/ui/file-icon";
import { isPreviewable } from "@/lib/file-utils";
import {
  FileImage,
  Download,
  Tag,
  FolderOpen,
  FileText,
  Copy,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import apiClient from "@/lib/api";
import { toast } from "sonner";

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaListItem | null;
  mediaList?: MediaListItem[];
  onMediaChange?: (media: MediaListItem) => void;
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  media,
  mediaList,
  onMediaChange,
}: MediaPreviewDialogProps) {
  const [mediaDetails, setMediaDetails] = useState<MediaFile | null>(null);
  const [mediaWidth, setMediaWidth] = useState(600);
  const [mediaHeight, setMediaHeight] = useState(400);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [expandedTags, setExpandedTags] = useState(false);

  // 监听媒体元素尺寸变化
  useEffect(() => {
    if (open && media && mediaRef.current) {
      const updateDimensions = () => {
        const mediaElement = mediaRef.current?.querySelector(
          "#media-preview"
        ) as HTMLImageElement | HTMLVideoElement;
        if (mediaElement) {
          const width = mediaElement.offsetWidth || 600;
          const height = mediaElement.offsetHeight || 400;

          // 如果是图片且有自然尺寸，优先使用自然尺寸计算合适的显示高度
          if (
            mediaElement.tagName === "IMG" &&
            (mediaElement as HTMLImageElement).naturalWidth > 0
          ) {
            const img = mediaElement as HTMLImageElement;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            const aspectRatio = naturalWidth / naturalHeight;

            // 基于容器宽度计算合适的高度
            const containerWidth = Math.min(width, window.innerWidth * 0.6); // 最大60%视口宽度
            const calculatedHeight = containerWidth / aspectRatio;

            setMediaWidth(containerWidth);
            setMediaHeight(
              Math.min(calculatedHeight, window.innerHeight * 0.5)
            ); // 最大50%视口高度
          } else {
            setMediaWidth(width);
            setMediaHeight(height);
          }
        }
      };

      // 初始设置
      const timer = setTimeout(updateDimensions, 100);

      // 监听窗口大小变化
      window.addEventListener("resize", updateDimensions);

      // 对于图片，监听加载事件
      const mediaElement = mediaRef.current?.querySelector("#media-preview") as
        | HTMLImageElement
        | HTMLVideoElement;
      if (mediaElement && mediaElement.tagName === "IMG") {
        const img = mediaElement as HTMLImageElement;
        img.addEventListener("load", updateDimensions);
        // 如果图片已经加载完成，立即更新尺寸
        if (img.complete) {
          updateDimensions();
        }
      }

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateDimensions);
        if (mediaElement && mediaElement.tagName === "IMG") {
          const img = mediaElement as HTMLImageElement;
          img.removeEventListener("load", updateDimensions);
        }
      };
    }
  }, [open, media]);

  // 获取媒体详情
  useEffect(() => {
    if (open && media) {
      const fetchMediaDetails = async () => {
        try {
          const response = await apiClient.getMedia(media.id);
          setMediaDetails(response.data);
          // 重置展开状态
          setExpandedCategories(false);
          setExpandedTags(false);
        } catch (error) {
          console.error("Failed to fetch media details:", error);
        }
      };

      fetchMediaDetails();
    } else {
      setMediaDetails(null);
    }
  }, [open, media]);

  // 键盘事件处理
  useEffect(() => {
    if (!open || !mediaList || !onMediaChange) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateMedia(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateMedia(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, mediaList, media, onMediaChange]);

  // 媒体切换函数
  const navigateMedia = (direction: number) => {
    if (!mediaList || !media || !onMediaChange) return;

    const currentIndex = mediaList.findIndex((item) => item.id === media.id);
    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = mediaList.length - 1;
    if (newIndex >= mediaList.length) newIndex = 0;

    onMediaChange(mediaList[newIndex]);
  };

  const handleDownload = async (mediaItem: MediaListItem) => {
    try {
      const response = await fetch(mediaItem.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mediaItem.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleCopyUrl = () => {
    if (media?.file_url) {
      // 构建完整的URL用于分享
      let fullUrl: string;

      if (
        media.file_url.startsWith("http://") ||
        media.file_url.startsWith("https://")
      ) {
        // 如果已经是完整URL，直接使用
        fullUrl = media.file_url;
      } else {
        // 如果是相对路径，构建完整URL
        const baseUrl = window.location.origin;
        fullUrl = `${baseUrl}${media.file_url.startsWith("/") ? "" : "/"}${
          media.file_url
        }`;
      }

      handleCopyText(fullUrl);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      // 方案1: 优先使用现代 Clipboard API (HTTPS/localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("已复制到剪贴板");
        console.log("✓ Text copied using Clipboard API:", text);
        return;
      }
    } catch (err) {
      console.log("Clipboard API failed, trying fallback:", err);
    }

    // 方案2: HTTP 环境备用方案 - 使用 execCommand
    try {
      // 创建临时 textarea
      const textarea = document.createElement("textarea");
      textarea.value = text;

      // 关键：设置样式使其不可见但仍然可以被选中
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";

      document.body.appendChild(textarea);

      // 选中文本
      textarea.focus();
      textarea.select();

      // 尝试复制
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        toast.success("已复制到剪贴板");
        console.log("✓ Text copied using execCommand:", text);
        return;
      }

      throw new Error("execCommand failed");
    } catch (err) {
      console.error("All copy methods failed:", err);
      toast.error("复制失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[96vw] max-h-[95vh] p-0 overflow-hidden rounded-2xl [&>button:last-child]:hidden"
        style={{
          maxWidth: "1600px",
          height: "auto",
          maxHeight: "95vh",
        }}
      >
        {/* 自定义X关闭按钮 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground bg-background/80 backdrop-blur-sm border h-8 w-8 p-0 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {/* 自定义头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-background to-muted/20">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-semibold truncate">
                {media?.title}
              </DialogTitle>
              {mediaList && mediaList.length > 1 && media && (
                <Badge variant="outline" className="text-xs px-2 py-1">
                  {mediaList.findIndex((item) => item.id === media.id) + 1} /{" "}
                  {mediaList.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mr-12">
            <Button variant="outline" size="sm" onClick={handleCopyUrl}>
              <Copy className="h-3 w-3 mr-1" />
              复制链接
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(media!)}
            >
              <Download className="h-3 w-3 mr-1" />
              下载
            </Button>
          </div>
        </div>

        {media && (
          <div
            className="flex"
            style={{
              height: `min(max(${mediaHeight + 120}px, 400px), 75vh)`,
              minHeight: "400px",
            }}
          >
            {/* 左侧：媒体预览区域 - 占据70%宽度 */}
            <div
              ref={mediaRef}
              className="w-[60%] flex items-center justify-center bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50 p-6 relative"
            >
              {/* 左切换按钮 */}
              {mediaList && mediaList.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigateMedia(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 z-10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {/* 右切换按钮 */}
              {mediaList && mediaList.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigateMedia(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background/90 z-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              <div className="w-full flex items-center justify-center">
                {isPreviewable(media.file_type) ? (
                  media.file_type === "image" ? (
                    <div className="relative group max-w-full">
                      <img
                        src={media.file_url}
                        alt={media.title}
                        className="max-w-full max-h-[calc(60vh-6rem)] object-contain rounded-xl shadow-2xl transition-transform group-hover:scale-[1.02]"
                        id="media-preview"
                        style={{
                          maxHeight: "calc(45vh - 4rem)",
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                    </div>
                  ) : (
                    <video
                      src={media.file_url}
                      controls
                      className="max-w-full max-h-[calc(60vh-6rem)] rounded-xl shadow-2xl"
                      id="media-preview"
                      style={{
                        maxHeight: "calc(45vh - 4rem)",
                      }}
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8">
                    <div className="w-32 h-32 bg-muted rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                      <FileIcon
                        mimeType={media.file_type}
                        size="lg"
                        className="text-muted-foreground"
                      />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      无法预览此文件
                    </h3>
                    <p className="text-muted-foreground mb-6 text-sm">
                      此文件类型不支持预览
                    </p>
                    <Button
                      onClick={() => handleDownload(media)}
                      className="px-6"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载文件
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：详细信息面板 - 占据30%宽度，支持滚动 */}
            <div className="w-[40%] border-l bg-background/50 backdrop-blur-sm p-4">
              <div className="h-full overflow-y-auto overflow-x-hidden">
                {/* 媒体详情 - 单列紧凑显示 */}
                <div className="space-y-4 h-full">
                  {/* 基本信息 */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <FileImage className="h-4 w-4" />
                      基本信息
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">类型:</span>
                        <span className="font-medium">
                          {media.file_type === "image" ? "图片" : "视频"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">格式:</span>
                        <span className="font-medium">
                          {media.file_url.split(".").pop()?.toUpperCase() ||
                            "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">大小:</span>
                        <span className="font-medium">
                          {(media.file_size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">创建:</span>
                        <span className="font-medium">
                          {new Date(media.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 描述 */}
                  {mediaDetails?.description && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          描述
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopyText(mediaDetails.description!)
                          }
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-3 bg-muted/50 rounded text-sm text-muted-foreground leading-relaxed max-h-32 overflow-y-auto">
                        {mediaDetails.description}
                      </div>
                    </div>
                  )}

                  {/* 提示词 */}
                  {mediaDetails?.prompt && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          提示词
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyText(mediaDetails.prompt!)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded max-h-40 overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-mono text-blue-900 dark:text-blue-100 leading-normal">
                          {mediaDetails.prompt}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* 分类和标签 */}
                  <div className="flex gap-4">
                    {/* 分类 */}
                    {mediaDetails?.categories &&
                      mediaDetails.categories.length > 0 && (
                        <div className="flex-1">
                          <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            分类
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {mediaDetails.categories
                              .slice(
                                0,
                                expandedCategories
                                  ? mediaDetails.categories.length
                                  : 3
                              )
                              .map((category) => (
                                <Badge
                                  key={category.id}
                                  variant="default"
                                  className="text-sm px-2 py-1"
                                >
                                  {category.name}
                                </Badge>
                              ))}
                            {mediaDetails.categories.length > 3 && (
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() =>
                                  setExpandedCategories(!expandedCategories)
                                }
                              >
                                {expandedCategories
                                  ? "收起"
                                  : `+${
                                      mediaDetails.categories.length - 3
                                    } 更多`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                    {/* 标签 */}
                    {mediaDetails?.tags && mediaDetails.tags.length > 0 && (
                      <div className="flex-1">
                        <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          标签
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mediaDetails.tags
                            .slice(
                              0,
                              expandedTags ? mediaDetails.tags.length : 5
                            )
                            .map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-sm px-2 py-1"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          {mediaDetails.tags.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setExpandedTags(!expandedTags)}
                            >
                              {expandedTags
                                ? "收起"
                                : `+${mediaDetails.tags.length - 5} 更多`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 加载状态 */}
                  {!mediaDetails && (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      <span className="text-sm text-muted-foreground">
                        加载中...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </DialogContent>
    </Dialog>
  );
}
