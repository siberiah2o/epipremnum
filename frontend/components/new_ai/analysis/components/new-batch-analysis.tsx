"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Square,
  RefreshCw,
  FileText,
  Clock,
  Zap,
  Settings,
  Activity,
  Pause,
} from "lucide-react";
import { type MediaListItem } from "@/lib/api";
import { useAIModels } from "../../hooks/use-ai-models";
import { useAsyncBatchAnalysis } from "../hooks/use-async-batch-analysis";

interface NewBatchAnalysisProps {
  mediaFiles: MediaListItem[];
  onJobComplete?: (successCount: number, failedCount: number) => void;
  onMediaUpdate?: () => void;
}

interface AnalysisTask {
  id: string;
  mediaFile: MediaListItem;
  status: "pending" | "running" | "completed" | "failed" | "retrying";
  result?: any;
  error?: string;
  retries: number;
  startTime?: number;
  endTime?: number;
}

interface ConcurrentAnalysisState {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  startTime: Date;
  currentTasks: AnalysisTask[];
  allTasks: AnalysisTask[];
  estimatedTimeRemaining: number;
  averageTimePerFile: number;
  isPaused: boolean;
  isCancelled: boolean;
}

export function NewBatchAnalysis({
  mediaFiles,
  onJobComplete,
  onMediaUpdate,
}: NewBatchAnalysisProps) {
  // 基础状态
  const { models, loading: modelsLoading } = useAIModels();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);

  // 异步批量分析
  const { state: batchState, performBatchAnalysis, resetState, isPolling } = useAsyncBatchAnalysis();

  // 并发控制状态
  const [concurrencyLimit, setConcurrencyLimit] = useState(2); // 默认2个并发

  // 分析选项
  const [analysisOptions, setAnalysisOptions] = useState({
    generateTitle: true,
    generateDescription: true,
    generatePrompt: false,
    generateCategories: true,
    generateTags: true,
    maxCategories: 5,
    maxTags: 10,
  });

  // 过滤出可用的视觉模型
  const visionModels = models.filter(
    (model) => model.is_vision_capable && model.is_active
  );

  // 自动选择第一个视觉模型或默认模型
  useEffect(() => {
    if (!modelsLoading && !selectedModel && visionModels.length > 0) {
      // 优先选择默认模型，否则选择第一个可用的视觉模型
      const defaultModel = visionModels.find((model) => model.is_default);
      const modelToSelect = defaultModel || visionModels[0];

      if (modelToSelect) {
        console.log("自动选择模型:", modelToSelect.name, {
          isDefault: modelToSelect.is_default,
          isActive: modelToSelect.is_active,
          isVisionCapable: modelToSelect.is_vision_capable,
          totalVisionModels: visionModels.length,
        });
        setSelectedModel(modelToSelect.name);
      }
    } else if (
      !modelsLoading &&
      visionModels.length === 0 &&
      models.length > 0
    ) {
      console.warn("没有可用的视觉模型，但存在其他模型:", {
        totalModels: models.length,
        models: models.map((m) => ({
          name: m.name,
          is_active: m.is_active,
          is_vision_capable: m.is_vision_capable,
        })),
      });
    }
  }, [modelsLoading, visionModels, selectedModel, models]);

  // 初始化文件选择
  useEffect(() => {
    const imageFiles = mediaFiles.filter((file) => file.file_type === "image");
    if (selectedFiles.length === 0 && imageFiles.length > 0) {
      setSelectedFiles(imageFiles.map((file) => file.id));
    }
  }, [mediaFiles]);

  // 创建分析任务
  const createAnalysisTasks = (
    filesToAnalyze: MediaListItem[]
  ): AnalysisTask[] => {
    return filesToAnalyze.map((file, index) => ({
      id: `task-${file.id}-${index}`,
      mediaFile: file,
      status: "pending" as const,
      retries: 0,
    }));
  };

  // 执行单个文件分析
  const analyzeSingleFile = async (
    task: AnalysisTask
  ): Promise<{ success: boolean; result?: any; error?: string }> => {
    try {
      // 严格验证是否已选择模型
      if (!selectedModel || selectedModel.trim() === "") {
        console.error(`任务 ${task.id} 错误: 模型名称为空或未选择`, {
          selectedModel,
          task: task.mediaFile.id,
          availableModels: visionModels.map((m) => m.name),
          modelsLoading,
          allModels: models.map((m) => ({
            name: m.name,
            is_active: m.is_active,
            is_vision_capable: m.is_vision_capable,
          })),
        });
        throw new Error("未选择AI模型，请先选择一个可用的视觉模型");
      }

      console.log(
        `开始分析任务 ${task.id} (文件: ${task.mediaFile.id})，使用模型: ${selectedModel}`
      );

      const result = await apiClient.analyzeSingle(
        task.mediaFile.id,
        selectedModel.trim(),
        true, // 强制重新分析
        {
          generate_title: analysisOptions.generateTitle,
          generate_description: analysisOptions.generateDescription,
          generate_prompt: analysisOptions.generatePrompt,
          generate_categories: analysisOptions.generateCategories,
          generate_tags: analysisOptions.generateTags,
          max_categories: analysisOptions.maxCategories,
          max_tags: analysisOptions.maxTags,
        }
      );

      console.log(`任务 ${task.id} 分析成功`);
      return { success: true, result };
    } catch (err: any) {
      console.error(`任务 ${task.id} 分析失败:`, err);
      return {
        success: false,
        error: err.message || "分析失败",
      };
    }
  };

  // 更新任务状态
  const updateTaskStatus = useCallback(
    (taskId: string, updates: Partial<AnalysisTask>) => {
      setAnalysisState((prev) => {
        if (!prev) return prev;

        const updatedTasks = prev.allTasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        );

        const completed = updatedTasks.filter(
          (t) => t.status === "completed"
        ).length;
        const failed = updatedTasks.filter((t) => t.status === "failed").length;
        const running = updatedTasks.filter(
          (t) => t.status === "running" || t.status === "retrying"
        ).length;
        const pending = updatedTasks.filter(
          (t) => t.status === "pending"
        ).length;

        // 计算平均处理时间
        const completedTasks = updatedTasks.filter(
          (t) => t.status === "completed" && t.startTime && t.endTime
        );
        const averageTimePerFile =
          completedTasks.length > 0
            ? completedTasks.reduce(
                (sum, task) => sum + (task.endTime! - task.startTime!),
                0
              ) / completedTasks.length
            : 0;

        // 估算剩余时间
        const remainingTasks = updatedTasks.filter(
          (t) => t.status !== "completed" && t.status !== "failed"
        ).length;
        const estimatedTimeRemaining =
          averageTimePerFile > 0
            ? (remainingTasks * averageTimePerFile) / 1000
            : 0;

        const newProgress = (completed / prev.total) * 100;

        setProgress(newProgress);

        return {
          ...prev,
          allTasks: updatedTasks,
          currentTasks: updatedTasks,
          completed,
          failed,
          running,
          pending,
          averageTimePerFile,
          estimatedTimeRemaining,
        };
      });
    },
    []
  );

  // 处理任务完成
  const handleTaskCompletion = useCallback(
    async (
      task: AnalysisTask,
      success: boolean,
      result?: any,
      error?: string
    ) => {
      const endTime = Date.now();

      if (success && result) {
        updateTaskStatus(task.id, {
          status: "completed",
          result,
          endTime,
          retries: task.retries,
        });
      } else {
        // 检查错误类型，如果是模型相关错误，不再重试
        const isModelError =
          error?.includes("未选择AI模型") ||
          error?.includes("model_name") ||
          error?.includes("模型") ||
          error?.includes("blank");

        // 检查是否需要重试
        if (!isModelError && autoRetry && task.retries < maxRetries) {
          updateTaskStatus(task.id, {
            status: "retrying",
            error: `${error} (准备重试 ${task.retries + 1}/${maxRetries})`,
            retries: task.retries + 1,
          });

          // 延迟后重试
          const retryDelay = Math.min(1000 * Math.pow(2, task.retries), 5000); // 指数退避，最大5秒
          const retryTimeout = setTimeout(() => {
            processTask(task);
          }, retryDelay);

          retryTimeoutsRef.current.set(task.id, retryTimeout);
        } else {
          const errorMessage = isModelError
            ? "模型配置错误，请检查AI模型设置"
            : `${error} (重试次数: ${task.retries}/${maxRetries})`;

          updateTaskStatus(task.id, {
            status: "failed",
            error: errorMessage,
            endTime,
            retries: task.retries,
          });
        }
      }
    },
    [autoRetry, maxRetries, updateTaskStatus]
  );

  // 处理单个任务
  const processTask = useCallback(
    async (task: AnalysisTask) => {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // 在处理任务前再次验证模型是否可用
      if (!selectedModel || selectedModel.trim() === "") {
        const errorMessage = `任务 ${task.id} 无法开始：未选择AI模型`;
        console.error(errorMessage, {
          selectedModel,
          availableVisionModels: visionModels.map((m) => m.name),
          modelsLoading,
        });
        await handleTaskCompletion(task, false, undefined, errorMessage);
        return;
      }

      const startTime = Date.now();
      updateTaskStatus(task.id, {
        status: "running",
        startTime,
      });

      try {
        const { success, result, error } = await analyzeSingleFile(task);
        await handleTaskCompletion(task, success, result, error);
      } catch (err: any) {
        await handleTaskCompletion(task, false, undefined, err.message);
      }
    },
    [
      updateTaskStatus,
      handleTaskCompletion,
      selectedModel,
      visionModels,
      modelsLoading,
    ]
  );

  // 启动单个任务（用于填充空闲槽位）
  const startSingleTask = useCallback((task: AnalysisTask) => {
    if (!abortControllerRef.current?.signal.aborted) {
      processTask(task);
    }
  }, [processTask]);

  // 启动并发分析
  const startConcurrentAnalysis = useCallback(() => {
    if (!selectedModel || selectedModel.trim() === "") {
      console.error("无法启动并发分析：未选择模型", {
        selectedModel,
        availableVisionModels: visionModels.map((m) => m.name),
        modelsLoading,
      });
      setError("请先选择一个可用的视觉模型");
      return;
    }

    if (!analysisState) {
      console.log("分析状态尚未初始化，等待中...");
      return; // 静默返回，不要设置错误
    }

    const pendingTasks = analysisState.allTasks.filter(
      (task) => task.status === "pending"
    );
    const runningTasks = analysisState.allTasks.filter(
      (task) => task.status === "running" || task.status === "retrying"
    );

    // 计算可用的并发槽位
    const availableSlots = concurrencyLimit - runningTasks.length;
    const tasksToStart = pendingTasks.slice(0, availableSlots);

    console.log(`并发队列管理`, {
      总任务数: analysisState.allTasks.length,
      等待中: pendingTasks.length,
      运行中: runningTasks.length,
      可用槽位: availableSlots,
      即将启动: tasksToStart.length,
      当前并发限制: concurrencyLimit,
      选择模型: selectedModel,
    });

    // 启动任务来填充空闲槽位
    tasksToStart.forEach(startSingleTask);
  }, [
    selectedModel,
    analysisState,
    concurrencyLimit,
    startSingleTask,
    visionModels,
    modelsLoading,
  ]);

  // 统一的队列管理 useEffect - 监听所有状态变化
  useEffect(() => {
    if (
      isRunning &&
      analysisState &&
      !analysisState.isPaused &&
      !analysisState.isCancelled &&
      analysisState.total > 0 // 确保分析已开始
    ) {
      // 当状态变化时，检查是否需要启动新任务填充槽位
      const timer = setTimeout(() => {
        startConcurrentAnalysis();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [
    analysisState?.total,       // 监听初始化
    analysisState?.completed,   // 监听任务完成
    analysisState?.failed,      // 监听任务失败
    analysisState?.running,     // 监听运行中任务
    analysisState?.pending,     // 监听等待任务
    isRunning,
    startConcurrentAnalysis,
  ]);

  // 开始批量分析
  const startBatchAnalysis = async () => {
    // 严格验证所有必要条件
    if (!selectedModel || selectedModel.trim() === "") {
      console.error("批量分析启动失败: 未选择模型", {
        selectedModel,
        availableVisionModels: visionModels.map((m) => m.name),
        modelsLoading,
        totalModels: models.length,
      });
      toast.error("请先选择一个可用的视觉模型");
      return;
    }

    // 验证选择的模型是否在可用模型列表中
    const isModelAvailable = visionModels.some(
      (model) => model.name === selectedModel.trim()
    );
    if (!isModelAvailable) {
      console.error("批量分析启动失败: 选择的模型不可用", {
        selectedModel,
        availableVisionModels: visionModels.map((m) => m.name),
      });
      toast.error(`选择的模型 "${selectedModel}" 不可用，请选择其他视觉模型`);
      return;
    }

    const imageFiles = mediaFiles.filter((file) => file.file_type === "image");
    const filesToAnalyze = imageFiles.filter((file) =>
      selectedFiles.includes(file.id)
    );

    if (filesToAnalyze.length === 0) {
      toast.error("请选择要分析的图片文件");
      return;
    }

    console.log(
      `开始批量分析，模型: ${selectedModel.trim()}, 文件数量: ${
        filesToAnalyze.length
      }`,
      {
        selectedModel,
        filesToAnalyze: filesToAnalyze.length,
        concurrencyLimit,
        analysisOptions,
      }
    );

    setIsRunning(true);
    setError(null);

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 初始化分析状态
    const tasks = createAnalysisTasks(filesToAnalyze);
    const initialState: ConcurrentAnalysisState = {
      total: filesToAnalyze.length,
      completed: 0,
      failed: 0,
      running: 0,
      pending: filesToAnalyze.length,
      startTime: new Date(),
      currentTasks: tasks,
      allTasks: tasks,
      estimatedTimeRemaining: 0,
      averageTimePerFile: 0,
      isPaused: false,
      isCancelled: false,
    };

    setAnalysisState(initialState);
    setProgress(0);

    toast.success(
      `启动动态并发队列 (${concurrencyLimit}个并发槽位，模型: ${selectedModel.trim()})`
    );
  };

  // 暂停/恢复分析
  const togglePause = () => {
    if (!analysisState) return;

    setAnalysisState((prev) =>
      prev ? { ...prev, isPaused: !prev.isPaused } : null
    );

    if (analysisState.isPaused) {
      toast.info("恢复批量分析");
      // 重新启动任务调度
      setTimeout(() => startConcurrentAnalysis(), 100);
    } else {
      toast.info("批量分析已暂停");
    }
  };

  // 取消分析
  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 清除所有超时
    timeoutRefsRef.current.forEach((timeout) => clearTimeout(timeout));
    retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefsRef.current.clear();
    retryTimeoutsRef.current.clear();

    setIsRunning(false);
    setAnalysisState((prev) =>
      prev ? { ...prev, isCancelled: true, isPaused: false } : null
    );
    toast.info("批量分析已取消");
  };

  // 重置分析状态
  const handleReset = () => {
    // 清除所有超时
    timeoutRefsRef.current.forEach((timeout) => clearTimeout(timeout));
    retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefsRef.current.clear();
    retryTimeoutsRef.current.clear();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setAnalysisState(null);
    setProgress(0);
    setError(null);
    setIsRunning(false);
    onMediaUpdate?.();
    toast.success("分析状态已重置");
  };

  // 监听分析完成
  useEffect(() => {
    if (analysisState && isRunning && !analysisState.isPaused) {
      const totalProcessed = analysisState.completed + analysisState.failed;

      if (totalProcessed === analysisState.total && totalProcessed > 0) {
        setIsRunning(false);

        const successCount = analysisState.completed;
        const failedCount = analysisState.failed;

        toast.success(
          `批量分析完成！成功: ${successCount}，失败: ${failedCount}`
        );

        if (onJobComplete) {
          onJobComplete(successCount, failedCount);
        }

        // 自动刷新媒体数据
        if (successCount > 0) {
          setTimeout(() => {
            onMediaUpdate?.();
          }, 1000);
        }
      }
    }
  }, [analysisState, isRunning, onJobComplete, onMediaUpdate]);

  // 格式化时间
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}分钟${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor(
      (seconds % 3600) / 60
    )}分钟`;
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
    const imageFiles = mediaFiles.filter((file) => file.file_type === "image");
    if (checked) {
      setSelectedFiles(imageFiles.map((file) => file.id));
    } else {
      setSelectedFiles([]);
    }
  };

  if (modelsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            并发批量分析
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

  const imageFiles = mediaFiles.filter((file) => file.file_type === "image");
  const selectedImageFiles = selectedFiles.filter((id) =>
    imageFiles.some((file) => file.id === id)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          动态并发队列分析
        </CardTitle>
        <CardDescription>
          智能并发控制：始终维持{concurrencyLimit}个活跃请求，完成一个立即补充一个，最大化分析效率
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            选择AI模型 <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedModel}
            onChange={(e) => {
              console.log("用户选择模型:", e.target.value);
              setSelectedModel(e.target.value);
            }}
            className="w-full p-2 border rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            disabled={isRunning}
          >
            <option value="">请选择模型</option>
            {visionModels.map((model, index) => (
              <option key={`model-${model.name}-${index}`} value={model.name}>
                {model.display_name} ({model.model_size}){" "}
                {model.is_default && "[默认]"}
              </option>
            ))}
            {visionModels.length === 0 && (
              <option value="" disabled>
                没有可用的活跃视觉模型，请在AI管理中激活模型
              </option>
            )}
          </select>
          {selectedModel && (
            <p className="text-xs text-green-600">
              ✅ 已选择模型: {selectedModel}
            </p>
          )}
          {!selectedModel && models.length > 0 && (
            <p className="text-xs text-amber-600">
              ⚠️ 请选择一个视觉模型以开始分析
            </p>
          )}
        </div>

        
        {/* 分析选项 - 紧凑版本 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">分析选项</label>
            </div>

            {/* 生成选项 */}
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={analysisOptions.generateTitle}
                  onChange={(e) =>
                    setAnalysisOptions({
                      ...analysisOptions,
                      generateTitle: e.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <span>标题</span>
              </label>
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={analysisOptions.generateDescription}
                  onChange={(e) =>
                    setAnalysisOptions({
                      ...analysisOptions,
                      generateDescription: e.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <span>描述</span>
              </label>
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={analysisOptions.generatePrompt}
                  onChange={(e) =>
                    setAnalysisOptions({
                      ...analysisOptions,
                      generatePrompt: e.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <span>提示词</span>
              </label>
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={analysisOptions.generateCategories}
                  onChange={(e) =>
                    setAnalysisOptions({
                      ...analysisOptions,
                      generateCategories: e.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <span>分类</span>
              </label>
              <label className="flex items-center space-x-1 text-sm">
                <input
                  type="checkbox"
                  checked={analysisOptions.generateTags}
                  onChange={(e) =>
                    setAnalysisOptions({
                      ...analysisOptions,
                      generateTags: e.target.checked,
                    })
                  }
                  disabled={isRunning}
                />
                <span>标签</span>
              </label>
            </div>

            {/* 数量设置和并发控制 */}
            <div className="flex items-center gap-4 text-sm">
              {analysisOptions.generateCategories && (
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground">分类数:</label>
                  <Select
                    value={analysisOptions.maxCategories.toString()}
                    onValueChange={(value) =>
                      setAnalysisOptions({
                        ...analysisOptions,
                        maxCategories: parseInt(value),
                      })
                    }
                    disabled={isRunning}
                  >
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 8, 10].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {analysisOptions.generateTags && (
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground">标签数:</label>
                  <Select
                    value={analysisOptions.maxTags.toString()}
                    onValueChange={(value) =>
                      setAnalysisOptions({
                        ...analysisOptions,
                        maxTags: parseInt(value),
                      })
                    }
                    disabled={isRunning}
                  >
                    <SelectTrigger className="w-16 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 8, 10, 15, 20].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-1">
                <label className="text-muted-foreground">并发:</label>
                <Select
                  value={concurrencyLimit.toString()}
                  onValueChange={(value) =>
                    setConcurrencyLimit(parseInt(value))
                  }
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-16 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

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
            {imageFiles.map((file) => {
              const task = analysisState?.allTasks.find(
                (t) => t.mediaFile.id === file.id
              );

              return (
                <div key={file.id} className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={(checked) =>
                      handleFileSelection(file.id, checked as boolean)
                    }
                    disabled={isRunning}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {file.title || file.file_url.split("/").pop()}
                    </div>
                  </div>

                  {/* 显示任务状态 */}
                  {task && (
                    <>
                      {task.status === "completed" && (
                        <Badge
                          variant="default"
                          className="text-xs bg-green-100 text-green-800"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          完成
                        </Badge>
                      )}
                      {task.status === "failed" && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          失败
                        </Badge>
                      )}
                      {task.status === "running" && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-100 text-blue-800"
                        >
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          分析中
                        </Badge>
                      )}
                      {task.status === "retrying" && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-orange-100 text-orange-800"
                        >
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          重试 {task.retries}/{maxRetries}
                        </Badge>
                      )}
                      {task.status === "pending" && (
                        <Badge variant="outline" className="text-xs">
                          等待中
                        </Badge>
                      )}
                    </>
                  )}

                  {/* 显示文件大小 */}
                  <Badge variant="outline" className="text-xs">
                    {(file.file_size / 1024 / 1024).toFixed(1)}MB
                  </Badge>
                </div>
              );
            })}
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
            title={
              !selectedModel
                ? "请先选择AI模型"
                : selectedImageFiles.length === 0
                ? "请选择要分析的图片文件"
                : isRunning
                ? "分析正在进行中"
                : "开始并发分析"
            }
          >
            {isRunning ? (
              <>
                <Activity className="h-4 w-4 animate-pulse" />
                动态并发中 ({concurrencyLimit}个槽位)
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                启动动态并发 ({selectedImageFiles.length} 张图片)
              </>
            )}
          </Button>

          {isRunning && (
            <Button
              variant="outline"
              onClick={togglePause}
              className="flex items-center gap-2"
            >
              {analysisState?.isPaused ? (
                <>
                  <Play className="h-4 w-4" />
                  恢复
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  暂停
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重置状态
          </Button>
        </div>

        {/* 错误信息 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 并发分析进度 */}
        {analysisState && (
          <div className="space-y-4">
            <Separator />
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">并发分析进度</h3>
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelAnalysis}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  取消
                </Button>
              )}
            </div>

            {/* 总体进度 */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">总体进度</span>
                <span className="text-sm text-muted-foreground">
                  {analysisState.completed + analysisState.failed} /{" "}
                  {analysisState.total}
                </span>
              </div>
              <Progress value={progress} className="w-full mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}% 完成</span>
                <span>
                  平均处理时间: {formatTime(analysisState.averageTimePerFile)}
                </span>
                {analysisState.estimatedTimeRemaining > 0 && (
                  <span>
                    预计剩余: {formatTime(analysisState.estimatedTimeRemaining)}
                  </span>
                )}
              </div>
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                      !isRunning
                        ? "default"
                        : analysisState.isPaused
                        ? "secondary"
                        : analysisState.isCancelled
                        ? "destructive"
                        : "default"
                    }
                  >
                    {!isRunning
                      ? "已完成"
                      : analysisState.isCancelled
                      ? "已取消"
                      : analysisState.isPaused
                      ? "已暂停"
                      : "进行中"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">总数</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{analysisState.total}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-600">
                    已完成
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {analysisState.completed}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-600">
                    进行中
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysisState.running}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-600">失败</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">
                    {analysisState.failed}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 并发性能指标 */}
            {analysisState.averageTimePerFile > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  性能指标
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">并发数:</span>
                    <span className="ml-2 font-medium">{concurrencyLimit}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">平均处理时间:</span>
                    <span className="ml-2 font-medium">
                      {formatTime(analysisState.averageTimePerFile)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">预估吞吐量:</span>
                    <span className="ml-2 font-medium">
                      {Math.round(60000 / analysisState.averageTimePerFile)}{" "}
                      张/分钟
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">运行时间:</span>
                    <span className="ml-2 font-medium">
                      {formatTime(
                        Date.now() - analysisState.startTime.getTime()
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
