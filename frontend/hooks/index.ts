/**
 * Hooks 统一导出
 */

// 媒体相关
export { useMedia, useMediaDetail } from './use-media';
export type { UseMediaOptions, UseMediaReturn } from './use-media';

// 分类相关
export { useCategories } from './use-categories';
export type { UseCategoriesOptions, UseCategoriesReturn } from './use-categories';

// 项目相关
export { useProjects, useProjectDetail } from './use-projects';
export type { UseProjectsOptions, UseProjectsReturn, UseProjectDetailReturn } from './use-projects';

// 轮询
export { usePolling, useConditionalPolling } from './use-polling';
export type { UsePollingOptions, UsePollingReturn } from './use-polling';

// 移动端检测
export { useIsMobile } from './use-mobile';

// WebSocket 分析
export { useAnalysisWebSocket } from './use-analysis-websocket';

// SWR 数据缓存 Hooks
export {
  useSWRWithAuth,
  useMediaList,
  useCategories as useSWRCategories,
  useLLMModels,
  useLLMEndpoints,
  useAnalyses,
  useProjects as useSWRProjects,
  useProject,
  useProfile,
  prefetch,
  refreshAll,
  refreshByKey,
} from '@/lib/swr';

