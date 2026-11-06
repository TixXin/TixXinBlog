/**
 * @file types.ts
 * @description 实时在线与访问统计：POST /api/v1/presence 的响应结构（契约见 docs/api.md「实时在线与访问统计」）
 */

/** 博主自动在线状态：2 分钟内有心跳为 online，否则为 away 并给出最后在线时间 */
export interface LiveOwner {
  status: 'online' | 'away'
  /** 最后一次心跳的 ISO 时间；从未出现时为 null */
  lastSeenAt: string | null
}

export interface LiveStats {
  /** 看过本站的不同访客数 */
  visitors: number
  /** 站点时区下今日浏览次数 */
  todayViews: number
  /** 功能上线以来的累计浏览次数 */
  totalViews: number
}

export interface LivePresence {
  /** 当前在线人数；后台关闭公开统计时为 null */
  online: number | null
  /** 博主自动在线状态；后台关闭自动在线状态时为 null */
  owner: LiveOwner | null
  /** 访问统计；后台关闭公开统计时为 null */
  stats: LiveStats | null
  /** 与本次心跳同一页面的在线会话数（含自己）；关闭公开统计或页面不计浏览时为 null */
  readers?: number | null
  /** 前端记录：这次结果对应的页面路径，用于判断 readers 是否属于当前页面 */
  path?: string
}
