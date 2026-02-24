'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, FileImage, AlignLeft, Tag, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { mediaApi } from '@/lib/api-client';
import { extractPaginatedData } from '@/lib/types';
import { formatFileSize, getFileUrl, debounce, copyToClipboard } from '@/lib/utils';
import { MediaGridSkeleton } from '@/components/common/loading-skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { toast } from 'sonner';
import type { Media } from '@/lib/types';

interface SearchResult extends Media {
  matchReasons: {
    filename: boolean;
    description: boolean;
    category: boolean;
  };
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 防抖搜索
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setDebouncedQuery(query);
    }, 300),
    []
  );

  // 当搜索框内容变化时，触发防抖搜索
  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, hasSearched, debouncedSearch]);

  // 执行搜索（使用后端搜索参数）
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      // 使用后端搜索参数
      const response = await mediaApi.getImages({
        search: query.trim(),
        page_size: 100, // 获取更多结果
      });

      if (response.code === 200) {
        const mediaList = extractPaginatedData<Media>(response);
        const lowerQuery = query.toLowerCase();

        // 在前端进行多维度匹配标记（后端搜索 + 前端标记）
        const searchResults: SearchResult[] = mediaList.map((item) => {
          const matchFilename = item.filename.toLowerCase().includes(lowerQuery);
          const matchDescription = item.analysis_description?.toLowerCase().includes(lowerQuery) ?? false;
          const matchCategory = item.category_name?.toLowerCase().includes(lowerQuery) ?? false;

          return {
            ...item,
            matchReasons: {
              filename: matchFilename,
              description: matchDescription,
              category: matchCategory,
            },
          };
        });

        // 按匹配维度数量排序
        searchResults.sort((a, b) => {
          const aMatches = Object.values(a.matchReasons).filter(Boolean).length;
          const bMatches = Object.values(b.matchReasons).filter(Boolean).length;
          return bMatches - aMatches;
        });

        setResults(searchResults);
      }
    } catch (error) {
      toast.error('搜索失败', { duration: 1000 });
    } finally {
      setSearching(false);
    }
  }, []);

  // 当防抖查询变化时执行搜索
  useEffect(() => {
    if (hasSearched && debouncedQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery, hasSearched, performSearch]);

  // 提交搜索（初始搜索）
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setHasSearched(true);
    setDebouncedQuery(searchQuery);
  };

  // 复制描述
  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 返回初始状态
  const handleBack = () => {
    setHasSearched(false);
    setResults([]);
    setSearchQuery('');
    setDebouncedQuery('');
  };

  return (
    <div className="space-y-8">
      {/* 搜索区域 */}
      {!hasSearched && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">图片搜索</h1>
              <p className="text-muted-foreground">搜索文件名、AI 描述或分类</p>
            </div>
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="搜索图片..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-14 pl-12 pr-32 text-base"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={searching || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
                </Button>
              </div>
            </form>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/media/upload')}
              >
                上传文件
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/media')}
              >
                浏览全部
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {hasSearched && (
        <div className="space-y-6">
          {/* 搜索框 */}
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索图片..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </form>
            <Button variant="outline" onClick={handleBack}>
              返回
            </Button>
          </div>

          {/* 结果统计 */}
          {!searching && (
            <div className="text-sm text-muted-foreground">
              找到 <span className="font-semibold text-foreground">{results.length}</span> 个结果
              {debouncedQuery && (
                <span> for "<span className="font-medium">{debouncedQuery}</span>"</span>
              )}
            </div>
          )}

          {/* 结果网格 */}
          {searching ? (
            <MediaGridSkeleton count={12} />
          ) : results.length === 0 ? (
            <EmptyState
              type="search"
              title="未找到匹配的图片"
              description={debouncedQuery ? `没有找到包含 "${debouncedQuery}" 的图片` : undefined}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map((item) => (
                <Card
                  key={item.id}
                  className="group overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedItem(item);
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    <img
                      src={getFileUrl(item.file)}
                      alt={item.filename}
                      loading="lazy"
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <CardContent className="p-2.5 space-y-2">
                    {/* 文件名 */}
                    <p className="text-xs font-medium truncate" title={item.filename}>{item.filename}</p>

                    {/* 匹配标签 */}
                    <div className="flex flex-wrap gap-1">
                      {item.matchReasons.filename && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 h-4">
                          <FileImage className="h-2.5 w-2.5" />
                          名
                        </Badge>
                      )}
                      {item.matchReasons.description && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 h-4">
                          <AlignLeft className="h-2.5 w-2.5" />
                          描
                        </Badge>
                      )}
                      {item.matchReasons.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 h-4">
                          <Tag className="h-2.5 w-2.5" />
                          类
                        </Badge>
                      )}
                    </div>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatFileSize(item.file_size)}</span>
                      {item.category_name && (
                        <span className="truncate max-w-[60px]" title={item.category_name}>{item.category_name}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">图片详情</DialogTitle>
          <DialogDescription className="sr-only">查看图片的详细信息和匹配维度</DialogDescription>
          {selectedItem && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* 图片预览 */}
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={getFileUrl(selectedItem.file)}
                  alt={selectedItem.filename}
                  className="object-cover w-full h-full"
                />
              </div>

              {/* 详情信息 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold" title={selectedItem.filename}>
                    {selectedItem.filename}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.matchReasons.filename && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <FileImage className="h-3 w-3" />
                        文件名匹配
                      </Badge>
                    )}
                    {selectedItem.matchReasons.description && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <AlignLeft className="h-3 w-3" />
                        描述匹配
                      </Badge>
                    )}
                    {selectedItem.matchReasons.category && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Tag className="h-3 w-3" />
                        分类匹配
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">文件大小</span>
                    <span>{formatFileSize(selectedItem.file_size)}</span>
                  </div>
                  {selectedItem.category_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">分类</span>
                      <span>{selectedItem.category_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{new Date(selectedItem.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                </div>

                {selectedItem.analysis_description && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">AI 描述</p>
                      <button
                        onClick={() => handleCopy(selectedItem.analysis_description!)}
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
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded leading-relaxed">
                      {selectedItem.analysis_description}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push('/dashboard/media')}
                  >
                    前往媒体库
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
