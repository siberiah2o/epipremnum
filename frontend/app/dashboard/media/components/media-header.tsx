'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Upload,
  Loader2,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  X,
  FolderOpen,
  Zap
} from 'lucide-react';
import type { Category, Media } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MediaHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: Category[];
  categoryCounts: Map<string, number>;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  uploading: boolean;
  onUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number) => void;
  isSelectMode: boolean;
  selectedCount: number;
  paginatedMedia: Media[];
  selectedItems: Set<number>;
  batchAnalyzing: boolean;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onBatchAnalyze: () => void;
}

export function MediaHeader({
  searchQuery,
  onSearchChange,
  categories,
  categoryCounts,
  selectedCategory,
  onCategoryChange,
  viewMode,
  onViewModeChange,
  uploading,
  onUploadClick,
  fileInputRef,
  onFileChange,
  filteredCount,
  currentPage,
  totalPages,
  itemsPerPage,
  startIndex,
  endIndex,
  onPageChange,
  onItemsPerPageChange,
  isSelectMode,
  selectedCount,
  paginatedMedia,
  selectedItems,
  batchAnalyzing,
  onToggleSelectMode,
  onSelectAll,
  onBatchAnalyze,
}: MediaHeaderProps) {
  const allSelected = paginatedMedia.length > 0 && paginatedMedia.every(item => selectedItems.has(item.id));

  return (
    <div className="space-y-3">
      {/* 主工具栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 搜索框 */}
        <div className="relative w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文件名..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* 分类筛选 */}
        <Select value={selectedCategory || 'all'} onValueChange={(value) => onCategoryChange(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[140px] h-9">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="所有分类" />
          </SelectTrigger>
          <SelectContent className="!max-h-[280px]" position="popper" align="start">
            <SelectItem value="all">所有分类</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.name}>
                <div className="flex items-center gap-2">
                  <span>{cat.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {categoryCounts.get(cat.name) || 0}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 分隔线 */}
        <div className="w-px h-5 bg-border" />

        {/* 批量操作 / 上传 */}
        {isSelectMode ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSelectAll}>
              {allSelected ? '取消全选' : '全选'}
            </Button>
            <span className="text-sm text-muted-foreground">已选 {selectedCount} 项</span>
            <Button size="sm" onClick={onBatchAnalyze} disabled={selectedCount === 0 || batchAnalyzing}>
              {batchAnalyzing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  分析中
                </>
              ) : (
                <>
                  <Zap className="mr-1.5 h-4 w-4" />
                  批量分析
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleSelectMode}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onToggleSelectMode}>
              <CheckSquare className="h-4 w-4 mr-1.5" />
              批量操作
            </Button>
            <Button size="sm" onClick={onUploadClick} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  上传中
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  上传图片
                </>
              )}
            </Button>
          </div>
        )}

        {/* 分隔线 */}
        <div className="w-px h-5 bg-border" />

        {/* 视图切换 */}
        <div className="flex items-center p-0.5 bg-muted rounded-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className={cn('h-7 w-7 p-0', viewMode === 'grid' && 'bg-background shadow-sm')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={cn('h-7 w-7 p-0', viewMode === 'list' && 'bg-background shadow-sm')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* 分页控制 - 右侧 */}
        {filteredCount > 0 && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => onItemsPerPageChange(Number(value))}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                  <SelectItem value="96">96</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {startIndex + 1}-{Math.min(endIndex, filteredCount)} / {filteredCount}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2 min-w-[50px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
        disabled={uploading}
      />
    </div>
  );
}
