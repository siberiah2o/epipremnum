# 多供应商 AI 模型集成说明

本项目已成功集成了多供应商 AI 模型支持，现在可以同时支持 Ollama、智谱 AI、OpenAI 等多种模型服务。

## 后端改动

### 1. 数据模型更新

`OllamaEndpoint` 模型新增字段：
- `provider`: 供应商类型（ollama, zhipu, openai, azure, anthropic, custom）
- `api_key`: API Key（用于云服务认证）
- `auth_type`: 认证类型（none, api_key, bearer_token）

### 2. 新增文件

- **智谱 AI 客户端**: `backend/ollama/clients/zhipu_client.py`
  - 实现了完整的智谱 AI API 调用
  - 支持文本生成和图片分析
  - 支持 GLM-4V、GLM-4 等模型

- **客户端工厂**: `backend/ollama/clients/client_factory.py`
  - 统一管理不同供应商的客户端
  - 提供连接测试和模型获取功能

### 3. API 接口

所有现有的 API 接口都已更新以支持多供应商：

- `POST /api/ollama/endpoints/` - 创建端点（可指定供应商和 API Key）
- `POST /api/ollama/endpoints/{id}/test_connection` - 测试连接（支持不同供应商）
- `POST /api/ollama/endpoints/{id}/pull_models` - 同步模型（智谱使用预定义模型列表）

## 前端改动

### 1. 类型定义更新

`frontend/components/new_ai/types/ai.ts`：
- 添加了 `AIProvider` 类型定义
- 添加了供应商配置常量 `AI_PROVIDERS`
- 更新了 `OllamaEndpoint` 和 `CreateEndpointRequest` 接口

### 2. UI 组件更新

- **端点对话框** (`endpoint-dialog.tsx`)
  - 添加了供应商选择下拉框
  - 根据供应商类型动态显示 API Key 输入框
  - 添加了供应商信息提示

- **端点卡片** (`endpoint-card.tsx`)
  - 显示供应商类型标签
  - 显示 API Key 配置状态
  - 显示认证类型

## 使用指南

### 1. 创建智谱 AI 端点

**后端测试脚本**：
```bash
cd backend
python test_zhipu_integration.py
```

**前端界面操作**：
1. 进入 AI 管理 -> 端点管理
2. 点击"创建新端点"
3. 选择供应商类型为"智谱AI"
4. 输入名称、URL 和 API Key
5. 点击"创建"

### 2. 支持的供应商

| 供应商 | 是否需要 API Key | 默认 URL | 支持的模型 |
|--------|------------------|----------|------------|
| Ollama | 否 | http://localhost:11434 | 本地部署模型 |
| 智谱AI | 是 | https://open.bigmodel.cn/api/paas/v4 | GLM-4V, GLM-4 等 |
| OpenAI | 是 | https://api.openai.com/v1 | GPT-4, GPT-3.5 等 |
| Azure | 是 | Azure 端点 | Azure OpenAI |
| Anthropic | 是 | https://api.anthropic.com | Claude 系列 |
| 自定义 | 可选 | 自定义 | 自定义 |

### 3. 安全说明

- API Key 在数据库中已加密存储
- 前端响应中不会返回实际的 API Key
- 只会返回 `has_api_key` 布尔值表示是否已配置

## 扩展新供应商

### 1. 后端扩展

1. 在 `OllamaEndpoint.PROVIDER_CHOICES` 中添加新供应商
2. 创建对应的客户端类（参考 `zhipu_client.py`）
3. 在 `ClientFactory` 中添加客户端创建逻辑

### 2. 前端扩展

1. 在 `AI_PROVIDERS` 常量中添加供应商配置
2. 更新供应商选择下拉框（会自动显示新选项）

## 注意事项

1. **模型同步**：智谱 AI 使用预定义的模型列表，不支持动态拉取
2. **连接测试**：不同供应商的连接测试逻辑不同，已由 `ClientFactory` 统一处理
3. **向后兼容**：现有的 Ollama 端点无需修改，继续正常工作

## 故障排查

### 常见问题

1. **API Key 错误**
   - 检查 API Key 是否正确
   - 确认 API Key 有相应的访问权限

2. **连接超时**
   - 检查网络连接
   - 确认 URL 地址正确

3. **模型列表为空**
   - 智谱 AI 使用预定义模型，这是正常的
   - Ollama 需要先在本地拉取模型

### 日志查看

```bash
# 查看后端日志
tail -f logs/django.log

# 查看具体错误
grep "智谱" logs/django.log
```