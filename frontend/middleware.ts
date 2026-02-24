import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 需要认证的路由
const protectedRoutes = ['/dashboard'];

/**
 * Base64URL 解码
 * JWT 使用 base64url 编码，需要转换为标准 base64 后再解码
 */
function base64UrlDecode(str: string): string {
  // 将 base64url 字符替换为标准 base64 字符
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // 添加填充字符
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  return Buffer.from(base64, 'base64').toString('utf-8');
}

// 解码 JWT token 并验证是否过期
function isTokenValid(token: string): boolean {
  try {
    // JWT 格式: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // 使用正确的 base64url 解码
    const payload = JSON.parse(base64UrlDecode(parts[1]));

    // 检查是否有过期时间
    if (!payload.exp) {
      return false;
    }

    // 检查是否过期 (exp 是秒，Date.now() 是毫秒)
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch (error) {
    console.error('[Middleware] Token validation error:', error);
    return false;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 从 cookie 获取 token
  const accessToken = request.cookies.get('access_token')?.value;

  // 验证 token 是否存在且有效
  const isAuthenticated = accessToken ? isTokenValid(accessToken) : false;

  // 检查是否是受保护的路由
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // 未登录用户访问受保护路由 -> 重定向到登录页
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 已登录用户访问登录页 -> 重定向到 dashboard
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 添加安全头
  const response = NextResponse.next();

  // X-Frame-Options: 防止点击劫持
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: 防止 MIME 类型嗅探
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection: XSS 过滤（现代浏览器中已弃用，但仍作为防御层）
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy: 控制 Referrer 信息
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy: 限制浏览器功能
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Content-Security-Policy: 内容安全策略
  // 注意：开发模式下可能需要更宽松的策略
  const isDev = process.env.NODE_ENV === 'development';
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval 用于 Next.js
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:", // API 请求
    "frame-ancestors 'none'", // 等同于 X-Frame-Options: DENY
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);

  return response;
}

export const config = {
  matcher: [
    // 匹配所有路径，除了 API 路由、_next、静态文件等
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
