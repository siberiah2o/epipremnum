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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Brain,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Eye,
  Tag,
  FolderOpen,
  FileText,
  Wand2,
  Copy,
} from "lucide-react";
import {
  apiClient,
  type MediaListItem,
  type AIAnalysisResult,
} from "@/lib/api";
import {
  aiManagementService,
  connectionStatusManager,
  type OllamaModel,
} from "@/lib/ai-service";
import { toast } from "sonner";

interface ImageAnalysisProps {
  mediaFile: MediaListItem;
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
  onMediaUpdate?: () => void;
}

interface AnalysisOptions {
  generateTitle: boolean;
  generateDescription: boolean;
  generatePrompt: boolean;
  generateCategories: boolean;
  generateTags: boolean;
  autoApply: boolean;
}

// 工具函数：格式化分析结果
const formatAnalysisResult = (
  mediaId: number,
  data: any
): AIAnalysisResult => ({
  id: mediaId,
  status: data.status,
  ai_title: data.ai_title,
  ai_description: data.ai_description,
  ai_prompt: data.ai_prompt,
  model_used: data.model_used,
  analysis_result: data.analysis_result,
  suggested_categories: data.suggested_categories || [],
  suggested_tags: data.suggested_tags || [],
  created_at: data.created_at,
  analyzed_at: data.analyzed_at,
});

// 工具函数：获取分析结果
const fetchAnalysisResult = async (
  mediaId: number
): Promise<AIAnalysisResult | null> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/ollama/analysis/${mediaId}/`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // 404是正常情况，表示该图片还没有分析结果
        console.log(`图片 ${mediaId} 尚未进行AI分析`);
      } else {
        console.warn(`获取分析结果失败，状态码: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    return formatAnalysisResult(mediaId, data);
  } catch (error) {
    console.error("获取分析结果失败:", error);
    return null;
  }
};

// 自定义Hook：管理分析状态
const useImageAnalysis = (mediaFile: MediaListItem) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>({
    generateTitle: true,
    generateDescription: true,
    generatePrompt: true,
    generateCategories: true,
    generateTags: true,
    autoApply: true,
  });

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
      try {
        // 重置分析结果，防止显示上一个图片的数据
        setAnalysisResult(null);
        setError(null);

        const [modelsResult, analysisData] = await Promise.allSettled([
          aiManagementService.getAvailableModels(),
          fetchAnalysisResult(mediaFile.id),
        ]);

        // 处理模型数据
        if (modelsResult.status === "fulfilled" && modelsResult.value?.models) {
          setModels(modelsResult.value.models);
          const visionModel = modelsResult.value.models.find(
            (m: OllamaModel) => m.is_vision_capable
          );
          if (visionModel) setSelectedModel(visionModel.name);
        }

        // 处理分析结果
        if (analysisData.status === "fulfilled" && analysisData.value) {
          setAnalysisResult(analysisData.value);
        }
        // 如果没有分析结果，analysisResult 保持为 null，这是正确的
      } catch (err) {
        console.error("初始化失败:", err);
        setError("获取数据失败");
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [mediaFile.id]);

  return {
    models,
    selectedModel,
    setSelectedModel,
    isAnalyzing,
    setIsAnalyzing,
    analysisResult,
    setAnalysisResult,
    loading,
    error,
    setError,
    analysisOptions,
    setAnalysisOptions,
  };
};

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

