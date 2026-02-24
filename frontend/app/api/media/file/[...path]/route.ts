import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/media/file/[...path]
 * 代理后端媒体文件（图片、缩略图等）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = path.join('/');

    // 构建后端文件 URL
    const backendUrl = `${API_BASE}/upload/${filePath}`;

    // 从请求中获取 cookie 用于认证
    const accessToken = request.cookies.get('access_token')?.value;

    // 代理请求到后端
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { code: response.status, message: '获取文件失败' },
        { status: response.status }
      );
    }

    // 获取文件内容
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // 返回文件
    return new NextResponse(blob, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        // 使用较短的缓存时间，避免新上传的图片不显示
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Media File] Proxy error:', error);
    return NextResponse.json(
      { code: 500, message: '文件代理失败' },
      { status: 500 }
    );
  }
}
