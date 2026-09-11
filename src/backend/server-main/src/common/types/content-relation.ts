/** @file content-relation.ts @description 三域有向有序内容关联的存储契约；与媒体引用独立。 */
export const CONTENT_RELATION_TYPES = ['post', 'project', 'gallery'] as const
export type ContentRelationType = (typeof CONTENT_RELATION_TYPES)[number]
export interface ContentRelation {
  type: ContentRelationType
  id: number
}
