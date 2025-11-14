import { useState, useEffect, useCallback } from 'react'
import { MediaCategory, MediaTag, apiClient } from '@/lib/api'

export function useCategoriesAndTags() {
  const [categories, setCategories] = useState<MediaCategory[]>([])
  const [tags, setTags] = useState<MediaTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getTags()
      ])
      setCategories(categoriesRes.data)
      setTags(tagsRes.data)
    } catch (err) {
      console.error('加载分类和标签失败:', err)
      setError(err instanceof Error ? err.message : '加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refreshCategories = useCallback(async () => {
    try {
      const res = await apiClient.getCategories()
      setCategories(res.data)
    } catch (err) {
      console.error('刷新分类失败:', err)
    }
  }, [])

  const refreshTags = useCallback(async () => {
    try {
      const res = await apiClient.getTags()
      setTags(res.data)
    } catch (err) {
      console.error('刷新标签失败:', err)
    }
  }, [])

  return {
    categories,
    tags,
    isLoading,
    error,
    refreshCategories,
    refreshTags,
    refetch: fetchData
  }
}