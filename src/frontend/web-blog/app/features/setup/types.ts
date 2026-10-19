/**
 * @file types.ts
 * @description 浏览器初始化向导的接口类型，与 server-main 的 /api/v1/setup 契约一致（docs/api.md「初始化向导」）
 * @author TixXin
 * @since 2026-10-19
 */
import type { SupportedLocale } from '~~/i18n/localeOptions'

/** GET /api/v1/setup/status：配置了 SETUP_TOKEN 且没有任何管理员时为 true */
export interface SetupStatus {
  needsSetup: boolean
}

/** POST /api/v1/setup 请求体；siteName 与 locale 可省略 */
export interface SetupRequest {
  token: string
  username: string
  password: string
  siteName?: string
  locale?: SupportedLocale
}

/** 向导页状态：确认中、可填写、已关闭（已初始化或未开启）、状态读取失败 */
export type SetupPhase = 'checking' | 'open' | 'closed' | 'error'
