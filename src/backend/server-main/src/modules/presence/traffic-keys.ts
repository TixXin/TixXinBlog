/**
 * @file traffic-keys.ts
 * @description 访问构成的取值规则：来源只保留规范化的域名，设备只分桌面或移动及浏览器大类；
 *   完整 User-Agent 与来源地址只在请求内使用，不写入数据库。
 */

/** 每天每个维度最多登记的不同键；超出部分计入 (other)，防止伪造路径或来源撑大表 */
export const TRAFFIC_KEYS_PER_DAY = { page: 1000, referrer: 200 } as const
export const OTHER_KEY = '(other)'
/** 访问构成保留天数；每日浏览与访客汇总不清理，累计浏览依赖它 */
export const TRAFFIC_RETENTION_DAYS = 365

const HOSTNAME = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/

/** 来源域名：小写、去掉 www. 前缀；空串表示直接访问；格式不合法返回 null（不计来源） */
export function normalizeReferrer(value: string | undefined): string | null {
  if (value === undefined) return null
  const host = value.trim().toLowerCase().replace(/\.$/, '')
  if (host === '') return ''
  if (!HOSTNAME.test(host)) return null
  return host.startsWith('www.') ? host.slice(4) : host
}

export type DeviceKind = 'desktop' | 'mobile'
export type BrowserKind = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other'

/** 由 User-Agent 归类出“设备/浏览器”，只返回这两个大类 */
export function deviceKey(userAgent: string | undefined): `${DeviceKind}/${BrowserKind}` {
  const ua = userAgent ?? ''
  const device: DeviceKind = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop'
  const browser: BrowserKind = /Edg(?:e|A|iOS)?\//.test(ua)
    ? 'edge'
    : /Firefox\/|FxiOS\//.test(ua)
      ? 'firefox'
      : /Chrome\/|CriOS\/|Chromium\//.test(ua)
        ? 'chrome'
        : /Safari\//.test(ua)
          ? 'safari'
          : 'other'
  return `${device}/${browser}`
}

/** 北京时间日期往前推 n 天（YYYY-MM-DD 运算，不受服务器时区影响） */
export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
