import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Server, Eye } from "lucide-react";
import { OllamaModel } from "../types/ai";

interface ModelCardProps {
  model: OllamaModel;
  index?: number;
}

export function ModelCard({ model, index = 0 }: ModelCardProps) {
  return (
    <Card
      key={`model-${model.id || index}-${model.name || 'unnamed'}-${index}`}
      className="relative"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-tight">
            {model.display_name}
          </CardTitle>
          <div className="flex items-center gap-1">
            {model.is_default && (
              <Badge variant="default" className="text-xs">
                默认
              </Badge>
            )}
            {model.is_active ? (
              <Badge variant="secondary" className="text-xs">
                活跃
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                非活跃
              </Badge>
            )}
            {model.is_vision_capable && (
              <Badge
                variant="outline"
                className="text-xs flex items-center gap-1"
              >
                <Eye className="h-3 w-3" />
                视觉
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div>
          <p className="text-xs font-mono bg-muted p-1 rounded truncate">
            {model.name}
          </p>
        </div>

        {model.description && (
          <div>
            <p className="text-xs line-clamp-2">{model.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 text-xs">
          {model.model_size && (
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span>{model.model_size}</span>
            </div>
          )}
          <div className="flex items-center gap-1" title={model.endpoint_url}>
            <Server className="h-3 w-3 text-muted-foreground" />
            <span className="truncate">
              {model.endpoint_name || "未知端点"}
            </span>
          </div>
        </div>

        {model.is_vision_capable && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 p-1 rounded">
            <Eye className="h-3 w-3" />
            <span>支持图片分析</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}