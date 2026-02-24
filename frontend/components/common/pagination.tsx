/**
 * 分页组件
 */
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** 当前页码（从1开始） */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 总条数 */
  total?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 页码变化回调 */
  onPageChange: (page: number) => void;
  /** 每页数量变化回调 */
  onPageSizeChange?: (size: number) => void;
  /** 可选的每页数量 */
  pageSizeOptions?: number[];
  /** 是否显示总条数 */
  showTotal?: boolean;
  /** 是否显示跳转 */
  showQuickJumper?: boolean;
  /** 是否简化模式 */
  simple?: boolean;
  /** 自定义类名 */
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showTotal = true,
  simple = false,
  className,
}: PaginationProps) {
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // 计算显示的页码范围
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      {/* 左侧信息 */}
      {showTotal && total !== undefined && (
        <div className="text-sm text-muted-foreground">
          共 {total} 条
        </div>
      )}

      {/* 分页控制 */}
      <div className="flex items-center gap-1">
        {/* 首页 */}
        {!simple && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}

        {/* 上一页 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 页码 */}
        {!simple ? (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              )
            ))}
          </div>
        ) : (
          <span className="px-3 text-sm">
            {currentPage} / {totalPages}
          </span>
        )}

        {/* 下一页 */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* 末页 */}
        {!simple && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 每页数量选择 */}
      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 px-2 text-sm border rounded-md bg-background"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} 条/页
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * 简单分页（用于列表底部）
 */
export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: Omit<PaginationProps, 'total' | 'pageSize' | 'onPageSizeChange'>) {
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (totalPages <= 1) return null;

  return (
    <div className={cn('flex items-center justify-center gap-4', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
      >
        上一页
      </Button>
      <span className="text-sm text-muted-foreground">
        {currentPage} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
      >
        下一页
      </Button>
    </div>
  );
}
