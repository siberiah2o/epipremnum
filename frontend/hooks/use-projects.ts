/**
 * 项目数据获取 Hook
 */
import { useState, useEffect, useCallback } from 'react';
import { projectApi } from '@/lib/api-client';
import type { Project, ProjectMedia, CreateProjectRequest, UpdateProjectRequest } from '@/lib/types';

export interface UseProjectsOptions {
  /** 是否自动加载 */
  autoLoad?: boolean;
  /** 搜索关键词 */
  search?: string;
  /** 每页数量 */
  pageSize?: number;
}

export interface UseProjectsReturn {
  /** 项目列表 */
  projects: Project[];
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 创建项目 */
  createProject: (data: CreateProjectRequest) => Promise<Project | null>;
  /** 更新项目 */
  updateProject: (id: number, data: UpdateProjectRequest) => Promise<boolean>;
  /** 删除项目 */
  deleteProject: (id: number) => Promise<boolean>;
}

export function useProjects(options: UseProjectsOptions = {}): UseProjectsReturn {
  const { autoLoad = true, search = '', pageSize = 20 } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await projectApi.getProjects({
        search: search || undefined,
        page_size: pageSize,
      });

      if (response.code === 200 && response.data) {
        const projectsData = Array.isArray(response.data) ? response.data : [];
        setProjects(projectsData);
      } else {
        setError(response.message || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [search, pageSize]);

  const createProject = useCallback(async (data: CreateProjectRequest): Promise<Project | null> => {
    try {
      const response = await projectApi.createProject(data);
      if ((response.code === 201 || response.code === 200) && response.data) {
        const newProject = response.data;
        setProjects((prev) => [...prev, newProject]);
        return newProject;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const updateProject = useCallback(async (id: number, data: UpdateProjectRequest): Promise<boolean> => {
    try {
      const response = await projectApi.updateProject(id, data);
      if (response.code === 200 && response.data) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? response.data! : p))
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const deleteProject = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await projectApi.deleteProject(id);
      if (response.code === 200 || response.code === 204) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  return {
    projects,
    loading,
    error,
    refresh: loadData,
    createProject,
    updateProject,
    deleteProject,
  };
}

/**
 * 项目详情 Hook
 */
export interface UseProjectDetailReturn {
  /** 项目详情 */
  project: Project | null;
  /** 项目媒体列表 */
  projectMedia: ProjectMedia[];
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 添加媒体 */
  addMedia: (mediaIds: number[]) => Promise<boolean>;
  /** 移除媒体 */
  removeMedia: (mediaId: number) => Promise<boolean>;
}

export function useProjectDetail(projectId: number | null): UseProjectDetailReturn {
  const [project, setProject] = useState<Project | null>(null);
  const [projectMedia, setProjectMedia] = useState<ProjectMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setProjectMedia([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectRes, mediaRes] = await Promise.all([
        projectApi.getProject(projectId),
        projectApi.getProjectMedia(projectId),
      ]);

      if (projectRes.code === 200) {
        setProject(projectRes.data);
      } else {
        setError(projectRes.message || '加载项目失败');
      }

      if (mediaRes.code === 200 && Array.isArray(mediaRes.data)) {
        setProjectMedia(mediaRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const addMedia = useCallback(async (mediaIds: number[]): Promise<boolean> => {
    if (!projectId) return false;

    try {
      const response = await projectApi.addMedia(projectId, { media_ids: mediaIds });
      if (response.code === 200) {
        await loadData(); // 刷新数据
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [projectId, loadData]);

  const removeMedia = useCallback(async (mediaId: number): Promise<boolean> => {
    if (!projectId) return false;

    try {
      const response = await projectApi.removeMedia(projectId, { media_id: mediaId });
      if (response.code === 200) {
        setProjectMedia((prev) => prev.filter((pm) => pm.media !== mediaId));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [projectId]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    project,
    projectMedia,
    loading,
    error,
    refresh: loadData,
    addMedia,
    removeMedia,
  };
}
