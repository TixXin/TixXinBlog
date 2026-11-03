/**
 * @file authVersionCookie.ts
 * @description 刷新凭据版本 Cookie（tixxin_rv）只供浏览器脚本跨标签页协调，服务端渲染与后端都不读取
 *
 * 它的路径是整站，值在每次登录、刷新、登出时换新；公开页面 SSR 缓存按整串 cookie 分键，
 * 不剥离的话博主每次轮换都会生成一份新的缓存副本。
 */
export const AUTH_VERSION_COOKIE = 'tixxin_rv'

/** 从 Cookie 请求头中去掉版本 Cookie，其余条目按原顺序与原文保留；去空后返回 undefined */
export function stripAuthVersionCookie(header: string | undefined): string | undefined {
  if (!header || !header.includes(AUTH_VERSION_COOKIE)) return header
  const kept = header.split(';').filter((part) => part.trim().split('=')[0] !== AUTH_VERSION_COOKIE)
  const value = kept
    .map((part) => part.trim())
    .filter(Boolean)
    .join('; ')
  return value || undefined
}
