import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============ 媒体相关工具函数 ============

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  if (i === 2) {
    if (size < 0.01) return '< 0.01 MB';
    return size.toFixed(2) + ' MB';
  }

  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

/**
 * 获取媒体文件 URL
 */
export function getFileUrl(path: string | undefined): string {
  if (!path) return '';

  let filePath = path;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      filePath = url.pathname;
    } catch {
      return path;
    }
  }

  if (filePath.startsWith('/upload/')) {
    filePath = filePath.slice(8);
  } else if (filePath.startsWith('upload/')) {
    filePath = filePath.slice(7);
  }

  return `/api/media/file/${filePath}`;
}

/**
 * 获取缩略图 URL
 */
export function getThumbnailUrl(thumbnail: string | undefined): string {
  return getFileUrl(thumbnail);
}

/**
 * 格式化日期
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('zh-CN', options);
  } catch {
    return '-';
  }
}

/**
 * 格式化日期时间
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('zh-CN');
  } catch {
    return '-';
  }
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return formatDate(dateString);
    } else if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  } catch {
    return '-';
  }
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * 检查是否为图片文件
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
}

/**
 * 检查是否为视频文件
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
  const ext = getFileExtension(filename);
  return videoExtensions.includes(ext);
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFilename(originalName: string): string {
  const ext = getFileExtension(originalName);
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${baseName}_${timestamp}_${random}.${ext}`;
}

// ============ 通用工具函数 ============

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 休眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 检查是否为空值
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

// ============ 批量操作工具函数 ============

/**
 * 批量执行结果
 */
export interface BatchResult<T, E = Error> {
  /** 成功的结果 */
  successes: T[];
  /** 失败的结果 */
  failures: Array<{ item: any; error: E }>;
  /** 总数 */
  total: number;
  /** 成功数 */
  successCount: number;
  /** 失败数 */
  failureCount: number;
}

/**
 * 并发执行批量任务（带并发限制）
 * @param items 要处理的项数组
 * @param fn 处理函数
 * @param concurrency 并发数量限制
 * @param onProgress 进度回调
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<BatchResult<R>> {
  const results: R[] = [];
  const failures: Array<{ item: T; error: Error }> = [];
  let completed = 0;

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((item, batchIndex) => fn(item, i + batchIndex))
    );

    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        failures.push({
          item: batch[batchIndex],
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
      completed++;
      onProgress?.(completed, items.length);
    });
  }

  return {
    successes: results,
    failures,
    total: items.length,
    successCount: results.length,
    failureCount: failures.length,
  };
}

/**
 * 带重试的批量执行
 * @param items 要处理的项数组
 * @param fn 处理函数
 * @param options 配置选项
 */
export async function batchExecuteWithRetry<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number;
    retries?: number;
    retryDelay?: number;
    onProgress?: (completed: number, total: number) => void;
    onRetry?: (item: T, attempt: number, error: Error) => void;
  } = {}
): Promise<BatchResult<R>> {
  const {
    concurrency = 5,
    retries = 3,
    retryDelay = 1000,
    onProgress,
    onRetry,
  } = options;

  const results: R[] = [];
  const failures: Array<{ item: T; error: Error }> = [];
  let completed = 0;

  // 带重试的执行函数
  const executeWithRetry = async (item: T, index: number): Promise<R> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn(item, index);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          onRetry?.(item, attempt, lastError);
          await sleep(retryDelay * attempt); // 指数退避
        }
      }
    }

    throw lastError;
  };

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((item, batchIndex) => executeWithRetry(item, i + batchIndex))
    );

    batchResults.forEach((result, batchIndex) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        failures.push({
          item: batch[batchIndex],
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
      completed++;
      onProgress?.(completed, items.length);
    });
  }

  return {
    successes: results,
    failures,
    total: items.length,
    successCount: results.length,
    failureCount: failures.length,
  };
}

/**
 * 创建进度跟踪器
 */
export function createProgressTracker(total: number) {
  let completed = 0;
  const listeners: Array<(completed: number, total: number, percentage: number) => void> = [];

  return {
    increment() {
      completed++;
      const percentage = Math.round((completed / total) * 100);
      listeners.forEach((listener) => listener(completed, total, percentage));
    },
    onComplete(listener: typeof listeners[0]) {
      listeners.push(listener);
    },
    getProgress() {
      return {
        completed,
        total,
        percentage: Math.round((completed / total) * 100),
      };
    },
  };
}

