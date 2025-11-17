/**
 * 媒体资源相关的工具函数
 */

/**
 * 将后端返回的完整URL转换为前端代理路径
 * @param url 后端返回的完整URL
 * @returns 转换后的相对路径
 */
export function convertToProxyUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    // 从环境变量获取后端配置
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_HOST || '192.168.55.133';
    const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || '8888';

    // 如果是后端的媒体资源URL，转换为相对路径
    if (urlObj.hostname === backendHost && urlObj.port === backendPort) {
      return urlObj.pathname + urlObj.search + urlObj.hash;
    }
    // 其他URL保持不变
    return url;
  } catch (error) {
    // 如果URL解析失败，返回原值
    return url;
  }
}

/**
 * 批量转换媒体数据中的URL
 * @param media 媒体数据对象
 * @returns 转换后的媒体数据
 */
export function convertMediaUrls(media: any) {
  if (!media) return media;

  return {
    ...media,
    file_url: convertToProxyUrl(media.file_url),
    thumbnail_url: convertToProxyUrl(media.thumbnail_url),
  };
}

/**
 * 批量转换媒体列表中的URL
 * @param mediaList 媒体列表
 * @returns 转换后的媒体列表
 */
export function convertMediaListUrls(mediaList: any[]) {
  if (!Array.isArray(mediaList)) return mediaList;

  return mediaList.map(media => convertMediaUrls(media));
}