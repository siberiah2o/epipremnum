import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * GET /api/media/images
 * 代理到后端获取所有图片
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

    // 获取 URL 参数以支持分页、搜索、过滤
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const page_size = searchParams.get('page_size') || '10000';
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const ordering = searchParams.get('ordering');

    // 构建查询参数
    const params = new URLSearchParams({
      page,
      page_size,
    });
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (type) params.set('type', type);
    if (ordering) params.set('ordering', ordering);

    const response = await fetch(`${API_BASE}/api/media/images/?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Media] Get images error:', error);
    return NextResponse.json(
      { code: 500, message: '获取图片列表失败', data: null },
      { status: 500 }
    );
  }
}
