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

// AI分析选项接口
export interface AIAnalysisOptions {
  generate_title?: boolean;
  generate_description?: boolean;
  generate_prompt?: boolean;
  generate_categories?: boolean;
  generate_tags?: boolean;
  max_categories?: number;
  max_tags?: number;
  limited_scenarios?: boolean; // 启用有限场景分析
  confidence_threshold?: number; // 置信度阈值
}

// 预定义分析场景
export interface AnalysisScenario {
  id: string;
  name: string;
  categories: string[];
  tags: string[];
  description: string;
}
