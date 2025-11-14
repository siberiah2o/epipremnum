'use client'

import { useState, useEffect } from 'react'
import {
  apiClient,
  MediaCategory,
  MediaTag,
  MediaFile,
  MediaListItem,
  PaginatedMediaList,
  CreateCategoryData,
  UpdateCategoryData,
  CreateTagData,
  UpdateTagData,
  UploadMediaData,
  UpdateMediaData,
  AddCategoriesData,
  RemoveCategoriesData,
  AddTagsData,
  RemoveTagsData
} from '@/lib/api'

// ============ 分类管理 Hooks ============

export function useCategories() {
  const [categories, setCategories] = useState<MediaCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getCategories()
      if (response.code === 200) {
        setCategories(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取分类列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  const createCategory = async (data: CreateCategoryData) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.createCategory(data)
      if (response.code === 200 || response.code === 201) {
        setCategories(prev => [...prev, response.data])
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建分类失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const updateCategory = async (id: number, data: UpdateCategoryData) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.updateCategory(id, data)
      if (response.code === 200) {
        setCategories(prev =>
          prev.map(cat => cat.id === id ? response.data : cat)
        )
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新分类失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCategory = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.deleteCategory(id)
      if (response.code === 200) {
        setCategories(prev => prev.filter(cat => cat.id !== id))
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除分类失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  }
}

export function useCategory(id: number) {
  const [category, setCategory] = useState<MediaCategory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCategory = async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getCategory(id)
      if (response.code === 200) {
        setCategory(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取分类详情失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCategory()
  }, [id])

  return {
    category,
    isLoading,
    error,
    refetch: fetchCategory
  }
}

// ============ 标签管理 Hooks ============

export function useTags() {
  const [tags, setTags] = useState<MediaTag[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTags = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getTags()
      if (response.code === 200) {
        setTags(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取标签列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  const createTag = async (data: CreateTagData) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.createTag(data)
      if (response.code === 200 || response.code === 201) {
        setTags(prev => [...prev, response.data])
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建标签失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const updateTag = async (id: number, data: UpdateTagData) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.updateTag(id, data)
      if (response.code === 200) {
        setTags(prev =>
          prev.map(tag => tag.id === id ? response.data : tag)
        )
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新标签失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTag = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.deleteTag(id)
      if (response.code === 200) {
        setTags(prev => prev.filter(tag => tag.id !== id))
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除标签失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  return {
    tags,
    isLoading,
    error,
    refetch: fetchTags,
    createTag,
    updateTag,
    deleteTag
  }
}

export function useTag(id: number) {
  const [tag, setTag] = useState<MediaTag | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTag = async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getTag(id)
      if (response.code === 200) {
        setTag(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取标签详情失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTag()
  }, [id])

  return {
    tag,
    isLoading,
    error,
    refetch: fetchTag
  }
}

// ============ 媒体文件管理 Hooks ============

export function useMediaList(
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  categoryId?: number,
  tagId?: number,
  fileType?: string
) {
  const [mediaList, setMediaList] = useState<PaginatedMediaList | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMediaList = async (
    pageNum: number = page,
    pageSizeNum: number = pageSize,
    searchQuery?: string,
    filterCategoryId?: number,
    filterTagId?: number,
    filterFileType?: string
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getMediaList(
        pageNum,
        pageSizeNum,
        searchQuery,
        filterCategoryId,
        filterTagId,
        filterFileType
      )
      if (response.code === 200) {
        setMediaList(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取媒体文件列表失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMediaList(page, pageSize, search, categoryId, tagId, fileType)
  }, [page, pageSize, search, categoryId, tagId, fileType])

  return {
    mediaList,
    isLoading,
    error,
    refetch: fetchMediaList
  }
}

export function useMedia(id: number) {
  const [media, setMedia] = useState<MediaFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMedia = async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getMedia(id)
      if (response.code === 200) {
        setMedia(response.data)
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取媒体文件详情失败')
    } finally {
      setIsLoading(false)
    }
  }

  const updateMedia = async (data: UpdateMediaData) => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.updateMedia(id, data)
      if (response.code === 200) {
        setMedia(response.data)
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新媒体文件失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const deleteMedia = async () => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.deleteMedia(id)
      if (response.code === 200) {
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除媒体文件失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const addCategories = async (data: AddCategoriesData) => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.addCategoriesToMedia(id, data)
      if (response.code === 200) {
        // 重新获取媒体信息以更新分类和标签
        await fetchMedia()
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加分类失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const removeCategories = async (data: RemoveCategoriesData) => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.removeCategoriesFromMedia(id, data)
      if (response.code === 200) {
        // 重新获取媒体信息以更新分类和标签
        await fetchMedia()
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '移除分类失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const addTags = async (data: AddTagsData) => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.addTagsToMedia(id, data)
      if (response.code === 200) {
        // 重新获取媒体信息以更新分类和标签
        await fetchMedia()
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加标签失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  const removeTags = async (data: RemoveTagsData) => {
    if (!id) return { success: false, message: '媒体文件ID不存在' }

    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.removeTagsFromMedia(id, data)
      if (response.code === 200) {
        // 重新获取媒体信息以更新分类和标签
        await fetchMedia()
        return { success: true }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '移除标签失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMedia()
  }, [id])

  return {
    media,
    isLoading,
    error,
    refetch: fetchMedia,
    updateMedia,
    deleteMedia,
    addCategories,
    removeCategories,
    addTags,
    removeTags
  }
}

export function useMediaUpload() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const uploadMedia = async (data: UploadMediaData) => {
    setIsLoading(true)
    setError(null)
    setProgress(0)

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await apiClient.uploadMedia(data)

      clearInterval(progressInterval)
      setProgress(100)

      if (response.code === 200 || response.code === 201) {
        return { success: true, data: response.data }
      } else {
        setError(response.message)
        return { success: false, message: response.message }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传媒体文件失败'
      setError(message)
      return { success: false, message }
    } finally {
      setIsLoading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  return {
    uploadMedia,
    isLoading,
    error,
    progress
  }
}