"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  RefreshCw,
  Clock,
  Zap,
  Activity,
} from "lucide-react";
import { useAIModels } from "../../hooks/use-ai-models";
import { useAsyncBatchAnalysis } from "../hooks/use-async-batch-analysis";
import { type MediaListItem } from "@/lib/api";
import { toast } from "sonner";

interface SimpleBatchAnalysisProps {
  mediaFiles: MediaListItem[];
  onJobComplete?: (successCount: number, failedCount: number) => void;
  onMediaUpdate?: () => void;
}

export function SimpleBatchAnalysis({
  mediaFiles,
  onJobComplete,
  onMediaUpdate,
}: SimpleBatchAnalysisProps) {
  const { models, loading: modelsLoading } = useAIModels();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  // 同步批量分析
  const { state: batchState, performBatchAnalysis, resetState } = useAsyncBatchAnalysis();

  // 移除并发控制，改为顺序处理
  // const [concurrencyLimit, setConcurrencyLimit] = useState(1); // 固定为1，顺序处理

  // 分析选项
  const [analysisOptions, setAnalysisOptions] = useState({
    generateTitle: true,
    generateDescription: true,
    generatePrompt: true, // 默认勾选提示词分析
    generateCategories: true,
    generateTags: true,
    maxCategories: 5,
    maxTags: 10,
  });

  // 过滤出可用的视觉模型
  const visionModels = models.filter(
    (model) => model.is_vision_capable && model.is_active
  );

  // 自动选择第一个视觉模型
  useEffect(() => {
    if (!modelsLoading && !selectedModel && visionModels.length > 0) {
      setSelectedModel(visionModels[0].name);
    }
  }, [visionModels, selectedModel, modelsLoading]);

  const imageFiles = mediaFiles.filter((file) => file.file_type === "image");

  // 处理文件选择
  const handleFileToggle = (fileId: number, checked: boolean) => {
    if (checked) {
      setSelectedFiles((prev) => [...prev, fileId]);
    } else {
      setSelectedFiles((prev) => prev.filter((id) => id !== fileId));
    }
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(imageFiles.map((file) => file.id));
    } else {
      setSelectedFiles([]);
    }
  };

  // 开始批量分析
  const startBatchAnalysis = async () => {
    if (!selectedModel) {
      toast.error("请选择一个AI模型");
      return;
    }

    const filesToAnalyze = imageFiles.filter((file) =>
      selectedFiles.includes(file.id)
    );

    if (filesToAnalyze.length === 0) {
      toast.error("请选择要分析的图片文件");
      return;
    }

    await performBatchAnalysis(
      filesToAnalyze,
      selectedModel,
      {
        generate_title: analysisOptions.generateTitle,
        generate_description: analysisOptions.generateDescription,
        generate_prompt: analysisOptions.generatePrompt,
        generate_categories: analysisOptions.generateCategories,
        generate_tags: analysisOptions.generateTags,
        max_categories: analysisOptions.maxCategories,
        max_tags: analysisOptions.maxTags,
      },
      1, // concurrencyLimit - 串行处理，避免数据库锁和资源竞争
      (successCount: number, failedCount: number) => {
        // 任务完成后的处理
        console.log(`🔍 [BATCH] 批量分析完成：成功 ${successCount}，失败 ${failedCount}`);

        // 触发全局媒体更新事件
        window.dispatchEvent(new CustomEvent("media-updated"));
        localStorage.setItem("media-analysis-completed", Date.now().toString());

        setTimeout(() => {
          localStorage.removeItem("media-analysis-completed");
        }, 1000);

        // 显示成功消息
        toast.success(`批量分析完成！成功: ${successCount}，失败: ${failedCount}`);

        // 重置分析状态
        resetAnalysis();

        if (onJobComplete) {
          onJobComplete(successCount, failedCount);
        }
      },
      (mediaId: number, result: any) => {
        // 单个任务完成回调
        console.log(`媒体 ${mediaId} 分析完成`, result);
      }
    );

    // 分析完成后更新媒体库
    if (onMediaUpdate) {
      setTimeout(() => {
        onMediaUpdate();
      }, 1000);
    }
  };

  // 重置状态
  const resetAnalysis = () => {
    resetState();
    setSelectedFiles([]);
  };

  if (modelsLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>加载AI模型中...</p>
        </CardContent>
      </Card>
    );
  }

  if (imageFiles.length === 0) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">没有找到图片文件</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          顺序批量图片分析
          {batchState.isRunning && (
            <Badge variant="secondary" className="animate-pulse">
              处理中
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          顺序处理模式：按顺序逐张分析，确保每张图片完全处理完成后再开始下一张
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择AI模型</label>
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={batchState.isRunning}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择AI模型" />
            </SelectTrigger>
            <SelectContent>
              {visionModels.length === 0 ? (
                <SelectItem value="none" disabled>
                  没有可用的视觉模型
                </SelectItem>
              ) : (
                visionModels.map((model, index) => (
                  <SelectItem key={`model-${model.id || model.name}-${model.endpoint_id || 'default'}-${index}`} value={model.name}>
                    {model.name}
                    {model.is_default && <Badge className="ml-2">默认</Badge>}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 顺序处理说明 */}
        <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md border border-blue-200">
          <p className="font-medium text-blue-700 mb-1">🔄 顺序处理模式</p>
          <p>• 每张图片分析完成后才开始下一张</p>
          <p>• 确保资源占用稳定，避免超时错误</p>
          <p>• 实时显示当前处理进度</p>
        </div>

        {/* 分析选项 */}
        <div className="space-y-3">
          <label className="text-sm font-medium">分析选项</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateTitle"
                checked={analysisOptions.generateTitle}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    generateTitle: e.target.checked
                  }))
                }
                disabled={batchState.isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="generateTitle" className="text-sm">
                生成标题
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateDescription"
                checked={analysisOptions.generateDescription}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    generateDescription: e.target.checked
                  }))
                }
                disabled={batchState.isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="generateDescription" className="text-sm">
                生成描述
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generatePrompt"
                checked={analysisOptions.generatePrompt}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    generatePrompt: e.target.checked
                  }))
                }
                disabled={batchState.isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="generatePrompt" className="text-sm">
                生成提示词
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateCategories"
                checked={analysisOptions.generateCategories}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    generateCategories: e.target.checked
                  }))
                }
                disabled={batchState.isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="generateCategories" className="text-sm">
                生成分类
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generateTags"
                checked={analysisOptions.generateTags}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    generateTags: e.target.checked
                  }))
                }
                disabled={batchState.isRunning}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="generateTags" className="text-sm">
                生成标签
              </label>
            </div>
          </div>

          {/* 数量设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="maxCategories" className="text-sm font-medium">
                最大分类数
              </label>
              <input
                type="number"
                id="maxCategories"
                min="1"
                max="10"
                value={analysisOptions.maxCategories}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    maxCategories: parseInt(e.target.value) || 5
                  }))
                }
                disabled={batchState.isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="maxTags" className="text-sm font-medium">
                最大标签数
              </label>
              <input
                type="number"
                id="maxTags"
                min="1"
                max="20"
                value={analysisOptions.maxTags}
                onChange={(e) =>
                  setAnalysisOptions(prev => ({
                    ...prev,
                    maxTags: parseInt(e.target.value) || 10
                  }))
                }
                disabled={batchState.isRunning}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 文件选择 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedFiles.length === imageFiles.length}
              onCheckedChange={handleSelectAll}
              disabled={batchState.isRunning}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              选择文件 ({selectedFiles.length}/{imageFiles.length})
            </label>
          </div>

          <div className="max-h-40 overflow-y-auto border rounded-md p-2">
            {imageFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-2 p-1">
                <Checkbox
                  id={`file-${file.id}`}
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={(checked) =>
                    handleFileToggle(file.id, checked as boolean)
                  }
                  disabled={batchState.isRunning}
                />
                <label
                  htmlFor={`file-${file.id}`}
                  className="text-sm cursor-pointer flex-1 truncate"
                >
                  {file.title || `图片 ${file.id}`}
                </label>
                <Badge variant="outline" className="text-xs">
                  {Math.round((file.file_size || 0) / 1024)}KB
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* 分析选项说明 */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
          <p className="font-medium mb-1">🔄 顺序批量处理特性：</p>
          <p>• 顺序处理：每张图片分析完成后才开始下一张</p>
          <p>• 智能轮询：实时监听单个任务状态，完成后立即开始下一个</p>
          <p>• 状态同步：确保数据一致性，避免并发冲突</p>
          <p>• 容错重试：自动处理失败任务，继续处理下一张</p>
          <p>• 自动保存：完成后自动同步到媒体库，支持跨标签页更新</p>
          {batchState.isRunning && <p className="text-blue-600 mt-1">• 当前正在处理第 {batchState.completed + batchState.failed + batchState.processing + 1} 张图片...</p>}
        </div>

        {/* 进度显示 */}
        {batchState.total > 0 && (
          <div className="space-y-2">
            {batchState.isRunning && (
              <div className="text-sm font-medium text-blue-600">
                当前处理第 {batchState.completed + batchState.failed + batchState.processing + 1}/{batchState.total} 张图片
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>总体进度</span>
              <span>
                {batchState.completed}/{batchState.total} (
                  {Math.round((batchState.completed / batchState.total) * 100)}%
                )
              </span>
            </div>
            <Progress
              value={(batchState.completed / batchState.total) * 100}
              className="w-full"
            />
            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                待处理: {batchState.pending}
              </div>
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                处理中: {batchState.processing}
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                已完成: {batchState.completed}
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                失败: {batchState.failed}
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={startBatchAnalysis}
            disabled={
              batchState.isRunning ||
              !selectedModel ||
              selectedFiles.length === 0
            }
            className="flex items-center gap-2"
          >
            {batchState.isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                顺序处理中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                开始顺序批量分析
              </>
            )}
          </Button>

          {batchState.total > 0 && (
            <Button
              onClick={resetAnalysis}
              variant="outline"
              disabled={batchState.isRunning}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              重置
            </Button>
          )}
        </div>

        {/* 顺序处理提示 */}
        {batchState.isRunning && (
          <Alert>
            <Activity className="h-4 w-4" />
            <AlertDescription>
              <strong>顺序处理模式：</strong>正在按顺序逐张分析图片，确保每张图片完全处理完成后再开始下一张。
              系统会实时监控每张图片的分析状态，当前正在处理第 {batchState.completed + batchState.failed + batchState.processing + 1} 张。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}