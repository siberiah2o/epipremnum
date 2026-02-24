/**
 * 公共组件统一导出
 */

// 空状态
export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';

// 骨架屏
export {
  Skeleton,
  CardSkeleton,
  MediaGridSkeleton,
  ListItemSkeleton,
  ListSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  DetailSkeleton,
} from './loading-skeleton';
export type { SkeletonProps } from './loading-skeleton';

// 分页
export { Pagination, SimplePagination } from './pagination';
export type { PaginationProps } from './pagination';

// 错误边界
export { ErrorBoundary, PageErrorBoundary, ComponentErrorBoundary } from './error-boundary';
export type { ErrorBoundaryProps } from './error-boundary';
