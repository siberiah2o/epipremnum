import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Brain } from "lucide-react";
import { ModelCard } from "./model-card";
import { ConnectionStatus } from "./connection-status";
import { ModelStats } from "./model-stats";
import { ModelActions } from "./model-actions";
import { EmptyState } from "./empty-state";
import { useAIModels } from "../hooks/use-ai-models";
import { useAIEndpoints } from "../hooks/use-ai-endpoints";
import { useAIConnection } from "../hooks/use-ai-connection";

export function ModelManagement() {
  const {
    models,
    loading,
    isRefreshing,
    error,
    refreshModels,
    getModelStats,
  } = useAIModels();

  const { getDefaultEndpoint } = useAIEndpoints();
  const { connectionStatus, isTesting, testConnection } = useAIConnection();

  const stats = getModelStats();
  const defaultEndpoint = getDefaultEndpoint();

  // 测试连接
  const handleTestConnection = async () => {
    if (defaultEndpoint) {
      await testConnection(defaultEndpoint.id);
    }
  };

  // 刷新模型
  const handleRefreshModels = async () => {
    if (defaultEndpoint) {
      await refreshModels(defaultEndpoint.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* 连接状态和操作 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-4 w-4" />
            AI 模型管理
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 操作按钮 */}
            <ModelActions
              isRefreshing={isRefreshing}
              onRefreshModels={handleRefreshModels}
              isTesting={isTesting}
              onTestConnection={handleTestConnection}
            />

            {/* 连接状态 */}
            <ConnectionStatus
              connectionStatus={connectionStatus}
              isTesting={isTesting}
            />

            {/* 模型统计 */}
            <ModelStats stats={stats} />
          </div>
        </CardContent>
      </Card>

      {/* 错误信息 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 模型列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">可用模型</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">加载中...</span>
            </div>
          ) : models.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {models.map((model, index) => (
                <ModelCard key={index} model={model} index={index} />
              ))}
            </div>
          ) : (
            <EmptyState
              type="models"
              onAction={handleRefreshModels}
              isActionLoading={isRefreshing}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}