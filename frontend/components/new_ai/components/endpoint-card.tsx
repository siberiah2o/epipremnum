import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { OllamaEndpoint } from "../types/ai";

interface EndpointCardProps {
  endpoint: OllamaEndpoint;
  index?: number;
  onEdit: (endpoint: OllamaEndpoint) => void;
  onDelete: (endpoint: OllamaEndpoint) => void;
  onTest: (endpointId: number) => void;
}

export function EndpointCard({
  endpoint,
  index = 0,
  onEdit,
  onDelete,
  onTest,
}: EndpointCardProps) {
  return (
    <Card
      key={`endpoint-${endpoint.id || index}-${endpoint.name || 'unnamed'}-${index}`}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-sm">{endpoint.name}</h3>
              {endpoint.is_default && (
                <Badge variant="default" className="text-xs">默认</Badge>
              )}
              {endpoint.is_active ? (
                <Badge variant="secondary" className="text-xs">活跃</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">非活跃</Badge>
              )}
              {endpoint.is_default && (
                <Badge variant="destructive" className="text-xs">
                  不可删除
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {endpoint.url}
            </p>
            {endpoint.description && (
              <p className="text-xs line-clamp-1">{endpoint.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>超时: {endpoint.timeout || 300}s</span>
              <span>创建者: {endpoint.created_by || "未知"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(endpoint.id)}
              disabled={!endpoint.id}
              className="h-7 px-2 text-xs"
            >
              测试
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(endpoint)}
              title="编辑端点"
              className="h-7 w-7 p-0"
            >
              <Edit className="h-3 w-3" />
            </Button>
            {!endpoint.is_default && endpoint.id && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(endpoint)}
                title="删除端点"
                className="h-7 w-7 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}