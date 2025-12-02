'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './pagination.css'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showQuickJumper?: boolean
  showTotalPages?: boolean
  maxVisiblePages?: number // 可配置的最大可见页码数
  compact?: boolean // 紧凑模式
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showQuickJumper = true,
  showTotalPages = true,
  maxVisiblePages = 5, // 默认最多显示5个页码
  compact = false
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | string)[] = []

    // 在紧凑模式下，减少可见页码数
    const actualMaxVisible = compact ? Math.min(maxVisiblePages, 3) : maxVisiblePages

    if (totalPages <= actualMaxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // 始终显示第一页
    pages.push(1)

    // 计算当前页周围的显示范围
    const halfVisible = Math.floor((actualMaxVisible - 2) / 2) // 减去第一页和最后一页
    let startPage = Math.max(2, currentPage - halfVisible)
    let endPage = Math.min(totalPages - 1, currentPage + halfVisible)

    // 调整范围以确保显示足够的页码
    if (currentPage <= halfVisible + 1) {
      endPage = Math.min(actualMaxVisible - 1, totalPages - 1)
    }
    if (currentPage >= totalPages - halfVisible) {
      startPage = Math.max(2, totalPages - actualMaxVisible + 2)
    }

    // 添加省略号（如果需要）
    if (startPage > 2) {
      pages.push('...')
    }

    // 添加中间页码
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    // 添加省略号（如果需要）
    if (endPage < totalPages - 1) {
      pages.push('...')
    }

    // 始终显示最后一页
    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const handlePageClick = (page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  const handleQuickJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement
      const page = parseInt(target.value)
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        handlePageClick(page)
      } else {
        target.value = currentPage.toString()
      }
    }
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`flex items-center justify-center ${compact ? 'gap-1' : 'gap-2'} flex-wrap max-w-full overflow-x-auto`}>
      {/* 上一页按钮 */}
      <Button
        variant="outline"
        size={compact ? "sm" : "sm"}
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage <= 1}
        className={`flex items-center ${compact ? 'gap-0.5 px-2' : 'gap-1'} whitespace-nowrap`}
      >
        <ChevronLeft className={`h-4 w-4 ${compact ? 'mr-0' : ''}`} />
        {!compact && '上一页'}
      </Button>

      {/* 页码按钮容器 - 添加溢出处理 */}
      <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'} overflow-x-auto scrollbar-hide scrollbar-thin`}>
        {getPageNumbers().map((page, index) => (
          <span key={index} className="flex-shrink-0">
            {page === '...' ? (
              <span className={`px-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>...</span>
            ) : (
              <Button
                variant={page === currentPage ? 'default' : 'outline'}
                size={compact ? "sm" : "sm"}
                onClick={() => handlePageClick(page as number)}
                className={`${compact ? 'min-w-[2rem] h-8 text-xs px-2' : 'min-w-[2.5rem]'} whitespace-nowrap`}
              >
                {page}
              </Button>
            )}
          </span>
        ))}
      </div>

      {/* 下一页按钮 */}
      <Button
        variant="outline"
        size={compact ? "sm" : "sm"}
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={`flex items-center ${compact ? 'gap-0.5 px-2' : 'gap-1'} whitespace-nowrap`}
      >
        {!compact && '下一页'}
        <ChevronRight className={`h-4 w-4 ${compact ? 'ml-0' : ''}`} />
      </Button>

      {/* 快速跳转 - 在紧凑模式下隐藏或简化 */}
      {showQuickJumper && totalPages > (compact ? 5 : 10) && (
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'} ${compact ? 'ml-2' : 'ml-4'} flex-shrink-0`}>
          {!compact && <span className="text-sm text-muted-foreground">跳至</span>}
          <input
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            onKeyDown={handleQuickJump}
            className={`${compact ? 'w-10 h-8 text-xs' : 'w-12'} border rounded px-2 py-1 text-sm text-center`}
            placeholder={compact ? '页' : ''}
          />
          {!compact && <span className="text-sm text-muted-foreground">页</span>}
        </div>
      )}

      {/* 总页数 - 在紧凑模式下简化 */}
      {showTotalPages && (
        <div className={`text-sm text-muted-foreground ${compact ? 'ml-2 text-xs' : 'ml-4'} flex-shrink-0 whitespace-nowrap`}>
          {compact ? `${totalPages}页` : `共 ${totalPages} 页`}
        </div>
      )}
    </div>
  )
}