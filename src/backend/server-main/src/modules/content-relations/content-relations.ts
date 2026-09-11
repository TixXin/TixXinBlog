/** @file content-relations.ts @description 关联校验、管理解析与公开投影；只读目标，不增加反向行锁或媒体引用。 */
import { BadRequestException } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CONTENT_RELATION_TYPES } from '../../common/types/content-relation'
import type { ContentRelation, ContentRelationType } from '../../common/types/content-relation'

export const relationTables = { post: 'post', project: 'project', gallery: 'gallery_photo' } as const
interface TargetRow {
  id: number
  title: string
  status: string
  deleted_at: Date | null
  slug?: string
}
export function normalizeContentRelations(value: unknown, source?: ContentRelation): ContentRelation[] {
  if (!Array.isArray(value) || value.length > 12) throw new BadRequestException('关联内容最多选择12项')
  const seen = new Set<string>()
  return value
    .map((item: unknown) => {
      const relation = item as ContentRelation | null
      if (
        !relation ||
        !CONTENT_RELATION_TYPES.includes(relation.type) ||
        !Number.isSafeInteger(relation.id) ||
        relation.id < 1 ||
        relation.id > 2147483647
      )
        throw new BadRequestException('关联内容类型或编号不合法')
      if (source && source.type === relation.type && source.id === relation.id)
        throw new BadRequestException('内容不能关联自身')
      return { type: relation.type, id: relation.id }
    })
    .filter((relation) => {
      const key = `${relation.type}:${relation.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
export async function resolveContentRelations(em: EntityManager, related: ContentRelation[], admin = false) {
  if (!related.length) return []
  const rows = new Map<string, TargetRow>()
  const queries: string[] = [],
    parameters: number[] = []
  for (const type of CONTENT_RELATION_TYPES) {
    const ids = related.filter((item) => item.type === type).map((item) => item.id)
    if (!ids.length) continue
    queries.push(
      `select '${type}' as type,id,title,status::text,deleted_at,${type === 'post' ? 'slug' : 'null as slug'} from ${relationTables[type]} where id in (${ids.map(() => '?').join(',')})`,
    )
    parameters.push(...ids)
  }
  // 一个查询快照解析三域，事务内也不并发复用同一数据库连接。
  const targets = await em.execute<(TargetRow & { type: ContentRelationType })[]>(
    queries.join(' union all '),
    parameters,
  )
  for (const target of targets) rows.set(`${target.type}:${target.id}`, target)
  return related.flatMap((relation) => {
    const target = rows.get(`${relation.type}:${relation.id}`)
    const available = !!target && !target.deleted_at
    if (!admin && (!available || target.status !== 'published')) return []
    const url =
      relation.type === 'post'
        ? `/articles/${target?.slug ? encodeURIComponent(target.slug) : relation.id}`
        : relation.type === 'project'
          ? `/projects?project=${relation.id}`
          : `/gallery?photo=${relation.id}`
    return [
      {
        ...relation,
        title: target?.title ?? `内容 #${relation.id}`,
        url,
        ...(admin ? { status: !target ? 'missing' : target.deleted_at ? 'deleted' : target.status, available } : {}),
      },
    ]
  })
}
export async function validateContentRelations(
  em: EntityManager,
  value: unknown,
  previous: ContentRelation[],
  source?: ContentRelation,
) {
  const next = normalizeContentRelations(value, source)
  const existing = new Set(previous.map((item) => `${item.type}:${item.id}`))
  const targets = await resolveContentRelations(em, next, true)
  if (targets.some((item) => !item.available && !existing.has(`${item.type}:${item.id}`)))
    throw new BadRequestException('新关联目标不存在或已删除，请重新选择；原有失效关联可以保留或解除')
  return next
}
export async function searchContentRelations(em: EntityManager, type: ContentRelationType, q = '', page = 1) {
  const pattern = '%' + q.replace(/[\\%_]/g, (char) => '\\' + char) + '%'
  const where = 'deleted_at is null and title ilike ?'
  const [count] = await em.execute<{ total: number }[]>(
    `select count(*)::int as total from ${relationTables[type]} where ${where}`,
    [pattern],
  )
  const items = await em.execute<TargetRow[]>(
    `select id,title,status from ${relationTables[type]} where ${where} order by updated_at desc,id desc limit 12 offset ?`,
    [pattern, (page - 1) * 12],
  )
  return {
    items: items.map((item) => ({ type, ...item, available: true })),
    total: count?.total ?? 0,
    page,
    pageSize: 12,
  }
}
