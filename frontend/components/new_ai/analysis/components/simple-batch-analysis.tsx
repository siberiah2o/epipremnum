"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Activity,
  Plus,
} from "lucide-react";
import { useAIModels } from "../../hooks/use-ai-models";
import { useAsyncBatchAnalysis } from "../hooks/use-async-batch-analysis";
import { type MediaListItem } from "@/lib/api";
import { getSortedVisionModels } from "@/lib/model-utils";
import { toast } from "sonner";

interface SimpleBatchAnalysisProps {
  mediaFiles: MediaListItem[];
  totalFiles?: number;
  loading?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onJobComplete?: (successCount: number, failedCount: number) => void;
  onMediaUpdate?: () => void;
}

export function SimpleBatchAnalysis({
  mediaFiles,
  totalFiles = 0,
  loading = false,
  onRefresh,
  onLoadMore,
  onJobComplete,
  onMediaUpdate,
}: SimpleBatchAnalysisProps) {
  const { models, loading: modelsLoading } = useAIModels();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  // 同步批量分析
  const {
    state: batchState,
    performBatchAnalysis,
    resetState,
  } = useAsyncBatchAnalysis();

  // 移除并发控制，改为顺序处理
  // const [concurrencyLimit, setConcurrencyLimit] = useState(1); // 固定为1，顺序处理

  // 分析选项
  const [analysisOptions, setAnalysisOptions] = useState({
    generateTitle: true,
    generateDescription: true,
    generateCategories: true,
    generateTags: true,
    maxCategories: 5,
    maxTags: 10,
    concurrency: 5, // 默认并发数
  });

  // 使用工具函数获取排序后的视觉模型
  const visionModels = getSortedVisionModels(models);

  // 自动选择第一个视觉模型
  useEffect(() => {
    if (!modelsLoading && !selectedModel && visionModels.length > 0) {
      setSelectedModel(visionModels[0].name);
    }
  }, [visionModels, selectedModel, modelsLoading]);

  const imageFiles = mediaFiles.filter((file) => file.file_type === "image");

  // 获取文件的处理状态
  const getFileStatus = (fileId: number) => {
    const task = batchState.tasks.find((t) => t.mediaId === fileId);
    if (!task) return null;

    return {
      status: task.status,
      progress: task.progress,
    };
  };

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
        generate_categories: analysisOptions.generateCategories,
        generate_tags: analysisOptions.generateTags,
        max_categories: analysisOptions.maxCategories,
        max_tags: analysisOptions.maxTags,
      },
      analysisOptions.concurrency, // 使用动态并发设置
      (successCount: number, failedCount: number) => {
        // 任务完成后的处理
        console.log(
          `🔍 [BATCH] 批量分析完成：成功 ${successCount}，失败 ${failedCount}`
        );

        // 触发全局媒体更新事件
        window.dispatchEvent(new CustomEvent("media-updated"));
        localStorage.setItem("media-analysis-completed", Date.now().toString());

        setTimeout(() => {
          localStorage.removeItem("media-analysis-completed");
        }, 1000);

        // 显示成功消息
        toast.success(
          `批量分析完成！成功: ${successCount}，失败: ${failedCount}`
        );

        // 延迟重置分析状态，确保所有内部状态都已完成更新
        setTimeout(() => {
          resetAnalysis();
        }, 500);

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
      {/* 头部统计和模型选择区域 */}
      <div className="border-b px-6 py-1">
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：模型选择 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              选择AI模型
            </label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={batchState.isRunning}
            >
              <SelectTrigger className="w-80">
                <SelectValue placeholder="选择AI模型" />
              </SelectTrigger>
              <SelectContent>
                {visionModels.length === 0 ? (
                  <SelectItem value="none" disabled>
                    没有可用的视觉模型
                  </SelectItem>
                ) : (
                  visionModels.map((model, index) => (
                    <SelectItem
                      key={`model-${model.id || model.name}-${
                        model.endpoint_id || "default"
                      }-${index}`}
                      value={model.name}
                    >
                      {model.name}
                      {model.is_default && <Badge className="ml-2">默认</Badge>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 右侧：文件统计和刷新 */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              已加载 {mediaFiles.length} / {totalFiles} 个图片文件
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
          </div>
        </div>
      </div>
      <CardContent className="space-y-3 p-4 pt-2">
        {/* 分析设置 - 合并后的紧凑卡片 */}
        <Card>
          <CardContent className="p-2 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 左侧：分析选项 */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  分析选项
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="generateTitle"
                      checked={analysisOptions.generateTitle}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          generateTitle: e.target.checked,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label
                      htmlFor="generateTitle"
                      className="text-sm cursor-pointer"
                    >
                      生成标题
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="generateDescription"
                      checked={analysisOptions.generateDescription}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          generateDescription: e.target.checked,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label
                      htmlFor="generateDescription"
                      className="text-sm cursor-pointer"
                    >
                      生成描述
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="generateCategories"
                      checked={analysisOptions.generateCategories}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          generateCategories: e.target.checked,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label
                      htmlFor="generateCategories"
                      className="text-sm cursor-pointer"
                    >
                      生成分类
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="generateTags"
                      checked={analysisOptions.generateTags}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          generateTags: e.target.checked,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label
                      htmlFor="generateTags"
                      className="text-sm cursor-pointer"
                    >
                      生成标签
                    </label>
                  </div>
                </div>
              </div>

              {/* 右侧：数量设置 */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  数量设置
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="maxCategories"
                      className="text-xs text-gray-600 font-medium"
                    >
                      最大分类数
                    </label>
                    <input
                      type="number"
                      id="maxCategories"
                      min="1"
                      max="10"
                      value={analysisOptions.maxCategories}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          maxCategories: parseInt(e.target.value) || 5,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="maxTags"
                      className="text-xs text-gray-600 font-medium"
                    >
                      最大标签数
                    </label>
                    <input
                      type="number"
                      id="maxTags"
                      min="1"
                      max="20"
                      value={analysisOptions.maxTags}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          maxTags: parseInt(e.target.value) || 10,
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor="concurrency"
                      className="text-xs text-gray-600 font-medium"
                    >
                      并发数
                    </label>
                    <input
                      type="number"
                      id="concurrency"
                      min="1"
                      max="10"
                      value={analysisOptions.concurrency}
                      onChange={(e) =>
                        setAnalysisOptions((prev) => ({
                          ...prev,
                          concurrency: Math.min(
                            10,
                            Math.max(1, parseInt(e.target.value) || 5)
                          ),
                        }))
                      }
                      disabled={batchState.isRunning}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      同时处理的图片数量（1-10）
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

          <div className="max-h-96 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <span className="sr-only">选择</span>
                  </TableHead>
                  <TableHead>文件名</TableHead>
                  <TableHead className="w-20 text-right">大小</TableHead>
                  <TableHead className="w-24 text-center">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imageFiles.map((file) => {
                  const fileStatus = getFileStatus(file.id);
                  return (
                    <TableRow key={file.id}>
                      <TableCell>
                        <Checkbox
                          id={`file-${file.id}`}
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={(checked) =>
                            handleFileToggle(file.id, checked as boolean)
                          }
                          disabled={batchState.isRunning}
                        />
                      </TableCell>
                      <TableCell>
                        <label
                          htmlFor={`file-${file.id}`}
                          className="text-sm cursor-pointer hover:underline"
                        >
                          {file.title || `图片 ${file.id}`}
                        </label>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {Math.round((file.file_size || 0) / 1024)}KB
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {fileStatus && (
                          <div className="flex items-center justify-center gap-1">
                            {fileStatus.status === "processing" && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs">处理中</span>
                              </div>
                            )}
                            {fileStatus.status === "completed" && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                <span className="text-xs">完成</span>
                              </div>
                            )}
                            {fileStatus.status === "failed" && (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">失败</span>
                              </div>
                            )}
                            {fileStatus.status === "pending" && (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span className="text-xs">等待中</span>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 进度显示 */}
        {batchState.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>总体进度</span>
              <span>
                {batchState.completed}/{batchState.total} (
                {Math.round((batchState.completed / batchState.total) * 100)}% )
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
        <div className="flex gap-2 flex-wrap">
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

          {onLoadMore && (
            <Button
              onClick={onLoadMore}
              variant="outline"
              disabled={loading || batchState.isRunning}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              加载更多文件
            </Button>
          )}

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
      </CardContent>
    </Card>
  );
}
