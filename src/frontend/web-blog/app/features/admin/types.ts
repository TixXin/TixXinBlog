/** @file types.ts @description 运营工作台真实聚合响应与跨域内容类型；不可用分区用 null 表示。 */
export type OverviewDomain = 'post' | 'flash' | 'moment' | 'gallery' | 'project' | 'link'
export interface OverviewContent {
  domain: OverviewDomain
  id: string
  title: string
  status: 'draft' | 'published' | 'archived' | 'withdrawn'
  updatedAt: string
}
export interface AdminOverview {
  counts: Record<string, number> | null
  recentContent: OverviewContent[] | null
  unavailable: ('counts' | 'recentContent')[]
  generatedAt: string
}
