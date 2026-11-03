/**
 * @file auth-cookies.ts
 * @description 刷新凭据 Cookie 的写入与清除，并在每次改写结束时换新可读的版本 Cookie
 *
 * 版本 Cookie 不含凭据，只是随机值：前端跨标签页串行改写刷新凭据时，
 * 文档卸载后仍在完成的 keepalive 请求无法通知其他标签页，等待方据版本变化确认上一次改写已落地。
 */
import { randomUUID } from 'node:crypto'
import type { Response } from 'express'
import { getRefreshCookieOptions, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_MS } from './auth.constants'

/** 刷新凭据版本 Cookie 名；前端 authCookieLock 读取同名 Cookie */
export const REFRESH_VERSION_COOKIE_NAME = 'tixxin_rv'

/** 版本 Cookie 需被前端脚本读取，因此不设 HttpOnly；其余属性与刷新凭据一致，路径放宽到全站页面 */
export function getRefreshVersionCookieOptions() {
  const { secure, sameSite } = getRefreshCookieOptions()
  return { httpOnly: false, sameSite, secure, path: '/', maxAge: REFRESH_TOKEN_TTL_MS }
}

/** 标记一次刷新凭据改写已结束（成功、拒绝或清除均算），不论是否签发了新凭据 */
export function markRefreshCookieSettled(res: Response): void {
  res.cookie(REFRESH_VERSION_COOKIE_NAME, randomUUID(), getRefreshVersionCookieOptions())
}

export function writeRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions())
  markRefreshCookieSettled(res)
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: getRefreshCookieOptions().path })
  markRefreshCookieSettled(res)
}

/** 执行会改写刷新凭据的操作；失败时也换新版本，错误响应仍带上 Set-Cookie，等待方不必等到上限 */
export async function settleRefreshCookie<T>(res: Response, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    markRefreshCookieSettled(res)
    throw error
  }
}
