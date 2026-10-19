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
/** 关联类型的界面名称 key（common.contentRelation.types.*），由调用方按当前语言翻译 */
export function contentRelationTypeKey(type: ContentRelationType) {
  return `common.contentRelation.types.${type}`
}
