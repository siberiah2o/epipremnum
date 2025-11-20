import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { ModelStatistics } from "../types/ai";

interface ModelStatsProps {
  stats: ModelStatistics;
}

export function ModelStats({ stats }: ModelStatsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-3 w-3" />
          模型统计
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>总模型数:</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>活跃模型:</span>
            <span className="font-medium text-green-600">
              {stats.active}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>视觉模型:</span>
            <span className="font-medium text-blue-600">
              {stats.vision}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}