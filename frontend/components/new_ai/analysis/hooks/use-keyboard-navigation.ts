"use client";

import { useEffect, useState } from "react";
import type { MediaFile, KeyboardNavigationState } from "../types/analysis";

export function useKeyboardNavigation(
  imageFiles: MediaFile[],
  selectedFile: MediaFile | null,
  setSelectedFile: (file: MediaFile | null) => void,
  selectedModel: string,
  fetchMediaFileDetails?: (
    fileId: number
  ) => Promise<MediaFile | null | undefined>
) {
  const [keyboardNavState, setKeyboardNavState] =
    useState<KeyboardNavigationState>({
      focusedIndex: null,
      isKeyboardNavEnabled: false,
    });

  // 获取网格列数
  const getGridColumnCount = () => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      // 根据页面中定义的响应式列数
      if (width >= 1280) return 12; // xl
      if (width >= 1024) return 10; // lg
      if (width >= 768) return 8; // md
      if (width >= 640) return 6; // sm
      return 6; // 默认
    }
    return 8; // 默认值
  };

  // 键盘导航逻辑
  useEffect(() => {
    if (!imageFiles.length) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 只在没有焦点在输入框时响应键盘导航
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const currentIndex = keyboardNavState.focusedIndex ?? -1;

      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
        case "ArrowRight":
        case "ArrowLeft":
          // 如果没有焦点，从第一张图片开始
          if (currentIndex === -1 && imageFiles.length > 0) {
            const firstFile = imageFiles[0];
            setKeyboardNavState({
              focusedIndex: 0,
              isKeyboardNavEnabled: true,
            });
            setSelectedFile(firstFile);
            // 自动加载图片详细信息
            if (fetchMediaFileDetails) {
              fetchMediaFileDetails(firstFile.id)
                .then((updatedFile) => {
                  if (updatedFile) {
                    setSelectedFile(updatedFile);
                  }
                })
                .catch((err) => {
                  console.error("加载图片详情失败:", err);
                });
            }
            break;
          }
          // 如果没有图片文件，直接返回
          if (imageFiles.length === 0) break;

          // 正常的导航逻辑
          if (event.key === "ArrowDown") {
            event.preventDefault();
            // 向下移动一行
            const cols = getGridColumnCount();
            const newIndexDown = Math.min(
              currentIndex + cols,
              imageFiles.length - 1
            );
            const newFileDown = imageFiles[newIndexDown];
            setKeyboardNavState({
              focusedIndex: newIndexDown,
              isKeyboardNavEnabled: true,
            });
            setSelectedFile(newFileDown);
            // 自动加载图片详细信息
            if (fetchMediaFileDetails) {
              fetchMediaFileDetails(newFileDown.id)
                .then((updatedFile) => {
                  if (updatedFile) {
                    setSelectedFile(updatedFile);
                  }
                })
                .catch((err) => {
                  console.error("加载图片详情失败:", err);
                });
            }
            break;
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            // 向上移动一行
            const colsUp = getGridColumnCount();
            const newIndexUp = Math.max(currentIndex - colsUp, 0);
            const newFileUp = imageFiles[newIndexUp];
            setKeyboardNavState({
              focusedIndex: newIndexUp,
              isKeyboardNavEnabled: true,
            });
            setSelectedFile(newFileUp);
            // 自动加载图片详细信息
            if (fetchMediaFileDetails) {
              fetchMediaFileDetails(newFileUp.id)
                .then((updatedFile) => {
                  if (updatedFile) {
                    setSelectedFile(updatedFile);
                  }
                })
                .catch((err) => {
                  console.error("加载图片详情失败:", err);
                });
            }
            break;
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            // 向右移动
            const newIndexRight = Math.min(
              currentIndex + 1,
              imageFiles.length - 1
            );
            const newFileRight = imageFiles[newIndexRight];
            setKeyboardNavState({
              focusedIndex: newIndexRight,
              isKeyboardNavEnabled: true,
            });
            setSelectedFile(newFileRight);
            // 自动加载图片详细信息
            if (fetchMediaFileDetails) {
              fetchMediaFileDetails(newFileRight.id)
                .then((updatedFile) => {
                  if (updatedFile) {
                    setSelectedFile(updatedFile);
                  }
                })
                .catch((err) => {
                  console.error("加载图片详情失败:", err);
                });
            }
            break;
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            // 向左移动
            const newIndexLeft = Math.max(currentIndex - 1, 0);
            const newFileLeft = imageFiles[newIndexLeft];
            setKeyboardNavState({
              focusedIndex: newIndexLeft,
              isKeyboardNavEnabled: true,
            });
            setSelectedFile(newFileLeft);
            // 自动加载图片详细信息
            if (fetchMediaFileDetails) {
              fetchMediaFileDetails(newFileLeft.id)
                .then((updatedFile) => {
                  if (updatedFile) {
                    setSelectedFile(updatedFile);
                  }
                })
                .catch((err) => {
                  console.error("加载图片详情失败:", err);
                });
            }
            break;
          }

        case "Enter":
        case " ":
          event.preventDefault();
          // Enter/空格键现在用于触发AI分析
          if (currentIndex >= 0 && currentIndex < imageFiles.length) {
            const file = imageFiles[currentIndex];
            if (file.file_type === "image") {
              setSelectedFile(file);
              setKeyboardNavState({
                focusedIndex: currentIndex,
                isKeyboardNavEnabled: true,
              });
              // 自动加载图片详细信息
              if (fetchMediaFileDetails) {
                fetchMediaFileDetails(file.id)
                  .then((updatedFile) => {
                    if (updatedFile) {
                      setSelectedFile(updatedFile);
                    }
                  })
                  .catch((err) => {
                    console.error("加载图片详情失败:", err);
                  });
              }
              // 这里可以添加自动触发分析的逻辑
              // 如果需要的话，可以在这里调用 performAnalysis 函数
            }
          }
          break;

        case "a":
          event.preventDefault();
          // A键现在只用于重新确认当前选择
          if (currentIndex >= 0 && currentIndex < imageFiles.length) {
            const file = imageFiles[currentIndex];
            if (file.file_type === "image") {
              setSelectedFile(file);
              setKeyboardNavState({
                focusedIndex: currentIndex,
                isKeyboardNavEnabled: true,
              });
              // 自动加载图片详细信息
              if (fetchMediaFileDetails) {
                fetchMediaFileDetails(file.id)
                  .then((updatedFile) => {
                    if (updatedFile) {
                      setSelectedFile(updatedFile);
                    }
                  })
                  .catch((err) => {
                    console.error("加载图片详情失败:", err);
                  });
              }
            }
          }
          break;

        case "Escape":
          event.preventDefault();
          setSelectedFile(null);
          setKeyboardNavState({
            focusedIndex: null,
            isKeyboardNavEnabled: false,
          });
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [imageFiles, keyboardNavState.focusedIndex, selectedFile, selectedModel]);

  // 手动设置键盘导航状态的方法
  const setFocusedIndex = (index: number | null) => {
    setKeyboardNavState((prev) => ({
      ...prev,
      focusedIndex: index,
    }));
  };

  const setKeyboardNavEnabled = (enabled: boolean) => {
    setKeyboardNavState((prev) => ({
      ...prev,
      isKeyboardNavEnabled: enabled,
    }));
  };

  return {
    ...keyboardNavState,
    setFocusedIndex,
    setKeyboardNavEnabled,
  };
}
