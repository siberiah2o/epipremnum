"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
} from "lucide-react";
import { useAIAnalysisPolling } from "../hooks/use-ai-analysis-polling";

export function GlobalAnalysisStatus() {
  const [showStatus, setShowStatus] = useState(false);
  const { tasks, isPolling } = useAIAnalysisPolling();

  // 监听是否有任务在运行
  useEffect(() => {
    const hasActiveTasks = tasks.some(
      (task) => task.status === 'processing' || task.status === 'pending'
    );

    setShowStatus(hasActiveTasks || isPolling);
  }, [tasks, isPolling]);

  if (!showStatus || tasks.length === 0) {
    return null;
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const processingCount = tasks.filter((t) => t.status === 'processing').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const totalCount = tasks.length;

  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 min-w-80">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">AI分析状态</span>
        {isPolling && (
          <Badge variant="secondary" className="animate-pulse text-xs">
            轮询中
          </Badge>
        )}
      </div>

      {/* 进度条 */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>总进度</span>
          <span>{completedCount}/{totalCount} ({Math.round(progress)}%)</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* 状态统计 */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1 text-blue-600">
          <Activity className="h-3 w-3" />
          <span>处理中: {processingCount}</span>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-3 w-3" />
          <span>已完成: {completedCount}</span>
        </div>
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>失败: {failedCount}</span>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="mt-3 text-xs text-muted-foreground border-t pt-2">
        {isPolling ? (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            正在后台轮询分析状态...
          </div>
        ) : processingCount > 0 ? (
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {processingCount} 个任务正在后台处理
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            所有任务已完成
          </div>
        )}
      </div>
    </div>
  );
}