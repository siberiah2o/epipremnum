"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image } from "lucide-react";
import { NewAnalysisPanel } from "./new-analysis-panel";
import type { MediaFile } from "../types/analysis";

interface AnalysisResultsProps {
  selectedFile: MediaFile | null;
  onMediaUpdate: () => void;
}

export function AnalysisResults({
  selectedFile,
  onMediaUpdate,
}: AnalysisResultsProps) {
  if (!selectedFile) {
    return (
      <Card className="h-full min-h-[400px] flex items-center justify-center">
        <CardContent className="text-center p-8">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Image className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">选择一张图片开始分析</h3>
          <p className="text-muted-foreground max-w-sm">
            从左侧素材列表中选择一张图片，即可开始AI分析
            <br />
            <small className="text-muted-foreground">
              提示：使用方向键自动选择并切换图片
            </small>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <NewAnalysisPanel
        selectedFile={selectedFile}
        onMediaUpdate={onMediaUpdate}
      />
    </div>
  );
}
