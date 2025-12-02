"use client";

import { useState, useEffect, useMemo } from "react";
import { useAIModels } from "../hooks/use-ai-models";
import { getSortedVisionModels } from "@/lib/model-utils";
import { ImageSelector } from "./components/image-selector";
import { AnalysisResults } from "./components/analysis-results";
import { useMediaFiles } from "./hooks/use-media-files";
import { useKeyboardNavigation } from "./hooks/use-keyboard-navigation";
import { ConcurrencyStatus } from "@/components/new_ui/concurrency-status";
import { GlobalAnalysisStatus } from "./components/global-analysis-status";
import type { MediaFile } from "./types/analysis";

interface AIAnalysisManagementProps {
  initialPageSize?: number;
}

export function AIAnalysisManagement({
  initialPageSize = 24,
}: AIAnalysisManagementProps) {
  // 媒体文件相关
  const {
    mediaFiles,
    imageFiles,
    loading,
    pagination,
    handlePageSizeChange,
    handlePrevPage,
    handleNextPage,
    handlePageClick,
    fetchMediaFiles,
    fetchMediaFileDetails,
  } = useMediaFiles(initialPageSize);

  // 选中的文件
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);

  // AI 模型相关
  const { models, loading: modelsLoading } = useAIModels();

  // 使用工具函数获取排序后的视觉模型
  const visionModels = useMemo(
    () => getSortedVisionModels(models),
    [models]
  );

  // 自动选择默认模型，如果没有默认模型则选择第一个视觉模型
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);

  useEffect(() => {
    if (visionModels.length > 0 && !selectedModel) {
      // 优先选择默认模型，如果没有默认模型则选择第一个视觉模型
      const defaultModel = visionModels.find((model) => model.is_default);
      const modelToSelect = defaultModel || visionModels[0];
      setSelectedModel(modelToSelect.name);
    }
  }, [visionModels, selectedModel]);

  // 键盘导航
  const keyboardNav = useKeyboardNavigation(
    imageFiles,
    selectedFile,
    setSelectedFile,
    selectedModel,
    fetchMediaFileDetails
  );

  // 当媒体文件加载完成且没有选中图片时，默认选择第一张图片
  useEffect(() => {
    if (!loading && imageFiles.length > 0 && !selectedFile) {
      const firstImage = imageFiles[0];
      setSelectedFile(firstImage);
      // 自动加载第一张图片的详细信息
      fetchMediaFileDetails(firstImage.id)
        .then((updatedFile) => {
          if (updatedFile) {
            setSelectedFile(updatedFile);
          }
        })
        .catch((err) => {
          console.error("加载第一张图片详情失败:", err);
        });
    }
  }, [loading, imageFiles, selectedFile, fetchMediaFileDetails]);

  // 处理文件选择
  const handleFileSelect = async (file: MediaFile, index: number) => {
    keyboardNav.setFocusedIndex(index);
    keyboardNav.setKeyboardNavEnabled(true);

    // 设置加载状态
    setIsLoadingDetails(true);
    setLoadingFileId(file.id);

    try {
      console.log(`🔍 [UI] 开始选择图片: ${file.id} - ${file.title}`);
      const updatedFile = await fetchMediaFileDetails(file.id);
      if (updatedFile) {
        console.log(`🔍 [UI] 图片详情加载完成，设置选中状态`);
        setSelectedFile(updatedFile);
      } else {
        // 如果没有获取到详细信息，使用原始文件数据
        console.log(`🔍 [UI] 未获取到详细信息，使用原始数据`);
        setSelectedFile(file);
      }
    } catch (error) {
      console.error("加载图片详情失败:", error);
      // 出错时使用原始文件数据
      setSelectedFile(file);
    } finally {
      setIsLoadingDetails(false);
      setLoadingFileId(null);
    }
  };

  // 处理媒体更新
  const handleMediaUpdate = async () => {
    try {
      // 给后端一些时间来保存AI分析结果
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 减少到2秒，因为我们已经在前端加了延迟

      // 如果有选中的文件，直接获取其最新详细信息
      if (selectedFile) {
        console.log(`🔍 [UPDATE] 开始更新选中文件: fileId=${selectedFile.id}`);
        const updatedFile = await fetchMediaFileDetails(selectedFile.id);
        if (updatedFile) {
          console.log(`🔍 [UPDATE] 获取到更新后的文件数据:`, {
            title: updatedFile.title,
            hasAiDescription: !!updatedFile.ai_description,
            hasAiPrompt: !!updatedFile.ai_prompt,
            aiCategoriesCount: updatedFile.ai_categories?.length || 0,
            aiTagsCount: updatedFile.ai_tags?.length || 0,
            aiAnalyzedAt: updatedFile.ai_analyzed_at,
          });
          setSelectedFile(updatedFile);
        } else {
          console.log(`🔍 [UPDATE] 获取更新文件失败，返回null`);
        }
      }

      // 同时刷新媒体列表
      console.log(`🔍 [UPDATE] 开始刷新媒体列表`);
      await fetchMediaFiles();
      console.log(`🔍 [UPDATE] 媒体列表刷新完成`);
    } catch (error) {
      console.error("媒体更新失败:", error);
      // 即使失败，也尝试基本的刷新
      console.log(`🔍 [UPDATE] 降级到基本刷新`);
      await fetchMediaFiles();
    }
  };

  // 监听选中文件需要更新的事件
  useEffect(() => {
    const handleSelectedFileUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { fileId } = customEvent.detail;

      // 如果当前选中的文件ID匹配，则重新获取详细信息
      if (selectedFile && selectedFile.id === fileId) {
        console.log("更新选中文件的AI分析数据...");
        try {
          const updatedFile = await fetchMediaFileDetails(fileId);
          if (updatedFile) {
            setSelectedFile(updatedFile);
          }
        } catch (error) {
          console.error("更新选中文件失败:", error);
        }
      }
    };

    // 添加事件监听器
    window.addEventListener(
      "selected-file-need-update",
      handleSelectedFileUpdate
    );

    return () => {
      window.removeEventListener(
        "selected-file-need-update",
        handleSelectedFileUpdate
      );
    };
  }, [selectedFile, fetchMediaFileDetails]);

  // 处理页面大小变化
  const handlePageSizeChangeWithReset = (newPageSize: string) => {
    handlePageSizeChange(newPageSize);
    keyboardNav.setFocusedIndex(null);
    keyboardNav.setKeyboardNavEnabled(false);
  };

  // 处理翻页
  const handlePrevPageWithReset = () => {
    handlePrevPage();
    keyboardNav.setFocusedIndex(null);
  };

  const handleNextPageWithReset = () => {
    handleNextPage();
    keyboardNav.setFocusedIndex(null);
  };

  const handlePageClickWithReset = (page: number) => {
    handlePageClick(page);
    keyboardNav.setFocusedIndex(null);
  };

  return (
    <>
      {/* 用于追踪当前选中文件ID的隐藏元素 */}
      {selectedFile && (
        <div
          data-selected-file-id={selectedFile.id}
          style={{ display: "none" }}
        />
      )}

      <div className="flex flex-1 gap-4 lg:gap-6 h-full min-h-0">
        {/* 左侧素材列 */}
        <div className="w-full lg:w-1/4 xl:w-1/3 flex flex-col min-h-0">
          <ImageSelector
            imageFiles={imageFiles}
            selectedFile={selectedFile}
            loading={loading}
            pagination={pagination}
            keyboardNav={keyboardNav}
            onFileSelect={handleFileSelect}
            onPageSizeChange={handlePageSizeChangeWithReset}
            onPrevPage={handlePrevPageWithReset}
            onNextPage={handleNextPageWithReset}
            onPageClick={handlePageClickWithReset}
            setKeyboardNavEnabled={keyboardNav.setKeyboardNavEnabled}
            isLoadingDetails={isLoadingDetails}
            loadingFileId={loadingFileId}
          />
        </div>

        {/* 右侧分析结果 */}
        <div className="flex-1 min-h-0">
          <AnalysisResults
            selectedFile={selectedFile}
            onMediaUpdate={handleMediaUpdate}
          />
        </div>
      </div>

      {/* 并发状态指示器 */}
      <ConcurrencyStatus />

      {/* 全局AI分析状态 */}
      <GlobalAnalysisStatus />
    </>
  );
}
