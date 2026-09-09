/** @file fixture-cleanup-plan.ts @description 仅清理指纹未变且无外部互动的指定样本；关联家庭整体保留，媒体只在无保留引用时移除索引 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { FIXTURE_TABLES, fixtureHash, fixtureRow } from './fixture-ledger'
import type { FixtureKind } from './fixture-ledger'

const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
const identity = (table: string, id: unknown) => `${table}:${String(id)}`
type ForeignKey = { sourceTable: string; sourceColumn: string; targetTable: string; columns: number }
export async function fixtureCleanupPlan(em: EntityManager, dataset: string) {
  const ownership = await em.find(DevelopmentFixture, dataset === 'all' ? {} : { dataset }, { orderBy: { key: 'asc' } })
  const rows = new Map<string, Record<string, unknown>>()
  const eligible = new Set<string>(),
    reasons = new Map<string, string>()
  const owned = new Map<string, DevelopmentFixture>()
  for (const item of ownership) {
    if (!(item.kind in FIXTURE_TABLES)) throw new Error('归属账本包含未知资源类型，请先核对')
    const kind = item.kind as FixtureKind,
      key = identity(FIXTURE_TABLES[kind], item.resourceId)
    if (owned.has(key)) throw new Error('资源归属重复，请先核对')
    owned.set(key, item)
    const row = await fixtureRow(em, kind, item.resourceId)
    if (!row) {
      reasons.set(key, '记录已移除；保留归属以防止补种复活')
      continue
    }
    rows.set(key, row)
    if (fixtureHash(row) !== item.snapshotHash) reasons.set(key, '内容、状态或身份已经修改')
    else eligible.add(key)
  }
  const relations = await em.execute<ForeignKey[]>(`
    select child.relname as "sourceTable", attribute.attname as "sourceColumn", parent.relname as "targetTable",
      cardinality(fk.conkey)::int as columns
    from pg_constraint fk join pg_class child on child.oid=fk.conrelid
      join pg_namespace child_ns on child_ns.oid=child.relnamespace
      join pg_class parent on parent.oid=fk.confrelid join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
      join pg_attribute attribute on attribute.attrelid=fk.conrelid and attribute.attnum=fk.conkey[1]
    where fk.contype='f' and child_ns.nspname='public' and parent_ns.nspname='public'`)
  const tables = new Set<string>(Object.values(FIXTURE_TABLES))
  const incoming: { parent: string; relation: ForeignKey; row: Record<string, unknown> }[] = []
  for (const relation of relations.filter((item) => tables.has(item.targetTable))) {
    if (relation.columns !== 1) throw new Error('样本资源存在复合外键，请先核对清理策略')
    const parentIds = [...rows.keys()]
      .filter((key) => key.startsWith(relation.targetTable + ':'))
      .map((key) => key.slice(relation.targetTable.length + 1))
    if (!parentIds.length) continue
    const children = await em.execute<Record<string, unknown>[]>(
      `select * from public.${quote(relation.sourceTable)} where ${quote(relation.sourceColumn)}::text in (${parentIds.map(() => '?').join(',')})`,
      parentIds,
    )
    for (const row of children)
      incoming.push({ parent: identity(relation.targetTable, row[relation.sourceColumn]), relation, row })
  }
  const preserve = (key: string, reason: string) => {
    if (!eligible.delete(key)) return false
    reasons.set(key, reason)
    return true
  }
  let changed = true
  while (changed) {
    changed = false
    for (const { parent, relation, row } of incoming) {
      const child = identity(relation.sourceTable, row.id)
      if (tables.has(relation.sourceTable) && relation.targetTable !== 'media_asset') {
        if (!eligible.has(child))
          changed = preserve(parent, '存在已修改或不属于指定样本集的回复、互动或内容引用') || changed
        if (!eligible.has(parent)) changed = preserve(child, '所属内容需要保留，关联样本一并保留') || changed
      } else if (eligible.has(parent)) {
        if (relation.sourceTable === 'media_reference') {
          if (relation.targetTable !== 'media_asset') continue
          const owners = relations.filter(
            (item) =>
              item.sourceTable === 'media_reference' &&
              item.targetTable !== 'media_asset' &&
              row[item.sourceColumn] !== null,
          )
          if (owners.length && owners.every((item) => eligible.has(identity(item.targetTable, row[item.sourceColumn]))))
            continue
        } else if (
          ['post_revision', 'post_address', 'post_tag_map'].includes(relation.sourceTable) &&
          relation.targetTable === 'post'
        )
          continue
        changed = preserve(parent, '仍有其他内容、媒体或未知业务引用') || changed
      }
    }
    // 指定一组样本时，不删除另一组或用户内容上的互动，即便互动本身属于本组。
    for (const [key, row] of rows) {
      if (!eligible.has(key)) continue
      const table = key.slice(0, key.indexOf(':'))
      for (const relation of relations.filter(
        (item) => item.sourceTable === table && tables.has(item.targetTable) && item.targetTable !== 'media_asset',
      )) {
        const parentId = row[relation.sourceColumn]
        if (parentId !== null && parentId !== undefined && !eligible.has(identity(relation.targetTable, parentId)))
          changed = preserve(key, '所属内容不在可清理范围，保留其互动或回复') || changed
      }
    }
  }
  return {
    remove: [...eligible].map((key) => ({
      key: owned.get(key)!.key,
      kind: owned.get(key)!.kind as FixtureKind,
      id: owned.get(key)!.resourceId,
    })),
    preserve: [...reasons].map(([key, reason]) => ({ key: owned.get(key)!.key, reason })),
    ownershipRecordsRetained: ownership.length,
    mediaFiles: '仅清理可移除的媒体索引；磁盘图片和完整备份保留',
  }
}
