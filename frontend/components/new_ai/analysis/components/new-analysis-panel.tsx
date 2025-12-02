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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Brain,
  Loader2,
  AlertCircle,
  Sparkles,
  Eye,
  Tag,
  FolderOpen,
  FileText,
  Wand2,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAIModels } from "../../hooks/use-ai-models";
import { useAsyncAIAnalysis } from "../hooks/use-async-ai-analysis";
import { getSortedVisionModels } from "@/lib/model-utils";
import type { MediaFile } from "../types/analysis";

interface NewAnalysisPanelProps {
  selectedFile: MediaFile | null;
  onMediaUpdate: () => void;
}

// 复制到剪贴板的工具函数
const copyToClipboard = async (text: string, successMessage: string) => {
  try {
    // 优先使用现代的 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // 降级方案：使用 document.execCommand
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const result = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (!result) {
        throw new Error("复制失败");
      }
    }
    toast.success(successMessage);
  } catch (err) {
    console.error("复制失败:", err);
    toast.error("复制失败，请手动复制");
  }
};

// 组件：紧凑的标签展示
const CompactTagsDisplay = React.memo(
  ({
    title,
    icon: Icon,
    items,
    variant = "secondary",
  }: {
    title: string;
    icon: any;
    items: Array<{ name: string; id: number }>;
    variant?: "secondary" | "outline";
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayItems = isExpanded ? items : items.slice(0, 8);
    const hasMore = items.length > 8;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
            <Badge variant="secondary" className="text-xs">
              {items.length} 个
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {displayItems.map((item, index) => (
              <Badge
                key={item.id || `${item.name}-${index}`}
                variant={variant}
                className="text-xs px-2 py-1 hover:opacity-80 transition-opacity cursor-default"
              >
                {item.name}
              </Badge>
            ))}
            {hasMore && !isExpanded && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(true)}
              >
                +{items.length - 8} 更多
              </Badge>
            )}
            {hasMore && isExpanded && (
              <Badge
                variant="outline"
                className="text-xs px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsExpanded(false)}
              >
                收起
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

CompactTagsDisplay.displayName = "CompactTagsDisplay";

// 组件：图片信息面板（包含AI分析控制）
const ImageInfoPanel = ({
  selectedFile,
  models,
  visionModels,
  selectedModel,
  setSelectedModel,
  analyzing,
  isCurrentlyAnalyzing,
  currentAnalysisStatus,
  analysisProgress,
  onAnalysis
}: {
  selectedFile: MediaFile;
  models: any[];
  visionModels: any[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  analyzing: boolean;
  isCurrentlyAnalyzing: boolean;
  currentAnalysisStatus: any;
  analysisProgress: number;
  onAnalysis: () => void;
}) => {
  // 安全地获取分类和标签数据
  const categories = selectedFile.ai_categories || [];
  const tags = selectedFile.ai_tags || [];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0">
            <img
              src={selectedFile.file_url}
              alt={selectedFile.title}
              className="w-48 h-48 object-cover rounded-lg border shadow-sm"
            />
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">文件大小：</span>
                <span>
                  {selectedFile.file_size
                    ? `${(selectedFile.file_size / 1024 / 1024).toFixed(2)} MB`
                    : "未知"}
                </span>
              </div>
              <div>
                <span className="font-medium">上传时间：</span>
                <span>
                  {selectedFile.created_at
                    ? new Date(selectedFile.created_at).toLocaleString("zh-CN")
                    : "未知"}
                </span>
              </div>
              <div>
                <span className="font-medium">文件类型：</span>
                <span>{selectedFile.file_type}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{selectedFile.title}</h3>
              {(() => {
                // 使用与分析状态面板相同的判断逻辑
                const hasDescription = !!selectedFile.ai_description;
                const hasPrompt = !!selectedFile.ai_prompt;
                const hasCategories =
                  selectedFile.ai_categories &&
                  selectedFile.ai_categories.length > 0;
                const hasTags =
                  selectedFile.ai_tags && selectedFile.ai_tags.length > 0;
                const hasAnalyzedAt = !!selectedFile.ai_analyzed_at;

                const hasAIResults =
                  hasDescription ||
                  hasPrompt ||
                  hasCategories ||
                  hasTags ||
                  hasAnalyzedAt;

                return hasAIResults ? (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    已分析
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    未分析
                  </Badge>
                );
              })()}
            </div>

            {/* 描述和提示词左右布局 */}
            {(selectedFile.description ||
              selectedFile.ai_description ||
              selectedFile.ai_prompt) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(selectedFile.description || selectedFile.ai_description) && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      {selectedFile.ai_description ? "AI描述" : "描述"}
                      {selectedFile.ai_description && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          AI
                        </Badge>
                      )}
                    </h4>
                    <div className="relative">
                      <button
                        onClick={() => {
                          const description =
                            selectedFile.ai_description ||
                            selectedFile.description;
                          copyToClipboard(
                            description!,
                            selectedFile.ai_description
                              ? "AI描述已复制到剪贴板"
                              : "描述已复制到剪贴板"
                          );
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border shadow-sm transition-colors"
                        title="复制描述"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg break-words leading-relaxed max-h-32 overflow-y-auto pr-10">
                        {selectedFile.ai_description ||
                          selectedFile.description}
                      </div>
                    </div>
                  </div>
                )}

                {selectedFile.ai_prompt && (
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Wand2 className="h-3 w-3" />
                      AI绘画提示词
                    </h4>
                    <div className="relative">
                      <button
                        onClick={() => {
                          copyToClipboard(
                            selectedFile.ai_prompt!,
                            "AI绘画提示词已复制到剪贴板"
                          );
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border shadow-sm transition-colors"
                        title="复制AI绘画提示词"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg break-words leading-relaxed max-h-32 overflow-y-auto pr-10">
                        {selectedFile.ai_prompt}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 推荐分类和标签 */}
            {(categories.length > 0 || tags.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {categories.length > 0 && (
                  <CompactTagsDisplay
                    title="推荐分类"
                    icon={FolderOpen}
                    items={categories}
                    variant="secondary"
                  />
                )}

                {tags.length > 0 && (
                  <CompactTagsDisplay
                    title="推荐标签"
                    icon={Tag}
                    items={tags}
                    variant="outline"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI 分析控制模块 */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 模型选择 */}
            <div>
              <label className="text-sm font-medium mb-4 block">选择AI模型</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-2 border rounded-md text-sm bg-white"
                disabled={analyzing}
              >
                <option value="">请选择模型</option>
                {visionModels.map((model, index) => (
                  <option
                    key={`model-${model.id || model.name}-${
                      model.endpoint_id || "default"
                    }-${index}`}
                    value={model.name}
                  >
                    {model.name} ({model.model_size})
                  </option>
                ))}
                {models.length === 0 && visionModels.length === 0 && (
                  <option value="" disabled>
                    没有获取到模型数据，请检查API连接
                  </option>
                )}
                {models.length > 0 && visionModels.length === 0 && (
                  <option value="" disabled>
                    默认端点没有可用的活跃视觉模型，请在AI管理中检查
                  </option>
                )}
              </select>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={onAnalysis}
                disabled={
                  isCurrentlyAnalyzing ||
                  !selectedModel ||
                  currentAnalysisStatus?.status === "processing"
                }
                className="flex items-center gap-2 text-sm flex-1"
              >
                {isCurrentlyAnalyzing ||
                currentAnalysisStatus?.status === "processing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在分析中...
                    {analysisProgress > 0 && (
                      <span className="text-xs font-semibold text-blue-600">
                        {analysisProgress}%
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    开始分析
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function NewAnalysisPanel({
  selectedFile,
  onMediaUpdate,
}: NewAnalysisPanelProps) {
  const { models, loading: modelsLoading, refreshModels } = useAIModels();
  const {
    analyzing,
    analyzingMediaId,
    analysisError,
    performAsyncAnalysis,
    getAnalysisStatus,
    setAnalysisError,
  } = useAsyncAIAnalysis();

  // 使用工具函数获取排序后的视觉模型
  const visionModels = getSortedVisionModels(models);

  // 调试信息 - 使用延迟输出避免被其他日志覆盖
  if (process.env.NODE_ENV === "development") {
    setTimeout(() => {
      console.group("🔍 [DEBUG] 模型状态（默认端点 - 已排序）");
      console.log("总模型数量:", models.length);
      console.log("排序后视觉模型数量:", visionModels.length);
      console.log("排序后的视觉模型:");
      visionModels.forEach((model, index) => {
        const isQwen3 = model.name.toLowerCase().includes('qwen3');
        const isDefault = model.is_default ? '[默认]' : '';
        console.log(`${index + 1}. ${model.name} (${model.model_size}) ${isQwen3 ? '[Qwen3优先]' : ''} ${isDefault}`);
      });
      console.groupEnd();
    }, 100);
  }

  // 自动选择第一个视觉模型
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);

  // 获取当前文件的分析状态
  const currentAnalysisStatus = selectedFile
    ? getAnalysisStatus(selectedFile.id)
    : null;
  const isCurrentlyAnalyzing =
    analyzing && analyzingMediaId === selectedFile?.id;

  useEffect(() => {
    if (visionModels.length > 0 && !selectedModel) {
      // 优先选择默认模型，如果没有默认模型则选择第一个视觉模型
      const defaultModel = visionModels.find((model) => model.is_default);
      const modelToSelect = defaultModel || visionModels[0];
      setSelectedModel(modelToSelect.name);
    }
  }, [visionModels, selectedModel]);

  // 监听轮询状态变化，同步进度
  useEffect(() => {
    if (
      currentAnalysisStatus &&
      currentAnalysisStatus.status === "processing"
    ) {
      setAnalysisProgress(currentAnalysisStatus.progress || 0);
    } else if (
      currentAnalysisStatus &&
      currentAnalysisStatus.status === "completed"
    ) {
      setAnalysisProgress(100);
      // 任务完成后短暂显示100%，然后重置
      const timer = setTimeout(() => {
        setAnalysisProgress(0);
      }, 1500); // 1.5秒后重置进度
      return () => clearTimeout(timer);
    }
  }, [currentAnalysisStatus]);

  // 执行分析
  const handleAnalysis = async () => {
    if (!selectedFile || !selectedModel) return;

    await performAsyncAnalysis(
      selectedFile,
      selectedModel,
      {
        generate_title: true,
        generate_description: true,
        generate_prompt: true,
        generate_categories: true,
        generate_tags: true,
        max_categories: 5,
        max_tags: 10,
      },
      (updatedFile: MediaFile, result: any) => {
        // 分析完成后更新选中的文件
        console.log(`🔍 [UI] 分析完成，重置进度状态`);
        setAnalysisProgress(0);
        // 延迟一下再刷新，确保后端已经完成数据保存
        setTimeout(() => {
          onMediaUpdate();
        }, 1000);
      },
      (progress: number) => {
        // 更新进度状态
        setAnalysisProgress(progress);
        console.log(`分析进度: ${progress}%`);
      }
    );
  };

  if (!selectedFile) {
    return (
      <Card className="h-full min-h-[400px] flex items-center justify-center">
        <CardContent className="text-center p-8">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Brain className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">选择一张图片开始分析</h3>
          <p className="text-muted-foreground max-w-sm">
            从左侧素材列表中选择一张图片，即可开始AI分析
          </p>
        </CardContent>
      </Card>
    );
  }

  if (selectedFile.file_type !== "image") {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>只有图片文件支持AI分析功能</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* 图片信息面板（包含AI分析控制） */}
      <ImageInfoPanel
        selectedFile={selectedFile}
        models={models}
        visionModels={visionModels}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        analyzing={analyzing}
        isCurrentlyAnalyzing={isCurrentlyAnalyzing}
        currentAnalysisStatus={currentAnalysisStatus}
        analysisProgress={analysisProgress}
        onAnalysis={handleAnalysis}
      />

      {/* 模型刷新按钮 - 只在没有模型时显示 */}
      {models.length === 0 && !modelsLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  console.log("🔍 [DEBUG] 手动刷新模型数据");
                  refreshModels();
                }}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                刷新模型数据
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {analysisError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{analysisError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
