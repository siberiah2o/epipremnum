import { NextRequest, NextResponse } from 'next/server';
import { getAccessTokenCookieConfig } from '@/lib/cookie-config';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * POST /api/auth/refresh
 * 从 Cookie 读取 refresh token，刷新 access token
 */
export async function POST(request: NextRequest) {
  try {
    // 从 Cookie 获取 refresh token
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { code: 401, message: '未找到 refresh token', data: null },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    const data = await response.json();

    // 刷新成功，更新 access token Cookie
    if (response.ok && data.access) {
      const res = NextResponse.json(
        { code: 200, message: 'Token 刷新成功', data: { access: data.access } },
        { status: 200 }
      );

      res.cookies.set('access_token', data.access, getAccessTokenCookieConfig());

      return res;
    }

    // 刷新失败，清除 Cookie
    const res = NextResponse.json(data, { status: response.status });
    res.cookies.delete('access_token');
    res.cookies.delete('refresh_token');
    return res;
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return NextResponse.json(
      { code: 500, message: '刷新 Token 失败', data: null },
      { status: 500 }
    );
  }
}
