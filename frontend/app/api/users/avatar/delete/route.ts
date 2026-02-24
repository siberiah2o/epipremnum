import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * DELETE /api/users/avatar/delete
 * 代理到后端 DELETE /api/users/avatar/delete/
 * 从 Cookie 读取 access token
 */
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/api/users/avatar/delete/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Users] Delete avatar error:', error);
    return NextResponse.json(
      { code: 500, message: '删除失败', data: null },
      { status: 500 }
    );
  }
}
