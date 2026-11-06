/**
 * @file traffic.ts
 * @description 后台访问统计：GET /api/v1/admin/presence/traffic 与 /visits 的响应结构与展示规则
 *   （契约见 docs/api.md「实时在线与访问统计」）；国家按 ISO 代码，名称随界面语言由 Intl.DisplayNames 生成
 */

export const TRAFFIC_RANGES = [7, 30, 90] as const
export type TrafficRange = (typeof TRAFFIC_RANGES)[number]

/** 超出当日不同键上限的页面或来源统一计入此键 */
export const TRAFFIC_OTHER_KEY = '(other)'

export interface TrafficEntry {
  key: string
  count: number
}

export interface TrafficReport {
  /** 起止日期（站点时区，含两端） */
  from: string
  to: string
  /** 逐日浏览与访客，缺数据的日期补 0 */
  days: { date: string; views: number; visitors: number }[]
  /** 访客为每日访客之和（同一访客跨天会重复计） */
  totals: { views: number; visitors: number }
  pages: TrafficEntry[]
  /** 键为来源域名，空串为直接访问 */
  referrers: TrafficEntry[]
  devices: TrafficEntry[]
  browsers: TrafficEntry[]
  /** 全部国家，键为 ISO 代码，空串为未知地区；按当日访客计 */
  countries: TrafficEntry[]
  /** 省份或州排行，键为“国家代码/名称” */
  regions: TrafficEntry[]
}

/** 近期访问明细（后台开启后记录、保留 7 天）：IP 已打码，设备为“设备/浏览器”大类 */
export interface RecentVisit {
  visitedAt: string
  maskedIp: string
  country: string
  region: string
  city: string
  device: string
  path: string
  /** 来源域名；空串为直接访问，null 为站内跳转 */
  referrer: string | null
}
export interface RecentVisitsPage {
  items: RecentVisit[]
  total: number
  page: number
  pageSize: number
}

const regionNames = new Map<string, Intl.DisplayNames>()
/** 国家代码的本地化名称；未知或无法识别时返回空串，由调用方显示“未知地区” */
export function countryName(code: string, locale: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  if (!regionNames.has(locale)) regionNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }))
  try {
    return regionNames.get(locale)!.of(code) ?? code
  } catch {
    return code
  }
}

/** 省份排行的键“国家代码/名称”：国内省份只显示名称，其他国家前面加国名 */
export function regionLabel(key: string, locale: string, unknownRegion = '省份未知'): string {
  const slash = key.indexOf('/')
  if (slash < 0) return key
  const code = key.slice(0, slash),
    name = key.slice(slash + 1) || unknownRegion
  return code === 'CN' && key.length > slash + 1 ? name : `${countryName(code, locale)} · ${name}`
}

/** 明细的地点：国名、省份、城市去重后拼接（城市常与直辖市同名） */
export function visitPlace(visit: Pick<RecentVisit, 'country' | 'region' | 'city'>, locale: string): string {
  const parts = [countryName(visit.country, locale), visit.region, visit.city].filter(Boolean)
  return parts.filter((part, index) => parts.indexOf(part) === index).join(' · ')
}

export interface TrafficRow extends TrafficEntry {
  /** 相对本组最大值的比例，用于条形长度 */
  ratio: number
  /** 占本组合计的百分比（整数） */
  percent: number
}

/** 排行条目附上条形比例与占比；合计为 0 时比例与占比为 0 */
export function trafficRows(entries: TrafficEntry[]): TrafficRow[] {
  const max = Math.max(0, ...entries.map((entry) => entry.count))
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  return entries.map((entry) => ({
    ...entry,
    ratio: max ? entry.count / max : 0,
    percent: total ? Math.round((entry.count / total) * 100) : 0,
  }))
}
