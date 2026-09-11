/** @file types.ts @description 有向有序内容关联、公开投影与博主选择器契约。 */
export type ContentRelationType = 'post' | 'project' | 'gallery'
export interface ContentRelation {
  type: ContentRelationType
  id: number
}
export interface RelatedContentItem extends ContentRelation {
  title: string
  url: string
}
export interface ManagedContentRelation extends ContentRelation {
  title: string
  status: string
  available: boolean
  url?: string
}
export const contentRelationLabels = { post: '文章', project: '项目', gallery: '图库' } as const
export const contentRelationStatuses: Record<string, string> = {
  published: '已公开',
  draft: '草稿',
  archived: '已归档',
  withdrawn: '已撤回',
  deleted: '已删除',
  missing: '目标缺失',
  unknown: '尚未核查',
}
