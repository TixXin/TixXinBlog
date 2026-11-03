/**
 * @file 01.auth-version-cookie.ts
 * @description 页面缓存与转发后端之前剥离只供浏览器脚本使用的刷新凭据版本 Cookie，避免它参与 SSR 缓存分键
 */
import { stripAuthVersionCookie } from '../utils/authVersionCookie'

export default defineEventHandler((event) => {
  const headers = event.node.req.headers
  const stripped = stripAuthVersionCookie(headers.cookie)
  if (stripped === headers.cookie) return
  if (stripped === undefined) delete headers.cookie
  else headers.cookie = stripped
})
