/** @file editorial-review.ts @description 精确核对四候选的完整归属指纹、版本和文章历史；不把已编辑内容当成自动迁正对象。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { fixtureHash, fixtureRow } from './fixture-ledger'
import { packageHash } from '../modules/backup/content-package'
import { submissionHash } from '../modules/moment/moment-values'
import {
  EDITORIAL_DATASET,
  EDITORIAL_CREATE_REASON,
  EDITORIAL_REFRESH_REASON,
  editorialArticles,
} from './editorial-content'
import {
  editorialCandidates,
  editorialLedgerKey,
  editorialPostSnapshot,
  editorialProjectInput,
  editorialRelations,
} from './editorial-model'
import type { EditorialIds, EditorialKey } from './editorial-model'
export type EditorialStage = 'legacy' | 'unlinked' | 'ready' | 'edited' | 'deleted' | 'missing-ownership'
export interface EditorialReviewItem {
  key: EditorialKey
  kind: 'post' | 'project'
  id: number | null
  revision: number | null
  title: string
  stage: EditorialStage
  fingerprint: string | null
}
function normalizedSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const snapshot = value as Record<string, unknown>
  if (!Array.isArray(snapshot.tags) || !snapshot.tags.every((tag) => typeof tag === 'string')) return null
  return { ...snapshot, relatedContent: snapshot.relatedContent ?? [], tags: [...snapshot.tags].sort() }
}
export async function editorialPostValues(em: EntityManager, row: Record<string, unknown>) {
  const tags = await em.execute<{ label: string }[]>(
    'select t.label from post_tag t join post_tag_map m on m.post_tag_id=t.id where m.post_id=? order by t.label',
    [row.id],
  )
  return {
    relatedContent: row.related_content ?? [],
    slug: row.slug ?? '',
    coverAlt: row.cover_alt ?? '',
    seoTitle: row.seo_title ?? '',
    seoDescription: row.seo_description ?? '',
    seoNoindex: row.seo_noindex,
    title: row.title,
    summary: row.summary,
    cover: row.cover ?? '',
    folder: row.folder,
    category: row.category,
    contentRaw: row.content_raw,
    contentSections: row.content_sections,
    readTimeMinutes: row.read_time_minutes,
    status: row.status,
    pinned: row.pinned,
    tags: tags.map((item) => item.label).sort(),
  }
}
export function editorialProjectValues(row: Record<string, unknown>) {
  return {
    title: row.title,
    description: row.description,
    coverMediaId: row.cover_media_id ?? null,
    progress: row.progress,
    status: row.status,
    sortOrder: row.sort_order,
    tags: row.tags,
    links: row.links,
    relatedContent: row.related_content ?? [],
  }
}
export async function inspectEditorialContent(em: EntityManager) {
  const ownership = await em.execute<{ key: string; kind: string; resource_id: string; snapshot_hash: string }[]>(
    'select key,kind,resource_id,snapshot_hash from development_fixture where dataset=? order by key',
    [EDITORIAL_DATASET],
  )
  const ids = {} as EditorialIds
  for (const candidate of editorialCandidates) {
    const ledger = ownership.find(
      (item) => item.key === editorialLedgerKey(candidate.key) && item.kind === candidate.kind,
    )
    if (ledger && /^[1-9]\d*$/.test(ledger.resource_id) && Number(ledger.resource_id) <= 2147483647)
      ids[candidate.key] = Number(ledger.resource_id)
  }
  const items: EditorialReviewItem[] = []
  for (const candidate of editorialCandidates) {
    const id = ids[candidate.key] ?? null
    const ledger = ownership.find((item) => item.key === editorialLedgerKey(candidate.key))
    const base = { ...candidate, id, revision: null, title: '', fingerprint: null }
    if (!id || !ledger) {
      items.push({ ...base, stage: 'missing-ownership' })
      continue
    }
    const row = await fixtureRow(em, candidate.kind, String(id))
    if (!row || row.deleted_at) {
      items.push({ ...base, stage: 'deleted' })
      continue
    }
    const fingerprint = fixtureHash(row),
      revision = Number(row.revision),
      title = String(row.title)
    let stage: EditorialStage = 'edited'
    if (fingerprint === ledger.snapshot_hash) {
      const relations = editorialRelations(ids, candidate.key)
      if (candidate.kind === 'post') {
        const values = await editorialPostValues(em, row)
        const [history] = await em.execute<{ snapshot: Record<string, unknown>; reason: string }[]>(
          'select snapshot,reason from post_revision where post_id=? and revision=?',
          [id, revision],
        )
        const same = (expected: ReturnType<typeof editorialPostSnapshot>, reason: string) =>
          !!history &&
          history.reason === reason &&
          packageHash(values) === packageHash(expected) &&
          packageHash(normalizedSnapshot(history.snapshot)) === packageHash(expected)
        if (revision === 1 && same(editorialPostSnapshot(candidate.key, [], true), EDITORIAL_CREATE_REASON))
          stage = 'legacy'
        else if (revision === 1 && same(editorialPostSnapshot(candidate.key), EDITORIAL_CREATE_REASON))
          stage = 'unlinked'
        else if (revision === 2 && same(editorialPostSnapshot(candidate.key, relations), EDITORIAL_REFRESH_REASON))
          stage = 'ready'
      } else {
        const values = editorialProjectValues(row)
        const hash = (legacy: boolean) => {
          const { relatedContent: _relatedContent, ...input } = editorialProjectInput([], legacy)
          void _relatedContent
          return submissionHash(input)
        }
        if (
          revision === 0 &&
          row.request_hash === hash(true) &&
          packageHash(values) === packageHash(editorialProjectInput([], true))
        )
          stage = 'legacy'
        else if (
          revision === 0 &&
          row.request_hash === hash(false) &&
          packageHash(values) === packageHash(editorialProjectInput())
        )
          stage = 'unlinked'
        else if (
          revision === 1 &&
          [hash(true), hash(false)].includes(String(row.request_hash)) &&
          packageHash(values) === packageHash(editorialProjectInput(relations))
        )
          stage = 'ready'
      }
    }
    items.push({ ...candidate, id, revision, title, fingerprint, stage })
  }
  const ownershipMatches =
    ownership.length === editorialCandidates.length &&
    ownership.every((item) => editorialCandidates.some((candidate) => editorialLedgerKey(candidate.key) === item.key))
  const addresses = await em.execute<{ slug: string; post_id: number }[]>(
    'select slug,post_id from post_address where slug in (?,?,?) order by slug',
    editorialArticles.map((article) => article.slug),
  )
  const blockedSlugs = editorialArticles
    .filter((article) => {
      const address = addresses.find((item) => item.slug === article.slug)
      const current = items.find((item) => item.key === article.key)
      return address
        ? address.post_id !== ids[article.key]
        : current?.stage === 'ready' || current?.stage === 'unlinked'
    })
    .map((article) => article.slug)
  const eligible =
    ownershipMatches &&
    blockedSlugs.length === 0 &&
    items.every((item) => ['legacy', 'unlinked', 'ready'].includes(item.stage))
  return {
    dataset: EDITORIAL_DATASET,
    ids,
    items,
    ownershipMatches,
    blockedSlugs,
    eligible,
    ready: eligible && items.every((item) => item.stage === 'ready'),
    fingerprint: packageHash({ ownership, items, addresses }),
  }
}
