import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/users/profile
 * 代理到后端 GET /api/users/profile/me/
 * 从 Cookie 读取 access token
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

    const response = await fetch(`${API_BASE}/api/users/profile/me/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Users] Get profile error:', error);
    return NextResponse.json(
      { code: 500, message: '获取用户信息失败', data: null },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/profile
 * 代理到后端 PATCH /api/users/profile/edit/
 * 从 Cookie 读取 access token
 */
export async function PATCH(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { code: 401, message: '未登录', data: null },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(`${API_BASE}/api/users/profile/edit/`, {
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
    console.error('[Users] Update profile error:', error);
    return NextResponse.json(
      { code: 500, message: '更新用户信息失败', data: null },
      { status: 500 }
    );
  }
}