// 组件：图片信息面板
const ImageInfoPanel = ({
  mediaFile,
  description,
  prompt,
}: {
  mediaFile: MediaListItem;
  description?: string;
  prompt?: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Eye className="h-5 w-5" />
        图片信息
      </CardTitle>
      <CardDescription>当前选中图片的基本信息和预览</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0">
          <img
            src={mediaFile.file_url}
            alt={mediaFile.title}
            className="w-48 h-48 object-cover rounded-lg border shadow-sm"
          />
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">文件大小：</span>
              <span>
                {mediaFile.file_size
                  ? `${(mediaFile.file_size / 1024 / 1024).toFixed(2)} MB`
                  : "未知"}
              </span>
            </div>
            <div>
              <span className="font-medium">上传时间：</span>
              <span>
                {mediaFile.created_at
                  ? new Date(mediaFile.created_at).toLocaleString("zh-CN")
                  : "未知"}
              </span>
            </div>
            <div>
              <span className="font-medium">文件类型：</span>
              <span>{mediaFile.file_type}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <h3 className="font-semibold text-lg">{mediaFile.title}</h3>

          {/* 描述和提示词左右布局 */}
          {(description || prompt) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {description && (
                <div>
                  <h4 className="font-medium text-sm mb-2">描述</h4>
                  <div className="relative">
                    <button
                      onClick={() => {
                        copyToClipboard(description, "描述已复制到剪贴板");
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border shadow-sm transition-colors"
                      title="复制描述"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg break-words leading-relaxed max-h-32 overflow-y-auto pr-10">
                      {description}
                    </div>
                  </div>
                </div>
              )}

              {prompt && (
                <div>
                  <h4 className="font-medium text-sm mb-2">AI绘画提示词</h4>
                  <div className="relative">
                    <button
                      onClick={() => {
                        copyToClipboard(prompt, "AI绘画提示词已复制到剪贴板");
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border shadow-sm transition-colors"
                      title="复制AI绘画提示词"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <div className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-lg break-words leading-relaxed max-h-32 overflow-y-auto pr-10">
                      {prompt}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

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
    items: Array<{ name: string; confidence: number; id?: number | string }>;
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
                className="text-xs px-2 py-1 cursor-help hover:opacity-80 transition-opacity"
                title={`${item.name}: ${Math.round(item.confidence * 100)}%`}
              >
                {item.name}
                <span className="ml-1 text-xs opacity-70">
                  ({Math.round(item.confidence * 100)}%)
                </span>
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

// 组件：分析选项配置
const AnalysisOptions = ({
  analysisOptions,
  setAnalysisOptions,
  isAnalyzing,
}: {
  analysisOptions: AnalysisOptions;
  setAnalysisOptions: React.Dispatch<React.SetStateAction<AnalysisOptions>>;
  isAnalyzing: boolean;
}) => (
  <div className="space-y-4">
    <label className="text-sm font-medium">分析选项</label>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {[
        { key: "generateTitle", label: "生成标题" },
        { key: "generateDescription", label: "生成描述" },
        { key: "generatePrompt", label: "生成提示词" },
        { key: "generateCategories", label: "推荐分类" },
        { key: "generateTags", label: "推荐标签" },
      ].map(({ key, label }) => (
        <label key={key} className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={analysisOptions[key as keyof AnalysisOptions] as boolean}
            onChange={(e) =>
              setAnalysisOptions((prev) => ({
                ...prev,
                [key]: e.target.checked,
              }))
            }
            disabled={isAnalyzing}
          />
          <span className="text-sm">{label}</span>
        </label>
      ))}
    </div>

    <div className="border-t pt-4">
      <label className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <input
          type="checkbox"
          checked={analysisOptions.autoApply}
          onChange={(e) =>
            setAnalysisOptions((prev) => ({
              ...prev,
              autoApply: e.target.checked,
            }))
          }
          disabled={isAnalyzing}
          className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            自动应用分析结果
          </span>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            分析完成后自动将生成的标题、描述、分类和标签应用到媒体文件
          </p>
        </div>
      </label>
    </div>
  </div>
);

// 组件：分析结果展示
const AnalysisResult = ({ result }: { result: AIAnalysisResult | null }) => {
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("zh-CN");

  if (!result) {
    return (
      <div className="space-y-6">
        <Separator />
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">分析结果</h3>
          <Badge variant="outline">未分析</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左列：基本信息和内容 */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  分析信息
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground">等待分析...</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  生成的标题
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground italic">
                  暂无生成的标题
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 右列：分类和标签 */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  推荐分类
                  <Badge variant="secondary" className="text-xs">
                    0 个
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground italic">
                  暂无推荐分类
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  推荐标签
                  <Badge variant="secondary" className="text-xs">
                    0 个
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground italic">
                  暂无推荐标签
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Separator />
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">分析结果</h3>
        <Badge
          variant={result.status === "completed" ? "default" : "secondary"}
        >
          {result.status === "completed" ? "已完成" : "处理中"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左列：基本信息和内容 */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                分析信息
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">使用模型：</span>
                  <span className="text-muted-foreground ml-1">
                    {result.model_used || "未知"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">分析状态：</span>
                  <Badge variant="outline" className="ml-1">
                    {result.status === "completed" ? "已完成" : "处理中"}
                  </Badge>
                </div>
                {result.created_at && (
                  <div>
                    <span className="font-medium">创建时间：</span>
                    <span className="text-muted-foreground ml-1">
                      {formatDate(result.created_at)}
                    </span>
                  </div>
                )}
                {result.analyzed_at && (
                  <div>
                    <span className="font-medium">分析时间：</span>
                    <span className="text-muted-foreground ml-1">
                      {formatDate(result.analyzed_at)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右列：分类和标签 */}
        <div className="space-y-3">
          {result.suggested_categories?.length > 0 && (
            <CompactTagsDisplay
              title="推荐分类"
              icon={FolderOpen}
              items={result.suggested_categories}
              variant="secondary"
            />
          )}

          {result.suggested_tags?.length > 0 && (
            <CompactTagsDisplay
              title="推荐标签"
              icon={Tag}
              items={result.suggested_tags}
              variant="outline"
            />
          )}

          {result.analysis_result && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  原始分析数据
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <details className="cursor-pointer">
                  <summary className="text-sm text-muted-foreground hover:text-foreground">
                    点击查看原始数据
                  </summary>
                  <pre className="mt-3 text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(result.analysis_result, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export function ImageAnalysis({
  mediaFile,
  onAnalysisComplete,
  onMediaUpdate,
}: ImageAnalysisProps) {
  const {
    models,
    selectedModel,
    setSelectedModel,
    isAnalyzing,
    setIsAnalyzing,
    analysisResult,
    setAnalysisResult,
    loading,
    error,
    setError,
    analysisOptions,
    setAnalysisOptions,
  } = useImageAnalysis(mediaFile);

  // 应用分析建议
  const applySuggestions = async () => {
    if (!analysisResult) return;

    try {
      const categoryIds =
        analysisResult.suggested_categories?.map((cat) => cat.id) || [];
      const tagIds = analysisResult.suggested_tags?.map((tag) => tag.id) || [];

      await aiManagementService.applyAnalysisSuggestions(mediaFile.id, {
        applyTitle: true,
        applyDescription: true,
        applyPrompt: true,
        applyCategories: categoryIds.length > 0,
        applyTags: tagIds.length > 0,
        categoryIds,
        tagIds,
      });

      onMediaUpdate?.();
      toast.success("建议已应用到媒体文件");
    } catch (err: any) {
      console.error("应用建议失败:", err);
      toast.error(err.message || "应用建议失败");
    }
  };

  // 执行分析
  const performAnalysis = async () => {
    if (!selectedModel) {
      toast.error("请选择一个AI模型");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await aiManagementService.generateCombined(mediaFile.id, {
        ...analysisOptions,
        modelName: selectedModel,
      });

      if (result) {
        // 延迟获取完整结果
        setTimeout(async () => {
          const fullResult = await fetchAnalysisResult(mediaFile.id);
          if (fullResult) {
            setAnalysisResult(fullResult);
          } else {
            // 使用原始结果
            setAnalysisResult(
              formatAnalysisResult(mediaFile.id, {
                status: "completed",
                ai_title: result.title,
                ai_description: result.description,
                ai_prompt: result.prompt,
                model_used: result.model_used,
                analysis_result: result,
                suggested_categories: result.categories || [],
                suggested_tags: result.tags || [],
                created_at: new Date().toISOString(),
                analyzed_at: new Date().toISOString(),
              })
            );
          }

          if (analysisOptions.autoApply) {
            toast.success("正在自动应用分析结果...");
            await applySuggestions();
            toast.success("图片分析完成，已自动应用结果！");
          } else {
            toast.success("图片分析完成！");
          }

          onAnalysisComplete?.(analysisResult!);
          onMediaUpdate?.();
        }, 1000);
      }
    } catch (err: any) {
      console.error("分析失败:", err);
      setError(err.message || "分析失败");
      toast.error(err.message || "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (mediaFile.file_type !== "image") {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>只有图片文件支持AI分析功能</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI 图片分析
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

  return (
    <div className="space-y-6">
      <ImageInfoPanel
        mediaFile={mediaFile}
        description={analysisResult?.ai_description}
        prompt={analysisResult?.ai_prompt}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI 分析控制
          </CardTitle>
          <CardDescription>配置AI分析选项并开始分析</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 模型选择 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">选择AI模型</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={isAnalyzing}
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

          <AnalysisOptions
            analysisOptions={analysisOptions}
            setAnalysisOptions={setAnalysisOptions}
            isAnalyzing={isAnalyzing}
          />

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              onClick={performAnalysis}
              disabled={isAnalyzing || !selectedModel}
              className="flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>

            {analysisResult && !analysisOptions.autoApply && (
              <Button
                variant="outline"
                onClick={applySuggestions}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                应用建议
              </Button>
            )}

            {analysisResult && analysisOptions.autoApply && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                已自动应用
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AnalysisResult result={analysisResult} />
        </CardContent>
      </Card>
    </div>
  );
}
