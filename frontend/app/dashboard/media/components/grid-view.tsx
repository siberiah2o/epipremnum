'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ImageIcon, Sparkles, Loader2, Clock, CheckCircle2, XCircle, Ban, Eye } from 'lucide-react';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GridViewProps {
  media: Media[];
  totalCount: number;
  getFileUrl: (path: string | undefined) => string;
  formatFileSize: (bytes: number) => string;
  onViewDetail: (item: Media) => void;
  onDeleteClick: (item: Media) => void;
  onAnalyzeClick?: (item: Media) => void;
  analyzingItems?: Set<number>;
  isSelectMode?: boolean;
  selectedItems?: Set<number>;
  onToggleItem?: (id: number) => void;
}

// 分析状态配置
const statusConfig: Record<string, {
  icon: typeof Clock;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  animate?: boolean;
}> = {
  pending: {
    icon: Clock,
    label: '待处理',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  processing: {
    icon: Loader2,
    label: '分析中',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  failed: {
    icon: XCircle,
    label: '失败',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  cancelled: {
    icon: Ban,
    label: '已取消',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

// 分析状态徽章组件
function AnalysisBadge({ status }: { status: keyof typeof statusConfig | null | undefined }) {
  if (!status) return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      config.color,
      config.bgColor,
      config.borderColor
    )}>
      <Icon className={cn('h-3 w-3', config.animate && 'animate-spin')} />
      <span>{config.label}</span>
    </div>
  );
}

export function GridView({
  media,
  totalCount,
  getFileUrl,
  formatFileSize,
  onViewDetail,
  onDeleteClick,
  onAnalyzeClick,
  analyzingItems,
  isSelectMode,
  selectedItems,
  onToggleItem
}: GridViewProps) {
  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full blur-2xl opacity-60" />
          <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-full p-8 border border-blue-100">
            <ImageIcon className="h-16 w-16 text-blue-400" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {totalCount === 0 ? '还没有上传任何图片' : '没有找到匹配的图片'}
        </h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {totalCount === 0
            ? '点击上方的"上传图片"按钮，开始添加您的第一张图片'
            : '尝试调整搜索条件或筛选分类，查找您需要的图片'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
      {media.map((item) => {
        const isSelected = selectedItems?.has(item.id);
        const isAnalyzing = analyzingItems?.has(item.id);

        return (
          <Card
            key={item.id}
            className={cn(
              'group relative overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer',
              'bg-white dark:bg-gray-900',
              isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
            )}
          >
            {/* 图片容器 */}
            <div
              className="relative aspect-square bg-muted overflow-hidden"
              onClick={() => isSelectMode ? onToggleItem?.(item.id) : onViewDetail(item)}
            >
              {item.thumbnail_url ? (
                <Image
                  src={getFileUrl(item.thumbnail_url)}
                  alt={item.filename}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                </div>
              )}

              {/* 选择模式复选框 */}
              {isSelectMode && (
                <div className="absolute top-3 left-3 z-20">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleItem?.(item.id)}
                    className="bg-white/90 dark:bg-gray-900/90 border-2 shadow-sm"
                  />
                </div>
              )}

              {/* 悬停遮罩 - 仅删除按钮 */}
              {!isSelectMode && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {/* 删除按钮 - 右上角 */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(item);
                    }}
                    className="absolute top-3 right-3 h-8 w-8 bg-black/30 hover:bg-red-500 text-white hover:text-white backdrop-blur-sm transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* 分析状态徽章 */}
              {item.analysis_status && (
                <div className="absolute top-3 right-3 z-10 group-hover:opacity-0 transition-opacity">
                  <AnalysisBadge status={item.analysis_status} />
                </div>
              )}
            </div>

            {/* 信息区域 */}
            <div className="px-2 py-1.5 bg-card">
              {/* 文件名 */}
              <p className="text-xs font-medium truncate" title={item.filename}>
                {item.filename}
              </p>

              {/* 分类、大小和操作按钮 */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  {item.category_name && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 shrink-0 font-normal">
                      {item.category_name}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {formatFileSize(item.file_size)}
                  </span>
                </div>
                <div className="flex items-center shrink-0 -mr-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail(item);
                    }}
                    className="h-5 w-5"
                    title="查看"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  {onAnalyzeClick && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyzeClick(item);
                      }}
                      disabled={isAnalyzing}
                      className="h-5 w-5"
                      title="分析"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
