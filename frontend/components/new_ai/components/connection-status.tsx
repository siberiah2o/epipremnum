import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { ConnectionState } from "../types/ai";

interface ConnectionStatusProps {
  connectionStatus: ConnectionState;
  isTesting: boolean;
}

export function ConnectionStatus({
  connectionStatus,
  isTesting,
}: ConnectionStatusProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-3 w-3" />
          服务状态
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2">
          {connectionStatus === "checking" && (
            <RefreshCw className="h-4 w-4 animate-spin" />
          )}
          {connectionStatus === "connected" && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {connectionStatus === "failed" && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm">
            {connectionStatus === "idle"
              ? "未测试"
              : connectionStatus === "checking"
              ? "检测中..."
              : connectionStatus === "connected"
              ? "已连接"
              : "连接失败"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}