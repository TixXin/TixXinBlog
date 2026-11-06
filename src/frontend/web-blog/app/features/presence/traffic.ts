/**
 * @file traffic.ts
 * @description 后台访问统计：GET /api/v1/admin/presence/traffic 的响应结构与展示规则（契约见 docs/api.md「实时在线与访问统计」）
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
