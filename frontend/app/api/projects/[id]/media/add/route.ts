import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * POST /api/projects/[id]/media/add
 * 添加媒体到项目
 */
export async function POST(
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
    const body = await request.json();

    const response = await fetch(`${API_BASE}/api/projects/${id}/media/add/`, {
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
    console.error('[Project Media] Add error:', error);
    return NextResponse.json(
      { code: 500, message: '添加媒体失败', data: null },
      { status: 500 }
    );
  }
}
