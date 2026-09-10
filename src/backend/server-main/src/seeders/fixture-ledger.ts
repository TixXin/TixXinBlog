/** @file fixture-ledger.ts @description 样本所有权与指纹，删除或编辑过的记录不由重复补种重建或覆盖 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { DevelopmentFixture } from '../entities/development-fixture.entity'
import { submissionHash } from '../modules/moment/moment-values'

export const FIXTURE_TABLES = {
  post: 'post',
  comment: 'comment',
  flash: 'flash_note',
  'flash-comment': 'flash_comment',
  moment: 'moment',
  'moment-comment': 'moment_comment',
  media: 'media_asset',
  'post-like': 'post_like',
  'flash-like': 'flash_like',
  'moment-like': 'moment_like',
  guestbook: 'guestbook_message',
  'guestbook-reaction': 'guestbook_reaction',
  gallery: 'gallery_photo',
  project: 'project',
} as const
export type FixtureKind = keyof typeof FIXTURE_TABLES
export async function fixtureRow(em: EntityManager, kind: FixtureKind, id: string) {
  const table = FIXTURE_TABLES[kind]
  const rows = await em.execute<Record<string, unknown>[]>(`select * from "${table}" where id=?`, [id])
  return rows[0] ?? null
}
export function fixtureHash(row: Record<string, unknown>) {
  return submissionHash(
    Object.fromEntries(
      Object.entries(row).filter(([key]) => !['likes', 'views', 'comment_count', 'updated_at'].includes(key)),
    ),
  )
}
export interface FixtureProgress {
  created: string[]
  retained: string[]
  unavailable: string[]
}
export async function ensureFixture(
  em: EntityManager,
  dataset: string,
  scenario: string,
  kind: FixtureKind,
  create: () => Promise<string | number | null>,
  progress: FixtureProgress,
) {
  const key = `${dataset}/${kind}/${scenario}`
  const owned = await em.findOne(DevelopmentFixture, { key })
  if (owned) {
    const row = await fixtureRow(em, kind, owned.resourceId)
    if (!row || row.deleted_at) {
      progress.unavailable.push(key)
      return null
    }
    progress.retained.push(key)
    return owned.resourceId
  }
  const id = await create()
  if (id === null) {
    progress.unavailable.push(key)
    return null
  }
  await em.flush()
  const row = await fixtureRow(em, kind, String(id))
  if (!row) throw new Error('样本写入后无法确认记录')
  em.create(DevelopmentFixture, { key, dataset, kind, resourceId: String(id), snapshotHash: fixtureHash(row) })
  await em.flush()
  progress.created.push(key)
  return String(id)
}
