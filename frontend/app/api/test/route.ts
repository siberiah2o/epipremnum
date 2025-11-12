import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://192.168.55.133:8888'

    // 测试与后端的连接
    const response = await fetch(`${API_BASE_URL}/api/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: '后端连接成功',
      backendResponse: data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '后端连接失败',
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}