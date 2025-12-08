"use client";

import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api";
import type { MediaFile, PaginationState } from "../types/analysis";

export function useMediaFiles(initialPageSize = 24) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalFiles: 0,
    pageSize: initialPageSize,
  });

  // 优化图片文件过滤
  const imageFiles = useMemo(
    () =>
      mediaFiles.filter(
        (file) =>
          file.file_type === "image" && (file.thumbnail_url || file.file_url)
      ),
    [mediaFiles]
  );

  // 获取媒体文件列表
  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMediaList(
        pagination.currentPage,
        pagination.pageSize
      );
      if (response.data) {
        setMediaFiles(response.data.results || []);
        const totalPagesValue =
          response.data.total_pages ||
          Math.ceil(response.data.count / pagination.pageSize);
        setPagination((prev) => ({
          ...prev,
          totalPages: totalPagesValue,
          totalFiles: response.data.count || 0,
        }));
      }
    } catch (err) {
      console.error("获取媒体文件失败:", err);
    } finally {
      setLoading(false);
    }
  };

  // 获取单个媒体文件的详细信息
  const fetchMediaFileDetails = async (fileId: number) => {
    try {
      console.log(`🔍 [MEDIA] 开始获取媒体文件详情: fileId=${fileId}`);

      // 首先尝试获取AI分析记录，因为这是最新的数据源
      let aiAnalysisData = null;
      try {
        // 直接获取该媒体文件的分析记录
        const analysisListResponse = await apiClient.getAnalysisList(1, 100);

        if (analysisListResponse.data?.data?.length > 0) {
          // 找到该媒体文件的分析记录
          const mediaAnalysisRecords = analysisListResponse.data.data.filter(
            (record: any) => record.media === fileId
          );

          if (mediaAnalysisRecords.length > 0) {
            // 获取最新的分析记录详情
            const latestAnalysis = mediaAnalysisRecords[0];
            console.log(
              `🔍 [MEDIA] 找到分析记录: analysisId=${latestAnalysis.id}, status=${latestAnalysis.status}`
            );

            const analysisDetailResponse = await apiClient.getAnalysisDetails(
              latestAnalysis.id
            );

            if (analysisDetailResponse.data?.data) {
              aiAnalysisData = analysisDetailResponse.data.data;
              console.log(`🔍 [MEDIA] 获取到AI分析详情:`, {
                hasTitle: !!aiAnalysisData.title,
                hasDescription: !!aiAnalysisData.description,
                hasPrompt: !!aiAnalysisData.prompt,
                hasCategories: !!(
                  aiAnalysisData.suggested_categories_data &&
                  aiAnalysisData.suggested_categories_data.length > 0
                ),
                hasTags: !!(
                  aiAnalysisData.suggested_tags_data &&
                  aiAnalysisData.suggested_tags_data.length > 0
                ),
                appliedToMedia: aiAnalysisData.applied_to_media,
              });
            }
          } else {
            console.log(`🔍 [MEDIA] 未找到媒体文件 ${fileId} 的分析记录`);
          }
        }
      } catch (analysisError) {
        console.log(
          "获取AI分析数据失败，使用媒体文件中已保存的数据:",
          analysisError
        );
        // AI分析数据获取失败时，继续使用媒体文件的基本信息
      }

      // 获取媒体文件基本信息
      const mediaResponse = await apiClient.getMedia(fileId);

      if (!mediaResponse.data) {
        throw new Error("无法获取媒体文件信息");
      }

      const mediaData = mediaResponse.data;
      console.log(`🔍 [MEDIA] 获取到媒体基本信息:`, {
        id: mediaData.id,
        title: mediaData.title,
        hasDescription: !!mediaData.description,
        hasPrompt: !!mediaData.prompt,
        hasCategories: !!(
          mediaData.categories && mediaData.categories.length > 0
        ),
        hasTags: !!(mediaData.tags && mediaData.tags.length > 0),
      });

      if (!mediaData) {
        throw new Error("无法获取媒体文件信息");
      }

      // 构建最终的媒体文件数据
      // 优先使用AI分析记录中的数据，因为这是最新的
      const updatedFile: MediaFile = {
        id: mediaData.id,
        title:
          aiAnalysisData?.title ||
          mediaData.title ||
          mediaData.file_url?.split("/").pop() ||
          "未命名",
        description: mediaData.description || null,
        file_type: mediaData.file_type,
        file_size: mediaData.file_size,
        file_url: mediaData.file_url,
        thumbnail_url: mediaData.thumbnail_url,
        created_at: mediaData.created_at,
        // AI相关字段 - 优先使用AI分析记录中的数据
        ai_description:
          aiAnalysisData?.description || mediaData.description || null,
        ai_categories:
          aiAnalysisData?.suggested_categories_data?.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
          })) ||
          (mediaData.categories &&
            mediaData.categories.map((cat: any) => ({
              id: cat.id,
              name: cat.name,
            }))) ||
          [],
        ai_tags:
          aiAnalysisData?.suggested_tags_data?.map((tag: any) => ({
            id: tag.id,
            name: tag.name,
          })) ||
          (mediaData.tags &&
            mediaData.tags.map((tag: any) => ({
              id: tag.id,
              name: tag.name,
            }))) ||
          [],
        ai_analyzed_at: aiAnalysisData?.analyzed_at || null,
      };

      console.log(`🔍 [MEDIA] 构建最终数据:`, {
        id: updatedFile.id,
        title: updatedFile.title,
        hasAiDescription: !!updatedFile.ai_description,
        aiCategoriesCount: updatedFile.ai_categories?.length || 0,
        aiTagsCount: updatedFile.ai_tags?.length || 0,
        aiAnalyzedAt: updatedFile.ai_analyzed_at,
      });

      // 更新媒体文件列表中的对应文件
      setMediaFiles((prevFiles) =>
        prevFiles.map((file) => (file.id === fileId ? updatedFile : file))
      );

      return updatedFile;
    } catch (err) {
      console.error("获取媒体文件详情失败:", err);
      return null;
    }
  };

  // 处理页面大小变化
  const handlePageSizeChange = (newPageSize: string) => {
    const pageSize = parseInt(newPageSize);
    setPagination((prev) => ({
      ...prev,
      pageSize,
      currentPage: 1, // 重置到第一页
    }));
  };

  // 翻页控制
  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination((prev) => ({
        ...prev,
        currentPage: prev.currentPage - 1,
      }));
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination((prev) => ({
        ...prev,
        currentPage: prev.currentPage + 1,
      }));
    }
  };

  const handlePageClick = (page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: page,
    }));
  };

  // 监听媒体更新事件（用于批量分析完成后同步数据）
  useEffect(() => {
    const handleMediaUpdateEvent = async () => {
      console.log("收到媒体更新事件，正在刷新数据...");
      await fetchMediaFiles();

      // 如果有选中的文件，重新获取其最新详细信息（包括AI分析数据）
      const selectedFileElement = document.querySelector(
        "[data-selected-file-id]"
      );
      if (selectedFileElement) {
        const selectedFileId = parseInt(
          selectedFileElement.getAttribute("data-selected-file-id") || "0"
        );
        if (selectedFileId > 0) {
          console.log("重新获取选中文件的AI分析数据...");
          // 这里我们通过事件触发，让组件自己处理选中文件的更新
          window.dispatchEvent(
            new CustomEvent("selected-file-need-update", {
              detail: { fileId: selectedFileId },
            })
          );
        }
      }
    };

    // 监听自定义媒体更新事件
    window.addEventListener("media-updated", handleMediaUpdateEvent);

    // 监听storage变化（跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "media-analysis-completed") {
        console.log("检测到其他标签页的分析完成，正在刷新数据...");
        handleMediaUpdateEvent();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("media-updated", handleMediaUpdateEvent);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [pagination.currentPage, pagination.pageSize]);

  // 初始化和页面变化时获取数据
  useEffect(() => {
    fetchMediaFiles();
  }, [pagination.currentPage, pagination.pageSize]);

  return {
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
  };
}
