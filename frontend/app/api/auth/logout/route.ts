import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * 清除 HttpOnly Cookie
 */
export async function POST(request: NextRequest) {
  try {
    const res = NextResponse.json(
      { code: 200, message: '登出成功', data: null },
      { status: 200 }
    );

    // 清除所有认证相关的 Cookie
    res.cookies.delete('access_token');
    res.cookies.delete('refresh_token');

    return res;
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { code: 500, message: '登出失败', data: null },
      { status: 500 }
    );
  }
}
