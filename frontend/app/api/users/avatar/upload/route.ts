import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * POST /api/users/avatar/upload
 * 代理到后端 POST /api/users/avatar/upload/
 * 从 Cookie 读取 access token
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

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        { code: 400, message: '缺少文件', data: null },
        { status: 400 }
      );
    }

    // 创建新的 FormData
    const backendFormData = new FormData();
    backendFormData.append('avatar', file);

    const response = await fetch(`${API_BASE}/api/users/avatar/upload/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: backendFormData,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Users] Upload avatar error:', error);
    return NextResponse.json(
      { code: 500, message: '上传失败', data: null },
      { status: 500 }
    );
  }
}
