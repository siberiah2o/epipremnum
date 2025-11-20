import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Zap, Loader2, RefreshCw } from "lucide-react";

interface ModelActionsProps {
  isRefreshing: boolean;
  onRefreshModels: () => void;
  isTesting?: boolean;
  onTestConnection?: () => void;
}

export function ModelActions({
  isRefreshing,
  onRefreshModels,
  isTesting = false,
  onTestConnection
}: ModelActionsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          操作
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {onTestConnection && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTestConnection}
            disabled={isTesting}
            className="w-full flex items-center gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                测试连接
              </>
            )}
          </Button>
        )}
        <Button
          size="sm"
          onClick={onRefreshModels}
          disabled={isRefreshing}
          className="w-full flex items-center gap-2"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              刷新中...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              刷新模型
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}