/** @file editor.ts @description 关联字段白名单与恢复副本验证，只保留类型和编号。 */
import type { Translate } from '~/utils/format'
import { contentRelationTypeKey, type ContentRelation } from './types'
export function validContentRelations(value: unknown): value is ContentRelation[] {
  return (
    Array.isArray(value) &&
    value.length <= 12 &&
    value.every(
      (item) =>
        item &&
        ['post', 'project', 'gallery'].includes(item.type) &&
        Number.isSafeInteger(item.id) &&
        item.id > 0 &&
        item.id <= 2147483647,
    )
  )
}
export function copyContentRelations(value?: ContentRelation[]): ContentRelation[] {
  return (value ?? []).map(({ type, id }) => ({ type, id }))
}
/** 有序关联的单行摘要（如「文章 #3 → 图库 #7」），t 由调用方传入以跟随当前界面语言 */
export function contentRelationSummary(value: ContentRelation[] | undefined, t: Translate) {
  return (
    (value ?? [])
      .map((item) =>
        t('common.contentRelation.summaryItem', { type: t(contentRelationTypeKey(item.type)), id: item.id }),
      )
      .join(' → ') || t('common.contentRelation.unset')
  )
}
