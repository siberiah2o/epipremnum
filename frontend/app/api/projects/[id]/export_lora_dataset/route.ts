import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';

/**
 * POST /api/projects/[id]/export_lora_dataset/
 * 导出项目的 LoRA 训练数据集
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

    const response = await fetch(`${API_BASE}/api/projects/${id}/export_lora_dataset/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return NextResponse.json(errorData, { status: response.status });
      }
      return NextResponse.json(
        { code: response.status, message: '导出失败', data: null },
        { status: response.status }
      );
    }

    // 获取文件内容
    const blob = await response.blob();

    // 获取文件名
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'lora_dataset.zip';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    // 返回文件
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[Project] Export LoRA dataset error:', error);
    return NextResponse.json(
      { code: 500, message: '导出失败', data: null },
      { status: 500 }
    );
  }
}
