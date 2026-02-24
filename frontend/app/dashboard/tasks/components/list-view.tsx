'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageAnalysis } from './analysis-detail-dialog';

interface ListViewProps {
  analyses: ImageAnalysis[];
  getFileUrl: (path: string) => string;
  onViewDetail: (analysis: ImageAnalysis) => void;
  onRetry: (analysis: ImageAnalysis) => void;
  retryingIds: Set<number>;
}

export function ListView({
  analyses,
  getFileUrl,
  onViewDetail,
  onRetry,
  retryingIds,
}: ListViewProps) {
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
    return new Date(dateStr).toLocaleString('zh-CN');
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
    <div className="bg-white rounded-lg shadow">
      <div className="divide-y">
        {analyses.map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              {/* 缩略图 */}
              <div className="w-16 h-16 flex-shrink-0 bg-muted rounded overflow-hidden">
                {item.media_thumbnail ? (
                  <img
                    src={getFileUrl(item.media_thumbnail)}
                    alt={item.media_filename}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FileText className="h-6 w-6 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{item.media_filename}</span>
                  {getStatusBadge(item.status)}
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  {item.model_name} · {formatTime(item.created_at)}
                </div>

                {/* 描述 */}
                {item.status === 'completed' && item.description && (
                  <p className="text-sm text-gray-700 line-clamp-2">{item.description}</p>
                )}

                {/* 错误信息 */}
                {item.status === 'failed' && item.error_message && (
                  <p className="text-sm text-red-600">{item.error_message}</p>
                )}

                {/* 分类 */}
                {item.status === 'completed' && item.media_category && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                      {item.media_category.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onViewDetail(item)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="查看详情"
                >
                  <FileText className="h-4 w-4" />
                </button>
                {item.status === 'processing' ? (
                  <div className="p-2 text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <button
                    onClick={() => onRetry(item)}
                    disabled={retryingIds.has(item.id)}
                    className={cn(
                      'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                      item.status === 'pending'
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-orange-600 hover:bg-orange-50'
                    )}
                    title={
                      retryingIds.has(item.id) ? '处理中...' :
                      item.status === 'completed' ? '重新分析' :
                      item.status === 'pending' ? '等待处理' : '重试'
                    }
                  >
                    {retryingIds.has(item.id) || item.status === 'pending' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
