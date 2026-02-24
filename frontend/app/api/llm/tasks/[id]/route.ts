import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/tasks/[id]
 * 获取任务详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/api/analyses/${id}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Tasks] Get detail error:', error);
    return NextResponse.json(
      { code: 500, message: '获取任务详情失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 * 删除任务记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const { id } = await params;

    const response = await fetch(`${API_BASE}/api/analyses/${id}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Tasks] Delete error:', error);
    return NextResponse.json(
      { code: 500, message: '删除任务失败', data: null },
      { status: 500 }
    );
  }
}
