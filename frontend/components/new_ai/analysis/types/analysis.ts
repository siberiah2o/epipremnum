// 扩展 MediaListItem 类型，添加AI相关字段
export type MediaFile = import("@/lib/api").MediaListItem & {
  ai_description?: string | null;
  ai_prompt?: string | null;
  ai_categories?: Array<{ id: number; name: string }> | null;
  ai_tags?: Array<{ id: number; name: string }> | null;
  ai_analyzed_at?: string | null;
};

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalFiles: number;
  pageSize: number;
}

export interface KeyboardNavigationState {
  focusedIndex: number | null;
  isKeyboardNavEnabled: boolean;
}

export interface AnalysisState {
  selectedModel: string;
  analyzing: boolean;
  analysisError: string | null;
}
