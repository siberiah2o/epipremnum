import type { AIAnalysisOptions } from '@/components/new_ai/analysis/types/analysis';
import { ANALYSIS_SCENARIOS, getAllCategories, getAllTags } from './analysis-scenarios';

// AI分析结果接口
export interface AnalysisResult {
  title?: string;
  description?: string;
  categories?: Array<{ name: string; confidence?: number }>;
  tags?: Array<{ name: string; confidence?: number }>;
  prompt?: string;
}

// 过滤后的分析结果
export interface FilteredAnalysisResult extends AnalysisResult {
  filtered_categories: Array<{ name: string; confidence?: number; scenario?: string }>;
  filtered_tags: Array<{ name: string; confidence?: number; scenario?: string }>;
  filter_stats: {
    original_categories: number;
    filtered_categories: number;
    original_tags: number;
    filtered_tags: number;
  };
}

/**
 * 根据配置过滤AI分析结果
 * @param result 原始AI分析结果
 * @param options 分析选项配置
 * @returns 过滤后的分析结果
 */
export function filterAnalysisResult(
  result: AnalysisResult,
  options: AIAnalysisOptions
): FilteredAnalysisResult {
  const {
    max_categories = 3,
    max_tags = 5,
    limited_scenarios = true,
    confidence_threshold = 0.7
  } = options;

  const originalCategories = result.categories || [];
  const originalTags = result.tags || [];

  let filteredCategories = originalCategories;
  let filteredTags = originalTags;

  // 1. 根据置信度过滤
  if (confidence_threshold > 0) {
    filteredCategories = filteredCategories.filter(cat =>
      !cat.confidence || cat.confidence >= confidence_threshold
    );
    filteredTags = filteredTags.filter(tag =>
      !tag.confidence || tag.confidence >= confidence_threshold
    );
  }

  // 2. 如果启用有限场景，根据预定义场景过滤
  if (limited_scenarios) {
    const allowedCategories = getAllCategories();
    const allowedTags = getAllTags();

    filteredCategories = filteredCategories.filter(cat =>
      allowedCategories.includes(cat.name)
    );

    filteredTags = filteredTags.filter(tag =>
      allowedTags.includes(tag.name)
    );

    // 为分类和标签添加场景信息
    filteredCategories = filteredCategories.map(cat => {
      const scenario = ANALYSIS_SCENARIOS.find(s => s.categories.includes(cat.name));
      return {
        ...cat,
        scenario: scenario?.name
      };
    });

    filteredTags = filteredTags.map(tag => {
      const scenario = ANALYSIS_SCENARIOS.find(s => s.tags.includes(tag.name));
      return {
        ...tag,
        scenario: scenario?.name
      };
    });
  }

  // 3. 限制数量
  filteredCategories = filteredCategories
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, max_categories);

  filteredTags = filteredTags
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, max_tags);

  return {
    ...result,
    filtered_categories: filteredCategories,
    filtered_tags: filteredTags,
    filter_stats: {
      original_categories: originalCategories.length,
      filtered_categories: filteredCategories.length,
      original_tags: originalTags.length,
      filtered_tags: filteredTags.length
    }
  };
}

/**
 * 获取过滤统计信息
 */
export function getFilterStats(filteredResult: FilteredAnalysisResult) {
  const { filter_stats } = filteredResult;
  const categoryReduction = filter_stats.original_categories > 0
    ? ((filter_stats.original_categories - filter_stats.filtered_categories) / filter_stats.original_categories * 100).toFixed(1)
    : '0';
  const tagReduction = filter_stats.original_tags > 0
    ? ((filter_stats.original_tags - filter_stats.filtered_tags) / filter_stats.original_tags * 100).toFixed(1)
    : '0';

  return {
    ...filter_stats,
    category_reduction_percent: parseFloat(categoryReduction),
    tag_reduction_percent: parseFloat(tagReduction)
  };
}

/**
 * 应用有限场景分析到单个分类
 */
export function applyScenarioFilter(
  items: Array<{ name: string; confidence?: number }>,
  allowedItems: string[],
  maxCount: number
): Array<{ name: string; confidence?: number }> {
  return items
    .filter(item => allowedItems.includes(item.name))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, maxCount);
}

/**
 * 验证分析结果是否包含置信度信息
 */
export function hasConfidenceData(result: AnalysisResult): boolean {
  const hasCategoryConfidence = result.categories?.some(cat => cat.confidence !== undefined);
  const hasTagConfidence = result.tags?.some(tag => tag.confidence !== undefined);
  return hasCategoryConfidence || hasTagConfidence;
}

/**
 * 智能选择最适合的场景（基于内容）
 */
export function detectBestScenario(
  categories: Array<{ name: string; confidence?: number }>,
  tags: Array<{ name: string; confidence?: number }>
): string | null {
  const allItems = [...categories.map(c => c.name), ...tags.map(t => t.name)];

  let bestScenario = null;
  let bestScore = 0;

  for (const scenario of ANALYSIS_SCENARIOS) {
    const scenarioItems = [...scenario.categories, ...scenario.tags];
    const matchCount = allItems.filter(item => scenarioItems.includes(item)).length;
    const score = matchCount / Math.max(allItems.length, 1);

    if (score > bestScore) {
      bestScore = score;
      bestScenario = scenario.id;
    }
  }

  return bestScore > 0.3 ? bestScenario : null;
}