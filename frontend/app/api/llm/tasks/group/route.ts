import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/tasks/group
 * 获取任务组状态
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
    const group = searchParams.get('group');

    if (!group) {
      return NextResponse.json(
        { code: 400, message: '缺少 group 参数', data: null },
        { status: 400 }
      );
    }

    const url = new URL(`${API_BASE}/api/analyses/group/`);
    url.searchParams.set('group', group);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Tasks] Get group status error:', error);
    return NextResponse.json(
      { code: 500, message: '获取任务组状态失败', data: null },
      { status: 500 }
    );
  }
}
