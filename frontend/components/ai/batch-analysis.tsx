"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Clock,
  Zap,
  List,
} from "lucide-react";
import {
  apiClient,
  type MediaFile,
  type MediaListItem,
  type BatchAnalysisJob,
} from "@/lib/api";
import {
  aiManagementService,
  connectionStatusManager,
  type OllamaModel,
} from "@/lib/ai-service";
import { toast } from "sonner";

interface BatchAnalysisProps {
  mediaFiles: MediaListItem[];
  onJobComplete?: (jobId: string) => void;
  onMediaUpdate?: () => void;
}

interface AnalysisTask {
  id: string;
  mediaFile: MediaListItem;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
}

export function BatchAnalysis({
  mediaFiles,
  onJobComplete,
  onMediaUpdate,
}: BatchAnalysisProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentJob, setCurrentJob] = useState<BatchAnalysisJob | null>(null);
  const [tasks, setTasks] = useState<AnalysisTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // 获取可用模型
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const result = await aiManagementService.getAvailableModels();
        if (result.models) {
          setModels(result.models);
          // 默认选择第一个可用的视觉模型
          const visionModel = result.models.find(
            (m: OllamaModel) => m.is_vision_capable
          );
          if (visionModel) {
            setSelectedModel(visionModel.name);
          }
        }
      } catch (err) {
        console.error("获取模型失败:", err);
        setError("无法获取可用模型");
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  // 初始化任务列表
  useEffect(() => {
    const imageFiles = mediaFiles.filter((file) => file.file_type === "image");
    const initialTasks: AnalysisTask[] = imageFiles.map((file) => ({
      id: `task-${file.id}`,
      mediaFile: file,
      status: "pending",
    }));
    setTasks(initialTasks);
    setSelectedFiles(imageFiles.map((file) => file.id));
  }, [mediaFiles]);

  // 开始批量分析
  const startBatchAnalysis = async () => {
    if (!selectedModel) {
      toast.error("请选择一个AI模型");
      return;
    }

    const filesToAnalyze = tasks.filter(
      (task) =>
        selectedFiles.includes(task.mediaFile.id) && task.status === "pending"
    );

    if (filesToAnalyze.length === 0) {
      toast.error("请选择要分析的文件");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const mediaIds = filesToAnalyze.map((task) => task.mediaFile.id);
      const result = await aiManagementService.batchAnalyze(
        mediaIds,
        selectedModel
      );

      if (result?.job_id) {
        setCurrentJob({
          job_id: result.job_id,
          status: "pending",
          total_files: filesToAnalyze.length,
          processed_files: 0,
          failed_files: 0,
          progress_percentage: 0,
          created_at: new Date().toISOString(),
        });

        // 开始轮询任务状态
        pollJobStatus(result.job_id);

        toast.success("批量分析任务已开始");
      }
    } catch (err: any) {
      console.error("启动批量分析失败:", err);
      setError(err.message || "启动批量分析失败");
      setIsRunning(false);
    }
  };

  // 轮询任务状态
  const pollJobStatus = async (jobId: string) => {
    try {
      const job = await aiManagementService.getBatchAnalysisStatus(jobId);

      setCurrentJob(job);
      setProgress(job.progress_percentage || 0);

      // 更新任务状态
      if (job.status === "completed" || job.status === "failed") {
        setIsRunning(false);
        onJobComplete?.(jobId);
        onMediaUpdate?.();

        if (job.status === "completed") {
          toast.success("批量分析完成！");
        } else {
          toast.error("批量分析失败");
        }
      } else {
        // 继续轮询
        setTimeout(() => pollJobStatus(jobId), 2000);
      }
    } catch (err) {
      console.error("获取任务状态失败:", err);
      setTimeout(() => pollJobStatus(jobId), 5000); // 出错时延长轮询间隔
    }
  };

  // 处理文件选择变化
  const handleFileSelection = (fileId: number, checked: boolean) => {
    if (checked) {
      setSelectedFiles((prev) => [...prev, fileId]);
    } else {
      setSelectedFiles((prev) => prev.filter((id) => id !== fileId));
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(tasks.map((task) => task.mediaFile.id));
    } else {
      setSelectedFiles([]);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            批量分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const imageFiles = tasks.filter(
    (task) => task.mediaFile.file_type === "image"
  );
  const selectedImageFiles = selectedFiles.filter((id) =>
    imageFiles.some((task) => task.mediaFile.id === id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          批量图片分析
        </CardTitle>
        <CardDescription>
          选择多张图片进行批量AI分析，支持进度监控和错误处理
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择AI模型</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isRunning}
          >
            <option value="">请选择模型</option>
            {models
              .filter((m) => m.is_vision_capable)
              .map((model) => (
                <option key={model.id} value={model.name}>
                  {model.display_name} ({model.model_size})
                </option>
              ))}
          </select>
        </div>

        {/* 文件选择 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">选择要分析的图片</label>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={
                  selectedImageFiles.length === imageFiles.length &&
                  imageFiles.length > 0
                }
                onCheckedChange={handleSelectAll}
                disabled={isRunning}
              />
              <span className="text-sm">全选</span>
            </div>
          </div>

          <div className="border rounded-md p-3 max-h-60 overflow-y-auto space-y-2">
            {imageFiles.map((task) => (
              <div key={task.id} className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedFiles.includes(task.mediaFile.id)}
                  onCheckedChange={(checked) =>
                    handleFileSelection(task.mediaFile.id, checked as boolean)
                  }
                  disabled={isRunning}
                />
                <span className="text-sm flex-1 truncate">
                  {task.mediaFile.title ||
                    task.mediaFile.file_url.split("/").pop()}
                </span>
                <Badge variant="outline" className="text-xs">
                  {(task.mediaFile.file_size / 1024 / 1024).toFixed(1)}MB
                </Badge>
              </div>
            ))}
            {imageFiles.length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                没有可分析的图片文件
              </p>
            )}
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={startBatchAnalysis}
            disabled={
              isRunning || !selectedModel || selectedImageFiles.length === 0
            }
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                开始分析 ({selectedImageFiles.length} 张图片)
              </>
            )}
          </Button>
        </div>

        {/* 错误信息 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 任务进度 */}
        {currentJob && (
          <div className="space-y-4">
            <Separator />
            <h3 className="text-lg font-semibold">分析进度</h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    状态
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={
                      currentJob.status === "completed"
                        ? "default"
                        : currentJob.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {currentJob.status === "pending"
                      ? "等待中"
                      : currentJob.status === "running"
                      ? "进行中"
                      : currentJob.status === "completed"
                      ? "已完成"
                      : "失败"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">总文件数</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{currentJob.total_files}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">已处理</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {currentJob.processed_files}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">失败</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {currentJob.failed_files}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 进度条 */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>分析进度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {currentJob.error_message && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{currentJob.error_message}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
