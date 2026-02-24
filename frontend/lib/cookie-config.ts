/**
 * @fileoverview Cookie 统一配置
 * 用于所有需要设置 Cookie 的 API 路由
 * @module lib/cookie-config
 */

/**
 * Cookie 配置选项
 * @description 提供安全的默认 Cookie 配置
 */
export const COOKIE_CONFIG = {
  /** HttpOnly 防止 XSS 攻击 */
  httpOnly: true,
  /** 仅在 HTTPS 下传输（生产环境） */
  secure: process.env.NODE_ENV === 'production',
  /** SameSite 策略防止 CSRF 攻击 */
  sameSite: 'lax' as const,
  /** Cookie 作用路径 */
  path: '/',
};

/**
 * Access Token 有效期（秒）
 * @constant {number}
 * @default 900 (15 分钟)
 */
export const ACCESS_TOKEN_MAX_AGE = 60 * 15;

/**
 * Refresh Token 有效期（秒）
 * @constant {number}
 * @default 604800 (7 天)
 */
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * 获取 Access Token Cookie 配置
 * @returns 完整的 Cookie 配置对象，包含 maxAge
 *
 * @example
 * ```typescript
 * import { getAccessTokenCookieConfig } from '@/lib/cookie-config';
 *
 * res.cookies.set('access_token', token, getAccessTokenCookieConfig());
 * ```
 */
export function getAccessTokenCookieConfig() {
  return {
    ...COOKIE_CONFIG,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  };
}

/**
 * 获取 Refresh Token Cookie 配置
 * @returns 完整的 Cookie 配置对象，包含 maxAge
 *
 * @example
 * ```typescript
 * import { getRefreshTokenCookieConfig } from '@/lib/cookie-config';
 *
 * res.cookies.set('refresh_token', token, getRefreshTokenCookieConfig());
 * ```
 */
export function getRefreshTokenCookieConfig() {
  return {
    ...COOKIE_CONFIG,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}
