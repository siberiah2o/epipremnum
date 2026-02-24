import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

// 统一的 Cookie 配置
const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * POST /api/auth/login
 * 代理到后端 POST /api/users/auth/login/
 * 设置 HttpOnly Cookie 存储 token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE}/api/users/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // 登录成功，设置 HttpOnly Cookie
    if (response.ok && data.data?.access && data.data?.refresh) {
      const res = NextResponse.json(
        {
          code: 200,
          message: data.message || '登录成功',
          data: { user: data.data.user }
        },
        { status: 200 }
      );

      // 设置 access token (15 分钟)
      res.cookies.set('access_token', data.data.access, {
        ...COOKIE_CONFIG,
        maxAge: 60 * 15, // 15 分钟
      });

      // 设置 refresh token (7 天)
      res.cookies.set('refresh_token', data.data.refresh, {
        ...COOKIE_CONFIG,
        maxAge: 60 * 60 * 24 * 7, // 7 天
      });

      return res;
    }

    // 登录失败，返回错误信息
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { code: 500, message: '登录请求失败', data: null },
      { status: 500 }
    );
  }
}
