'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TasksHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
}

export function TasksHeader({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  stats,
  filteredCount,
  currentPage,
  totalPages,
  itemsPerPage,
  startIndex,
  endIndex,
  onPageChange,
  onItemsPerPageChange,
  refreshing,
  onRefresh,
}: TasksHeaderProps) {
  return (
    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-1">
      {/* 搜索框 */}
      <div className="relative w-[180px] flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索文件名..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* 状态筛选 */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[100px] h-9 flex-shrink-0">
          <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="pending">待处理</SelectItem>
          <SelectItem value="processing">处理中</SelectItem>
          <SelectItem value="completed">已完成</SelectItem>
          <SelectItem value="failed">失败</SelectItem>
        </SelectContent>
      </Select>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-border flex-shrink-0" />

      {/* 统计信息 - 紧凑显示 */}
      <div className="flex items-center gap-1.5 text-sm flex-shrink-0">
        <span className="text-muted-foreground">总计</span>
        <span className="font-semibold">{stats.total}</span>
        <span className="text-muted-foreground mx-1">|</span>
        <span className="text-yellow-600">{stats.pending}</span>
        <span className="text-muted-foreground">待</span>
        <span className="text-blue-600">{stats.processing}</span>
        <span className="text-muted-foreground">中</span>
        <span className="text-green-600">{stats.completed}</span>
        <span className="text-muted-foreground">成</span>
        <span className="text-red-600">{stats.failed}</span>
        <span className="text-muted-foreground">败</span>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-border flex-shrink-0" />

      {/* 刷新按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        className={cn('h-9 flex-shrink-0', refreshing && 'text-blue-600')}
      >
        <RefreshCw className={cn('h-4 w-4 mr-1.5', refreshing && 'animate-spin')} />
        {refreshing ? '停止' : '刷新'}
      </Button>

      {/* 分隔线 */}
      <div className="w-px h-5 bg-border flex-shrink-0" />

      {/* 视图切换 */}
      <div className="flex items-center p-1 bg-muted rounded-md flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange('grid')}
          className={cn('h-8 w-8 p-0', viewMode === 'grid' && 'bg-background shadow-sm')}
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange('list')}
          className={cn('h-8 w-8 p-0', viewMode === 'list' && 'bg-background shadow-sm')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      {/* 分页控制 - 右侧 */}
      {filteredCount > 0 && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select
              value={String(itemsPerPage)}
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
            >
              <SelectTrigger size="default" className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
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
                {currentPage} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
