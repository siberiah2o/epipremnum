# New AI 管理组件

这个目录包含了重构后的 AI 管理组件，将原本的单体组件拆分为更小、更专注的模块。

## 架构概览

### 📁 目录结构

```
new_ai/
├── index.ts                    # 导出入口文件
├── README.md                   # 说明文档
├── new-ai-management.tsx       # 主要容器组件
├── types/                      # 类型定义
│   └── ai.ts                  # AI 相关类型
├── hooks/                      # 自定义 Hooks
│   ├── use-api.ts             # 通用 API 请求 Hook
│   ├── use-ai-models.ts       # 模型管理 Hook
│   ├── use-ai-endpoints.ts    # 端点管理 Hook
│   └── use-ai-connection.ts   # 连接状态管理 Hook
└── components/                 # UI 组件
    ├── model-management.tsx   # 模型管理组件
    ├── endpoint-management.tsx # 端点管理组件
    ├── model-card.tsx         # 模型卡片组件
    ├── endpoint-card.tsx      # 端点卡片组件
    ├── connection-status.tsx  # 连接状态组件
    ├── model-stats.tsx        # 模型统计组件
    ├── model-actions.tsx      # 模型操作组件
    ├── endpoint-dialog.tsx    # 端点对话框组件
    └── empty-state.tsx        # 空状态组件
```

## 🎯 重构优势

### 1. **关注点分离 (Separation of Concerns)**
- **数据层**: 通过自定义 Hooks 管理状态和 API 调用
- **视图层**: 组件专注于 UI 渲染和用户交互
- **类型层**: 集中管理 TypeScript 类型定义

### 2. **可复用性 (Reusability)**
- 各个子组件可以独立使用和测试
- Hooks 可以在其他组件中复用
- 类型定义便于跨组件共享

### 3. **可维护性 (Maintainability)**
- 每个文件职责单一，易于理解和修改
- 减少了组件的复杂度和代码行数
- 更好的代码组织结构

### 4. **可测试性 (Testability)**
- Hooks 和组件可以单独进行单元测试
- 清晰的数据流便于集成测试

## 📦 组件说明

### 主要组件

#### `NewAIManagement`
主容器组件，整合所有功能模块。

```tsx
import { NewAIManagement } from "@/components/new_ai";

function App() {
  return <NewAIManagement />;
}
```

### 子组件

#### `ModelManagement`
模型管理功能，包含模型列表、统计信息和操作按钮。

#### `EndpointManagement`
端点管理功能，包含端点列表、创建/编辑对话框。

#### `ModelCard`
单个模型卡片显示组件。

#### `EndpointCard`
单个端点卡片显示组件。

#### `ConnectionStatus`
连接状态显示和测试组件。

#### `ModelStats`
模型统计信息展示组件。

#### `ModelActions`
模型操作按钮组件。

#### `EndpointDialog`
端点创建/编辑对话框组件。

#### `EmptyState`
空状态提示组件。

## 🪝 Hooks 说明

### `useApi`
通用 API 请求 Hook，处理认证、错误处理和加载状态。

```tsx
const { loading, error, apiRequest } = useApi();
```

### `useAIModels`
模型管理 Hook，提供模型数据的增删改查功能。

```tsx
const {
  models,
  loading,
  isRefreshing,
  fetchModels,
  refreshModels,
  getModelStats,
} = useAIModels();
```

### `useAIEndpoints`
端点管理 Hook，提供端点数据的增删改查功能。

```tsx
const {
  endpoints,
  loading,
  fetchEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  testEndpoint,
  getDefaultEndpoint,
} = useAIEndpoints();
```

### `useAIConnection`
连接状态管理 Hook，处理连接测试和状态更新。

```tsx
const {
  connectionStatus,
  isTesting,
  testConnection,
  resetConnectionStatus,
} = useAIConnection();
```

## 🔧 使用示例

### 基本使用

```tsx
import { NewAIManagement } from "@/components/new_ai";

export default function AIPage() {
  return (
    <div className="container">
      <NewAIManagement />
    </div>
  );
}
```

### 自定义组件

```tsx
import {
  ModelCard,
  useAIModels,
  ModelStats,
  ModelActions,
} from "@/components/new_ai";

export function CustomModelView() {
  const { models, refreshModels } = useAIModels();

  return (
    <div>
      <ModelStats stats={{ total: models.length, active: 5, vision: 2 }} />
      <ModelActions isRefreshing={false} onRefreshModels={refreshModels} />
      {models.map((model, index) => (
        <ModelCard key={index} model={model} />
      ))}
    </div>
  );
}
```

## 🎨 样式和主题

所有组件都使用了 shadcn/ui 的设计系统，确保一致的视觉体验：

- 响应式设计
- 暗色模式支持
- 可定制的主题
- 符合可访问性标准

## 🚀 性能优化

- 使用 `useCallback` 优化函数引用
- 合理的状态管理减少不必要的重渲染
- 组件懒加载（可根据需要实现）
- 错误边界处理

## 🔄 数据流

```
API → useApi → useAI*Hooks → Components → UI
```

1. **API 层**: 通过 `useApi` 统一处理 HTTP 请求
2. **数据层**: 通过专门的 Hooks 管理不同类型的数据
3. **组件层**: 组件订阅 Hooks 提供的数据和方法
4. **视图层**: 渲染 UI 并处理用户交互

## 🧪 测试

每个模块都可以独立测试：

```bash
# 单元测试
npm test new_ai

# 覆盖率
npm run test:coverage new_ai
```

## 📝 开发指南

1. 添加新功能时，优先考虑复用现有组件
2. 新增类型定义到 `types/ai.ts`
3. 新增数据逻辑使用对应的 Hook
4. 新增 UI 组件保持单一职责
5. 更新 `index.ts` 导出新的内容

## 🐛 故障排除

### 常见问题

1. **组件未渲染**: 检查导入路径和组件导出
2. **数据未加载**: 确认 API 配置和网络连接
3. **状态不更新**: 检查 Hook 的使用方式和依赖项

### 调试技巧

- 使用 React DevTools 查看组件状态
- 检查网络面板确认 API 调用
- 查看控制台错误信息

---

这个重构后的架构提供了更好的代码组织、可维护性和可扩展性，同时保持了原有功能的完整性。