/** @file types.ts @description 运营工作台真实聚合响应与跨域内容类型；不可用分区用 null 表示。 */
export type OverviewDomain = 'post' | 'flash' | 'moment' | 'gallery' | 'project' | 'link'
export interface OverviewContent {
  domain: OverviewDomain
  id: string
  title: string
  status: 'draft' | 'published' | 'archived' | 'withdrawn'
  updatedAt: string
}
/** 近 30 天按日（UTC）的新建内容与收到的互动 */
export interface OverviewTrendDay {
  date: string
  content: number
  interactions: number
}
export interface AdminOverview {
  counts: Record<string, number> | null
  recentContent: OverviewContent[] | null
  trends: OverviewTrendDay[] | null
  unavailable: ('counts' | 'recentContent' | 'trends')[]
  generatedAt: string
}
