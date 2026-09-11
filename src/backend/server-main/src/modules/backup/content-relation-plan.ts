/** @file content-relation-plan.ts @description 关联按内容身份计划映射；不把源站编号直接写进目标站点 */
import type { ContentPackage } from './content-package'
import { packageHash } from './content-package'
import type { ContentRelation, ContentRelationType } from '../../common/types/content-relation'
export type RelationMapping = Record<
  string,
  { type: ContentRelationType; existingId?: number; copySourceId?: number } | null
>
const types: ContentRelationType[] = ['post', 'project', 'gallery']
const key = (type: ContentRelationType, id: number) => `${type}:${id}`
export function relationSources(input: ContentPackage, type: ContentRelationType) {
  return type === 'post' ? input.posts : type === 'project' ? input.projects : input.gallery
}
export function createRelationHasher(
  input: ContentPackage,
  hashBase: (type: ContentRelationType, values: unknown) => string,
) {
  const base = new Map<string, string>()
  for (const type of types)
    for (const row of relationSources(input, type)) base.set(key(type, row.sourceId), hashBase(type, row.values))
  return (type: ContentRelationType, id: number, override?: unknown) => {
    const row = relationSources(input, type).find((item) => item.sourceId === id)!
    const own = override === undefined ? base.get(key(type, id))! : hashBase(type, override)
    const related = row.values.relatedContent ?? []
    if (!related.length) return own
    return packageHash({
      own,
      related: related.map((item) => [item.type, base.get(key(item.type, item.id)) ?? 'missing']),
    })
  }
}
export function makeRelationMapping(
  current: ContentPackage,
  incoming: ContentPackage,
  plans: Record<ContentRelationType, { sourceId: number; skip: boolean }[]>,
  currentHash: (type: ContentRelationType, id: number) => string,
  incomingHash: (type: ContentRelationType, id: number) => string,
) {
  const mapping: RelationMapping = {},
    errors: string[] = []
  let omitted = incoming.omittedRelations ?? 0
  for (const type of types) {
    const known = new Map<string, NonNullable<RelationMapping[string]>>()
    for (const row of relationSources(current, type))
      if (!row.deleted && !known.has(currentHash(type, row.sourceId)))
        known.set(currentHash(type, row.sourceId), { type, existingId: row.sourceId })
    for (const row of relationSources(incoming, type)) {
      const hash = incomingHash(type, row.sourceId)
      const plan = plans[type].find((item) => item.sourceId === row.sourceId)!
      const target = row.deleted ? null : plan.skip ? (known.get(hash) ?? null) : { type, copySourceId: row.sourceId }
      mapping[key(type, row.sourceId)] = target
      if (target && !plan.skip) known.set(hash, target)
    }
  }
  for (const type of types)
    for (const row of relationSources(incoming, type)) {
      if (plans[type].find((item) => item.sourceId === row.sourceId)?.skip) continue
      const own = mapping[key(type, row.sourceId)]
      for (const relation of row.values.relatedContent ?? []) {
        const target = mapping[key(relation.type, relation.id)]
        if (!target) omitted++
        else if (own && JSON.stringify(own) === JSON.stringify(target))
          errors.push(`关联内容 ${type}:${row.sourceId} 去重后会指向自身，请选择复制策略`)
      }
    }
  return { mapping, omitted, errors }
}
export function mappedRelations(
  type: ContentRelationType,
  sourceId: number,
  related: ContentRelation[],
  mapping: RelationMapping,
  created: Record<ContentRelationType, { sourceId: number; id: number }[]>,
) {
  const own = created[type].find((item) => item.sourceId === sourceId)?.id
  const result: ContentRelation[] = [],
    seen = new Set<string>()
  for (const relation of related) {
    const target = mapping[key(relation.type, relation.id)]
    if (!target) continue
    const id = target.existingId ?? created[target.type].find((item) => item.sourceId === target.copySourceId)?.id
    if (!id) throw new Error('关联目标映射未完成')
    if (type === target.type && own === id) throw new Error('关联映射出现自身引用')
    const identity = key(target.type, id)
    if (!seen.has(identity)) {
      result.push({ type: target.type, id })
      seen.add(identity)
    }
  }
  return result
}
