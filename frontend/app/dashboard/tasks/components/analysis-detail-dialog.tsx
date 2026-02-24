'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface MediaCategory {
  id: number;
  name: string;
}

export interface ImageAnalysis {
  id: number;
  status: string;
  description: string;
  media_category?: MediaCategory | null;
  error_message: string;
  error_type: string;
  error_details: any;
  created_at: string;
  completed_at: string;
  model_name: string;
  endpoint_name: string;
  media_filename: string;
  media_thumbnail: string;
  media: number;
  method: string;
  tokens_used: number;
  retry_count: number;
}

interface AnalysisDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: ImageAnalysis | null;
}

export function AnalysisDetailDialog({ open, onOpenChange, analysis }: AnalysisDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ImageAnalysis | null>(null);

  useEffect(() => {
    if (open && analysis) {
      setDetail(analysis);
    }
  }, [open, analysis]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  // 获取文件URL (与媒体库相同的逻辑)
  const getFileUrl = (path: string | undefined) => {
    if (!path) return '';
    let filePath = path;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const url = new URL(path);
        filePath = url.pathname;
      } catch {
        return path;
      }
    }
    if (filePath.startsWith('/upload/')) {
      filePath = filePath.slice(8);
    } else if (filePath.startsWith('upload/')) {
      filePath = filePath.slice(7);
    }
    return `/api/media/file/${filePath}`;
  };

  const getStatusBadge = () => {
    if (!detail) return null;
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: '待处理' },
      processing: { color: 'bg-blue-100 text-blue-800', label: '分析中' },
      completed: { color: 'bg-green-100 text-green-800', label: '已完成' },
      failed: { color: 'bg-red-100 text-red-800', label: '失败' },
      cancelled: { color: 'bg-gray-100 text-gray-800', label: '已取消' },
    };
    const info = statusMap[detail.status] || statusMap.pending;
    return <span className={`px-2 py-1 text-xs rounded-full ${info.color}`}>{info.label}</span>;
  };

  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">图片分析详情</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {detail.media_filename}
              </p>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 图片预览 */}
            {detail.media_thumbnail && (
              <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
                <Image
                  src={getFileUrl(detail.media_thumbnail)}
                  alt={detail.media_filename}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">状态</div>
                <div>{getStatusBadge()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">使用模型</div>
                <div className="font-medium">{detail.model_name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">API 端点</div>
                <div className="font-medium">{detail.endpoint_name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">分析方法</div>
                <div className="font-medium">{detail.method === 'single' ? '单次请求' : '多次请求'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">创建时间</div>
                <div className="text-sm">{formatTime(detail.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">完成时间</div>
                <div className="text-sm">{formatTime(detail.completed_at)}</div>
              </div>
              {detail.tokens_used && (
                <div>
                  <div className="text-sm text-gray-500">Token 使用</div>
                  <div className="text-sm">{detail.tokens_used}</div>
                </div>
              )}
              {detail.retry_count > 0 && (
                <div>
                  <div className="text-sm text-gray-500">重试次数</div>
                  <div className="text-sm">{detail.retry_count}</div>
                </div>
              )}
            </div>

            {/* 分析结果 */}
            {detail.status === 'completed' && (
              <div className="space-y-4">
                {/* 描述 */}
                {detail.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">图片描述</div>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {detail.description}
                    </p>
                  </div>
                )}

                {/* 分类 */}
                {detail.media_category && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">分类</div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                      {detail.media_category.name}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {detail.status === 'failed' && (
              <div className="space-y-3">
                {detail.error_message && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">错误信息</div>
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      {detail.error_message}
                    </div>
                  </div>
                )}
                {detail.error_type && detail.error_type !== 'none' && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">错误类型</div>
                    <div className="text-sm text-gray-600">
                      {detail.error_type}
                    </div>
                  </div>
                )}
                {detail.error_details && Object.keys(detail.error_details).length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">详细信息</div>
                    <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(detail.error_details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
