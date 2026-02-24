import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/llm/analyses
 * 获取分析列表
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
    const url = new URL(`${API_BASE}/api/analyses/`);

    // 传递查询参数
    ['status', 'media', 'model', 'error_type', 'search', 'ordering'].forEach(param => {
      const value = searchParams.get(param);
      if (value !== null) {
        url.searchParams.set(param, value);
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Analyses] Get list error:', error);
    return NextResponse.json(
      { code: 500, message: '获取分析列表失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * POST /api/llm/analyses
 * 创建分析任务（异步）
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

    const response = await fetch(`${API_BASE}/api/analyses/`, {
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
    console.error('[LLM Analyses] Create error:', error);
    return NextResponse.json(
      { code: 500, message: '创建分析任务失败', data: null },
      { status: 500 }
    );
  }
}
