import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/projects
 * 获取项目列表（分页）
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

    const response = await fetch(`${API_BASE}/api/projects/${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Projects] Get list error:', error);
    return NextResponse.json(
      { code: 500, message: '获取项目列表失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * 创建项目
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/api/projects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Projects] Create error:', error);
    return NextResponse.json(
      { code: 500, message: '创建项目失败', data: null },
      { status: 500 }
    );
  }
}
