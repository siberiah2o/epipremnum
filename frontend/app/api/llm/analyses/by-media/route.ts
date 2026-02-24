import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/analyses/by-media
 * 根据媒体ID获取分析记录
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

    const { searchParams } = request.nextUrl;
    const mediaId = searchParams.get('media_id');

    if (!mediaId) {
      return NextResponse.json(
        { code: 400, message: '缺少 media_id 参数', data: null },
        { status: 400 }
      );
    }

    const url = new URL(`${API_BASE}/api/analyses/by_media/`);
    url.searchParams.set('media_id', mediaId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Analyses] Get by media error:', error);
    return NextResponse.json(
      { code: 500, message: '获取媒体分析记录失败', data: null },
      { status: 500 }
    );
  }
}
