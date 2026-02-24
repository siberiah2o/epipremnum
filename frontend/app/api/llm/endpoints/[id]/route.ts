import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/endpoints/[id]
 * 获取单个端点
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/api/endpoints/${id}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Endpoint] Get error:', error);
    return NextResponse.json(
      { code: 500, message: '获取端点失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/endpoints/[id]
 * 更新端点
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/api/endpoints/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Endpoint] Update error:', error);
    return NextResponse.json(
      { code: 500, message: '更新端点失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/endpoints/[id]
 * 删除端点
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/api/endpoints/${id}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204) {
      return NextResponse.json({ code: 200, message: '删除成功' }, { status: 200 });
    }

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[LLM Endpoint] Delete error:', error);
    return NextResponse.json(
      { code: 500, message: '删除端点失败', data: null },
      { status: 500 }
    );
  }
}
