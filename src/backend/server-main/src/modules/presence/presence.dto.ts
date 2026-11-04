/**
 * @file presence.dto.ts
 * @description 心跳、离开、正在阅读查询与后台开关的输入边界；页面路径只用于浏览去重与按页计数，不落库
 */
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class PresenceHeartbeatDto {
  /** 浏览器会话 ID：sessionStorage 中的 32 位十六进制随机值，只用于在线人数 */
  @IsString() @Matches(/^[a-f0-9]{32}$/) session!: string
  /** 当前页面路径：用于“正在阅读”按页计数，view 为 true 时同时参与浏览去重 */
  @IsOptional() @IsString() @MaxLength(512) path?: string
  /** 首次进入页面或站内跳转后的第一次心跳为 true */
  @IsOptional() @IsBoolean() view?: boolean
}

/** 页面关闭时由 sendBeacon 发送的离开上报：只携带会话 ID */
export class PresenceLeaveDto {
  @IsString() @Matches(/^[a-f0-9]{32}$/) session!: string
}

/** 查询某个页面正在阅读的人数 */
export class PresenceReadersQueryDto {
  @IsString() @MaxLength(512) path!: string
}

export class SavePresenceSettingsDto {
  @IsOptional() @IsBoolean() autoPresence?: boolean
  @IsOptional() @IsBoolean() publicStats?: boolean
}

/** 计入浏览的站内页面路径：以 / 开头、不含查询与片段，排除后台、预览、初始化与接口路径 */
export function countablePath(path: string | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null
  const clean = path.split(/[?#]/, 1)[0]!.replace(/\/+$/, '') || '/'
  // 空白与控制字符一律不计，防止拼出不同写法的同一路径刷浏览。
  if ([...clean].some((char) => char.charCodeAt(0) < 0x20 || /\s/.test(char))) return null
  if (/^\/(?:admin|setup|api|posts\/preview)(?:\/|$)/.test(clean)) return null
  return clean
}

/** 常见爬虫与自动化客户端：只计在线与浏览时排除，不影响响应内容 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|curl|wget|python-requests|go-http-client|httpclient|axios|node-fetch|uptime|monitor/i

export function isAutomatedClient(userAgent: string | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent)
}
