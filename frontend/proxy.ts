import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 公开路由，不需要认证
const publicRoutes = ['/login', '/register', '/signup', '/api/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route =>
    pathname.startsWith(route)
  )

  // 检查是否是静态资源
  const isStaticFile = pathname.startsWith('/_next') ||
                       pathname.startsWith('/static') ||
                       pathname.includes('.')

  // 如果是公开路由或静态文件，直接通过
  if (isPublicRoute || isStaticFile) {
    return NextResponse.next()
  }

  // 对于 Next.js 16，主要依赖客户端的 hooks 进行认证
  // 服务器端 proxy 只做基础的路由保护
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}