import type { OllamaModel } from '@/lib/api';

/**
 * 模型排序函数：Qwen3排在第一，然后按参数大小从大到小排序
 */
export function sortModels(models: OllamaModel[]): OllamaModel[] {
  return models.sort((a, b) => {
    // 检查是否为Qwen3模型
    const aIsQwen3 = a.name.toLowerCase().includes('qwen3');
    const bIsQwen3 = b.name.toLowerCase().includes('qwen3');

    // 如果一个是Qwen3，另一个不是，Qwen3排在前面
    if (aIsQwen3 && !bIsQwen3) return -1;
    if (!aIsQwen3 && bIsQwen3) return 1;

    // 如果都是Qwen3或都不是Qwen3，按参数大小排序
    // 提取参数大小的数字部分（如从 "2.1B" 提取 "2.1"，从 "7B" 提取 "7"）
    const extractParamSize = (modelSize: string | undefined) => {
      if (!modelSize) return 0;
      const match = modelSize.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const aSize = extractParamSize(a.model_size);
    const bSize = extractParamSize(b.model_size);

    // 按参数大小从大到小排序
    return bSize - aSize;
  });
}

/**
 * 获取排序后的视觉模型列表
 */
export function getSortedVisionModels(models: OllamaModel[]): OllamaModel[] {
  const visionModels = models.filter(
    (model) => model.is_vision_capable && model.is_active
  );
  return sortModels(visionModels);
}

/**
 * 获取最佳推荐模型（Qwen3优先，然后是最大的模型）
 */
export function getRecommendedModel(models: OllamaModel[]): OllamaModel | null {
  const sortedVisionModels = getSortedVisionModels(models);

  // 优先选择默认模型
  const defaultModel = sortedVisionModels.find(model => model.is_default);
  if (defaultModel) {
    return defaultModel;
  }

  // 如果没有默认模型，返回第一个（排序后的最佳选择）
  return sortedVisionModels.length > 0 ? sortedVisionModels[0] : null;
}