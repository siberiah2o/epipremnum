import { Button } from "@/components/ui/button";
import { Brain, Server, Plus, RefreshCw, Loader2 } from "lucide-react";

interface EmptyStateProps {
  type: "models" | "endpoints";
  onAction?: () => void;
  isActionLoading?: boolean;
}

export function EmptyState({ type, onAction, isActionLoading = false }: EmptyStateProps) {
  if (type === "models") {
    return (
      <div className="text-center py-6">
        <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-semibold mb-2">暂无可用模型</h3>
        <p className="text-sm text-muted-foreground mb-4">
          点击"刷新模型"按钮从 Ollama 服务获取最新模型列表
        </p>
        {onAction && (
          <Button size="sm" onClick={onAction} disabled={isActionLoading}>
            {isActionLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                刷新中...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                刷新模型
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">暂无配置的端点</h3>
      <p className="text-muted-foreground mb-4">
        添加 Ollama 服务端点来开始使用 AI 分析功能
      </p>
      {onAction && (
        <Button onClick={onAction}>
          <Plus className="h-4 w-4 mr-2" />
          添加第一个端点
        </Button>
      )}
    </div>
  );
}