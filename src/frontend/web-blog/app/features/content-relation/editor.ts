/** @file editor.ts @description 关联字段白名单与恢复副本验证，只保留类型和编号。 */
import type { ContentRelation } from './types'
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
export function contentRelationSummary(value?: ContentRelation[]) {
  return (
    (value ?? [])
      .map((item) => `${item.type === 'post' ? '文章' : item.type === 'project' ? '项目' : '图库'} #${item.id}`)
      .join(' → ') || '未设置'
  )
}
