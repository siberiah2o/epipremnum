import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/projects/available-media
 * 获取可添加的媒体
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();

    const response = await fetch(`${API_BASE}/api/projects/available-media/${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Projects] Get available media error:', error);
    return NextResponse.json(
      { code: 500, message: '获取可添加媒体失败', data: null },
      { status: 500 }
    );
  }
}
