/**
 * @file client-context.ts
 * @description 从请求头得出留言展示用的浏览器与地区：浏览器解析 User-Agent 主流家族与主版本，地区只采信可信代理注入的头
 * @author TixXin
 * @since 2026-10-16
 */
import type { Request } from 'express'

/** 默认由前置代理（如 Caddy/Cloudflare）注入的地区头名称，可用 CLIENT_REGION_HEADER 覆盖 */
export const DEFAULT_CLIENT_REGION_HEADER = 'x-client-region'

const FAMILIES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Edge', pattern: /\bEdg(?:e|A|iOS)?\/(\d+)/ },
  { name: 'Opera', pattern: /\bOPR\/(\d+)/ },
  { name: 'Firefox', pattern: /\b(?:Firefox|FxiOS)\/(\d+)/ },
  { name: 'Chrome', pattern: /\b(?:Chrome|CriOS)\/(\d+)/ },
  { name: 'Safari', pattern: /\bVersion\/(\d+)[.\d]*.*\bSafari\// },
]

/** 解析为“家族 主版本”，无法识别时返回空串；超长或异常的 UA 直接忽略 */
export function parseBrowser(userAgent: string | undefined): string {
  if (!userAgent || userAgent.length > 512) return ''
  for (const family of FAMILIES) {
    const match = family.pattern.exec(userAgent)
    if (match) return `${family.name} ${match[1]}`
  }
  return ''
}

/** 地区头只在连接来自已配置的可信代理时采信，避免访客自填 */
export function clientRegion(request: Request, headerName = DEFAULT_CLIENT_REGION_HEADER): string {
  const trust = request.app?.get?.('trust proxy fn') as ((address: string, index: number) => boolean) | undefined
  const remote = request.socket?.remoteAddress
  if (!trust || !remote || !trust(remote, 0)) return ''
  const value = request.get(headerName)
  if (!value) return ''
  const region = value.trim().replace(/\s+/g, ' ')
  return region.length > 40 ? '' : region
}
