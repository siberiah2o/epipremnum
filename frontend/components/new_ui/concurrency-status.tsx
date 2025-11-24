"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Users, Zap } from "lucide-react";
import { concurrentRequestManager } from "@/lib/ai-service";

export function ConcurrencyStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const count = concurrentRequestManager.getPendingCount();
      setPendingCount(count);
      setShowStatus(count > 0);
    };

    // 每秒更新一次状态
    const interval = setInterval(updateStatus, 1000);

    // 初始更新
    updateStatus();

    return () => clearInterval(interval);
  }, []);

  if (!showStatus) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert className="border-blue-200 bg-blue-50/95 backdrop-blur-sm">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              正在处理 {pendingCount} 个AI分析任务
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            进行中
          </Badge>
        </AlertDescription>
      </Alert>
    </div>
  );
}