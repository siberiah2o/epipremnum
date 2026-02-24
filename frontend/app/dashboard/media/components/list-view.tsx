'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ImageIcon, Sparkles, Loader2, Clock, CheckCircle2, XCircle, Ban, Eye } from 'lucide-react';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ListViewProps {
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
  startIndex?: number;
}

// 分析状态配置
const statusConfig: Record<string, {
  icon: typeof Clock;
  label: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  pending: {
    icon: Clock,
    label: '待处理',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
  },
  processing: {
    icon: Loader2,
    label: '分析中',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
  },
  failed: {
    icon: XCircle,
    label: '失败',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  cancelled: {
    icon: Ban,
    label: '已取消',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
  },
};

// 分析状态徽章组件
function AnalysisBadge({ status }: { status: keyof typeof statusConfig | null | undefined }) {
  if (!status) return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      config.color,
      config.bgColor
    )}>
      <Icon className={cn('h-3.5 w-3.5', config.animate && 'animate-spin')} />
      <span>{config.label}</span>
    </div>
  );
}

export function ListView({
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
  onToggleItem,
  startIndex = 0
}: ListViewProps) {
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
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {media.map((item, index) => {
          const isSelected = selectedItems?.has(item.id);
          const isAnalyzing = analyzingItems?.has(item.id);

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-4 p-4 transition-all duration-200 cursor-pointer',
                'hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent dark:hover:from-gray-800/50 dark:hover:to-transparent',
                isSelected && 'bg-blue-50/50 dark:bg-blue-950/30'
              )}
              onClick={() => isSelectMode ? onToggleItem?.(item.id) : undefined}
            >
              {/* 选择复选框 */}
              {isSelectMode && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleItem?.(item.id)}
                  className="flex-shrink-0"
                />
              )}

              {/* 序号 */}
              <div className="w-8 text-center text-sm text-muted-foreground font-mono">
                {startIndex + index + 1}
              </div>

              {/* 缩略图 */}
              <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 overflow-hidden flex-shrink-0 shadow-sm">
                {item.thumbnail_url ? (
                  <Image
                    src={getFileUrl(item.thumbnail_url)}
                    alt={item.filename}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate" title={item.filename}>
                  {item.filename}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  {formatFileSize(item.file_size)}
                </p>
              </div>

              {/* 分类标签 */}
              {item.category_name ? (
                <Badge variant="secondary" className="text-xs">
                  {item.category_name}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">未分类</span>
              )}

              {/* 分析状态 */}
              <AnalysisBadge status={item.analysis_status} />

              {/* 操作按钮 */}
              {!isSelectMode && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail(item);
                    }}
                    className="h-8 px-3 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    查看
                  </Button>
                  {onAnalyzeClick && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyzeClick(item);
                      }}
                      disabled={isAnalyzing}
                      className={cn(
                        'h-8 px-3',
                        isAnalyzing
                          ? 'text-blue-500'
                          : 'text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                      )}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          分析
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(item);
                    }}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
