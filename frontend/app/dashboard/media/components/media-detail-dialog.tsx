'use client';

import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Check, Clock, Loader2, XIcon, Pencil, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { Media } from '@/lib/types';
import { llmAnalysisApi } from '@/lib/api-client';

interface MediaDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItem: Media | null;
  allItems: Media[];
  setCurrentItem: (item: Media) => void;
  getFileUrl: (path: string | undefined) => string;
  formatFileSize: (bytes: number) => string;
  onDescriptionUpdate?: (mediaId: number, newDescription: string) => void;
}

// 分析状态组件
function AnalysisStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Clock className="h-3 w-3" />
          待处理
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 animate-spin" />
          分析中
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-700 hover:bg-green-100">
          <Check className="h-3 w-3" />
          已完成
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-red-100 text-red-700 hover:bg-red-100">
          <XIcon className="h-3 w-3" />
          失败
        </Badge>
      );
    default:
      return null;
  }
}

export function MediaDetailDialog({
  open,
  onOpenChange,
  currentItem,
  allItems,
  setCurrentItem,
  getFileUrl,
  formatFileSize,
  onDescriptionUpdate,
}: MediaDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 当currentItem变化时，重置编辑状态
  useEffect(() => {
    setIsEditing(false);
    setEditText('');
  }, [currentItem?.id]);

  // 切换到上一个/下一个
  const handlePrevious = useCallback(() => {
    if (!currentItem) return;
    const currentIndex = allItems.findIndex(item => item.id === currentItem.id);
    if (currentIndex === -1) return;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : allItems.length - 1;
    setCurrentItem(allItems[newIndex]);
  }, [currentItem, allItems, setCurrentItem]);

  const handleNext = useCallback(() => {
    if (!currentItem) return;
    const currentIndex = allItems.findIndex(item => item.id === currentItem.id);
    if (currentIndex === -1) return;
    const newIndex = currentIndex < allItems.length - 1 ? currentIndex + 1 : 0;
    setCurrentItem(allItems[newIndex]);
  }, [currentItem, allItems, setCurrentItem]);

  // 复制描述
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  // 开始编辑
  const handleStartEdit = () => {
    if (currentItem?.analysis_description) {
      setEditText(currentItem.analysis_description);
      setIsEditing(true);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  // 保存描述
  const handleSaveDescription = async () => {
    if (!currentItem?.analysis_id) {
      toast.error('没有找到分析记录');
      return;
    }

    setIsSaving(true);
    try {
      const response = await llmAnalysisApi.updateDescription(
        currentItem.analysis_id,
        editText
      );

      if (response.code === 200) {
        toast.success('描述已更新');
        setIsEditing(false);

        // 通知父组件更新数据
        if (onDescriptionUpdate) {
          onDescriptionUpdate(currentItem.id, editText);
        }

        // 更新当前项的描述（本地更新）
        setCurrentItem({
          ...currentItem,
          analysis_description: editText,
        });
      } else {
        toast.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存描述失败:', error);
      toast.error('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 键盘切换图片
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open || !currentItem) return;

    // 如果正在编辑，不处理键盘事件
    if (isEditing) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  }, [open, currentItem, isEditing, handlePrevious, handleNext, onOpenChange]);

  // 监听键盘事件
  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // 获取当前位置
  const currentIndex = currentItem ? allItems.findIndex(item => item.id === currentItem.id) : -1;
  const position = currentIndex >= 0 ? `${currentIndex + 1} / ${allItems.length}` : '';

  // 是否可以编辑（只有已完成分析且有分析ID的才能编辑）
  const canEdit = currentItem?.analysis_status === 'completed' && currentItem?.analysis_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="sr-only">图片详情</DialogTitle>
        <DialogDescription className="sr-only">查看图片的详细信息</DialogDescription>
        {currentItem && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* 图片预览 */}
            <div className="aspect-square bg-muted rounded-lg overflow-hidden relative group">
              <img
                src={getFileUrl(currentItem.file_url)}
                alt={currentItem.filename}
                className="object-cover w-full h-full"
              />

              {/* 左箭头 */}
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="上一个 (←)"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* 右箭头 */}
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
                title="下一个 (→)"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* 位置指示器 */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-200">
                {position} · 使用 ← → 键切换
              </div>
            </div>

            {/* 详情信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold truncate" title={currentItem.filename}>
                  {currentItem.filename}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {currentItem.analysis_status && (
                    <AnalysisStatusBadge status={currentItem.analysis_status} />
                  )}
                  {currentItem.category_name && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      {currentItem.category_name}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">文件大小</span>
                  <span>{formatFileSize(currentItem.file_size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">格式</span>
                  <span>{currentItem.mime_type?.split('/')[1]?.toUpperCase()}</span>
                </div>
                {currentItem.width && currentItem.height && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">尺寸</span>
                    <span>{currentItem.width} × {currentItem.height}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{new Date(currentItem.created_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {/* AI描述区域 - 支持编辑 */}
              {(currentItem.analysis_description || canEdit) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">AI 描述</p>
                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <>
                          {currentItem.analysis_description && (
                            <button
                              onClick={() => handleCopy(currentItem.analysis_description!)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title={copied ? '已复制' : '复制描述'}
                            >
                              {copied ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                </svg>
                              )}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={handleStartEdit}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="编辑描述"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="输入描述..."
                        className="min-h-[100px] text-sm"
                        disabled={isSaving}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveDescription}
                          disabled={isSaving || !editText.trim()}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 mr-1" />
                          )}
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded leading-relaxed">
                      {currentItem.analysis_description || '暂无描述'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  关闭
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
