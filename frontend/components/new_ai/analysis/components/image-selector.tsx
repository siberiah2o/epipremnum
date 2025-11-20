"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Image, Keyboard } from "lucide-react";
import type {
  MediaFile,
  PaginationState,
  KeyboardNavigationState,
} from "../types/analysis";

interface ImageSelectorProps {
  imageFiles: MediaFile[];
  selectedFile: MediaFile | null;
  loading: boolean;
  pagination: PaginationState;
  keyboardNav: KeyboardNavigationState;
  onFileSelect: (file: MediaFile, index: number) => void;
  onPageSizeChange: (newPageSize: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageClick: (page: number) => void;
  setKeyboardNavEnabled: (enabled: boolean) => void;
}

export function ImageSelector({
  imageFiles,
  selectedFile,
  loading,
  pagination,
  keyboardNav,
  onFileSelect,
  onPageSizeChange,
  onPrevPage,
  onNextPage,
  onPageClick,
  setKeyboardNavEnabled,
}: ImageSelectorProps) {
  const { currentPage, totalPages, totalFiles, pageSize } = pagination;

  return (
    <Card className="flex-1 flex flex-col min-h-0 gap-2">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="m-0">图片素材</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onMouseEnter={() => setKeyboardNavEnabled(true)}
                    onMouseLeave={() =>
                      !keyboardNav.focusedIndex && setKeyboardNavEnabled(false)
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
                        自动选择并切换图片
                      </div>
                      <div>
                        •{" "}
                        <kbd className="px-1 py-0.5 bg-background border rounded">
                          Enter
                        </kbd>{" "}
                        触发AI分析
                      </div>
                      <div>
                        •{" "}
                        <kbd className="px-1 py-0.5 bg-background border rounded">
                          A
                        </kbd>{" "}
                        重新确认当前图片
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
          <span className="text-sm text-muted-foreground">{totalFiles} 个</span>
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
                  : imageFiles.map((file, index) => (
                      <div
                        key={file.id}
                        ref={
                          keyboardNav.isKeyboardNavEnabled &&
                          keyboardNav.focusedIndex === index
                            ? (el) => el?.focus()
                            : undefined
                        }
                        tabIndex={
                          keyboardNav.isKeyboardNavEnabled &&
                          keyboardNav.focusedIndex === index
                            ? 0
                            : -1
                        }
                        className={`relative group cursor-pointer overflow-hidden transition-all hover:scale-105 rounded-sm h-16 ${
                          selectedFile?.id === file.id
                            ? "ring-2 ring-primary ring-opacity-50"
                            : ""
                        } ${
                          keyboardNav.isKeyboardNavEnabled &&
                          keyboardNav.focusedIndex === index
                            ? "ring-2 ring-blue-500 ring-opacity-75 scale-110"
                            : ""
                        }`}
                        onClick={() => {
                          onFileSelect(file, index);
                        }}
                      >
                        <div className="relative h-full">
                          <img
                            src={file.thumbnail_url || file.file_url}
                            alt={file.title}
                            className="w-full h-full transition-opacity object-cover object-center"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
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
                          {/* 键盘焦点指示器 - 仅在未选择时显示 */}
                          {keyboardNav.isKeyboardNavEnabled &&
                            keyboardNav.focusedIndex === index &&
                            selectedFile?.id !== file.id && (
                              <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                                <div className="bg-blue-500 rounded-full p-1">
                                  <svg
                                    className="w-4 h-4 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
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
                    第 {currentPage} 页，显示 {(currentPage - 1) * pageSize + 1}{" "}
                    - {Math.min(currentPage * pageSize, totalFiles)} 条，共{" "}
                    {totalFiles} 条
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">每页:</span>
                    <select
                      value={pageSize.toString()}
                      onChange={(e) => onPageSizeChange(e.target.value)}
                      className="w-20 h-8 p-1 border rounded text-sm bg-white"
                    >
                      <option value="12">12</option>
                      <option value="24">24</option>
                      <option value="36">36</option>
                      <option value="48">48</option>
                      <option value="60">60</option>
                      <option value="96">96</option>
                      <option value="120">120</option>
                    </select>
                  </div>
                </div>

                {/* 第二行：分页按钮控制 */}
                <div className="flex items-center justify-center">
                  {/* 上一页 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPrevPage}
                    disabled={currentPage === 1}
                    className="mr-6"
                  >
                    上一页
                  </Button>

                  {/* 页码 */}
                  <div className="flex items-center gap-1 mx-3">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            currentPage === pageNum ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => onPageClick(pageNum)}
                          className="w-14 h-8 p-0 min-w-[3.5rem] text-sm font-medium"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  {/* 下一页 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextPage}
                    disabled={currentPage === totalPages}
                    className="ml-6"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无图片文件</h3>
            <p className="text-muted-foreground">
              请先上传一些图片文件，然后使用AI分析功能
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
