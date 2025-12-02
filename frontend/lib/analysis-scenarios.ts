// AI分析场景配置
export interface AnalysisScenario {
  id: string;
  name: string;
  categories: string[];
  tags: string[];
  description: string;
}

// 预定义的分析场景
export const ANALYSIS_SCENARIOS: AnalysisScenario[] = [
  {
    id: 'people',
    name: '人物类',
    description: '包含人物的图片场景',
    categories: ['人像', '合影', '会议', '活动', '庆典', '家庭', '朋友聚会'],
    tags: ['单人', '多人', '正式', '休闲', '室内', '室外', '微笑', '严肃', '商务', '生活']
  },
  {
    id: 'landscape',
    name: '风景类',
    description: '自然风光和城市景观',
    categories: ['自然风光', '城市景观', '建筑', '室内', '夜景', '日出日落'],
    tags: ['山脉', '海洋', '森林', '城市', '建筑', '天空', '云朵', '天气', '季节', '景色']
  },
  {
    id: 'objects',
    name: '物品类',
    description: '各种物品和产品',
    categories: ['产品', '设备', '工具', '食物', '家居', '办公', '服装'],
    tags: ['细节', '特写', '质感', '颜色', '形状', '功能', '品牌', '新材料', '手工', '工业']
  },
  {
    id: 'art',
    name: '艺术类',
    description: '艺术创作和设计作品',
    categories: ['绘画', '设计', '摄影作品', '雕塑', '手工艺', '数字艺术'],
    tags: ['创作', '创意', '色彩', '构图', '风格', '技巧', '原创', '抽象', '写实', '装饰']
  },
  {
    id: 'documents',
    name: '文档类',
    description: '各种文档和资料',
    categories: ['合同', '证件', '发票', '资料', '书籍', '笔记', '图表'],
    tags: ['正式', '重要', '签名', '日期', '文字', '表格', '图片', '扫描', '原件', '复印件']
  }
];

// 获取所有可用的分类
export const getAllCategories = (): string[] => {
  const categories = new Set<string>();
  ANALYSIS_SCENARIOS.forEach(scenario => {
    scenario.categories.forEach(category => categories.add(category));
  });
  return Array.from(categories);
};

// 获取所有可用的标签
export const getAllTags = (): string[] => {
  const tags = new Set<string>();
  ANALYSIS_SCENARIOS.forEach(scenario => {
    scenario.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags);
};

// 根据场景获取分类
export const getCategoriesByScenario = (scenarioId: string): string[] => {
  const scenario = ANALYSIS_SCENARIOS.find(s => s.id === scenarioId);
  return scenario ? scenario.categories : [];
};

// 根据场景获取标签
export const getTagsByScenario = (scenarioId: string): string[] => {
  const scenario = ANALYSIS_SCENARIOS.find(s => s.id === scenarioId);
  return scenario ? scenario.tags : [];
};

// 默认分析配置
export const DEFAULT_ANALYSIS_CONFIG = {
  max_categories: 3,
  max_tags: 5,
  confidence_threshold: 0.7,
  limited_scenarios: true,
  enable_scenario_filtering: true
};