'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageAnalysis } from './analysis-detail-dialog';

interface GridViewProps {
  analyses: ImageAnalysis[];
  getFileUrl: (path: string) => string;
  onViewDetail: (analysis: ImageAnalysis) => void;
  onRetry: (analysis: ImageAnalysis) => void;
  retryingIds: Set<number>;
}

export function GridView({
  analyses,
  getFileUrl,
  onViewDetail,
  onRetry,
  retryingIds,
}: GridViewProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: '待处理' },
      processing: { color: 'bg-blue-100 text-blue-800', label: '分析中' },
      completed: { color: 'bg-green-100 text-green-800', label: '已完成' },
      failed: { color: 'bg-red-100 text-red-800', label: '失败' },
      cancelled: { color: 'bg-gray-100 text-gray-800', label: '已取消' },
    };
    const info = statusMap[status] || statusMap.pending;
    return (
      <Badge variant="secondary" className={cn('text-xs', info.color)}>
        {info.label}
      </Badge>
    );
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>暂无分析记录</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {analyses.map((item) => (
        <Card
          key={item.id}
          className="group overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        >
          {/* 图片区域 */}
          <div className="aspect-square bg-muted relative overflow-hidden">
            {item.media_thumbnail ? (
              <img
                src={getFileUrl(item.media_thumbnail)}
                alt={item.media_filename}
                loading="lazy"
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>
            )}

            {/* 状态标签 */}
            <div className="absolute top-2 left-2">
              {getStatusBadge(item.status)}
            </div>

            {/* 操作按钮 */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetail(item);
                }}
                className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm"
                title="查看详情"
              >
                <FileText className="h-4 w-4" />
              </button>
              {item.status !== 'processing' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(item);
                  }}
                  disabled={retryingIds.has(item.id)}
                  className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm disabled:opacity-50"
                  title={item.status === 'completed' ? '重新分析' : '重试'}
                >
                  {retryingIds.has(item.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {/* 处理中遮罩 */}
            {item.status === 'processing' && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* 信息区域 */}
          <CardContent className="p-2.5 space-y-1.5">
            {/* 文件名 */}
            <p className="text-xs font-medium truncate" title={item.media_filename}>
              {item.media_filename}
            </p>

            {/* 模型和时间 */}
            <div className="text-xs text-muted-foreground truncate">
              {item.model_name} · {formatTime(item.created_at)}
            </div>

            {/* 描述 */}
            {item.status === 'completed' && item.description && (
              <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
            )}

            {/* 错误信息 */}
            {item.status === 'failed' && item.error_message && (
              <p className="text-xs text-red-600 truncate" title={item.error_message}>
                {item.error_message}
              </p>
            )}

            {/* 分类 */}
            {item.status === 'completed' && item.media_category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {item.media_category.name}
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
