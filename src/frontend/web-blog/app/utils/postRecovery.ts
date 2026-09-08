/**
 * @file postRecovery.ts
 * @description 按账号和文章隔离的本机恢复副本；每个编辑页使用独立键，避免标签页互相覆盖。
 */
import type { AdminPostDraft } from '~/features/post/adminTypes'

export interface PostRecoveryEntry {
  schemaVersion: 1
  savedAt: string
  draft: AdminPostDraft
}
export interface PostRecoveryItem extends PostRecoveryEntry {
  key: string
}
export interface RecoveryStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export function recoveryPrefix(owner: string, postId: string | null): string {
  return `tixxin-post-recovery:${encodeURIComponent(owner)}:${postId ?? 'new'}:`
}
function validDraft(value: unknown, postId: string | null): value is AdminPostDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  for (const field of ['slug', 'coverAlt', 'seoTitle', 'seoDescription']) {
    if (draft[field] !== undefined && (typeof draft[field] !== 'string' || (draft[field] as string).length > 10000))
      return false
  }
  if (draft.seoNoindex !== undefined && typeof draft.seoNoindex !== 'boolean') return false
  // 恢复副本允许尚未通过表单校验的输入，正式保存仍由后端执行严格校验。
  const limits = { title: 10000, summary: 10000, cover: 10000, folder: 10000, contentRaw: 200000 } as const
  if (
    !Object.entries(limits).every(
      ([key, max]) => typeof draft[key] === 'string' && (draft[key] as string).length <= max,
    )
  )
    return false
  if (
    !['tech', 'life'].includes(String(draft.category)) ||
    !['draft', 'published', 'archived'].includes(String(draft.status))
  )
    return false
  if (
    typeof draft.pinned !== 'boolean' ||
    !(
      draft.readTimeMinutes === '' ||
      (typeof draft.readTimeMinutes === 'number' && Number.isFinite(draft.readTimeMinutes))
    )
  )
    return false
  if (draft.revision !== undefined && (!Number.isInteger(draft.revision) || Number(draft.revision) < 0)) return false
  if (postId === null ? draft.id !== undefined : draft.id !== Number(postId)) return false
  return (
    Array.isArray(draft.tags) &&
    draft.tags.length <= 2000 &&
    draft.tags.every((tag) => typeof tag === 'string' && tag.length <= 10000)
  )
}
export function readPostRecoveries(
  storage: RecoveryStorage,
  prefix: string,
  postId: string | null,
): { items: PostRecoveryItem[]; invalidCount: number } {
  const items: PostRecoveryItem[] = []
  let invalidCount = 0
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key?.startsWith(prefix)) continue
    try {
      const raw = storage.getItem(key)
      if (!raw || raw.length > 1000000) throw new Error('副本大小异常')
      const value = JSON.parse(raw) as PostRecoveryEntry
      if (value.schemaVersion !== 1 || !Number.isFinite(Date.parse(value.savedAt)) || !validDraft(value.draft, postId))
        throw new Error('副本格式异常')
      const draft = value.draft
      items.push({
        key,
        schemaVersion: 1,
        savedAt: value.savedAt,
        draft: {
          id: draft.id,
          slug: draft.slug,
          coverAlt: draft.coverAlt,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          seoNoindex: draft.seoNoindex,
          revision: draft.revision,
          savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : undefined,
          title: draft.title,
          summary: draft.summary,
          cover: draft.cover,
          folder: draft.folder,
          category: draft.category,
          status: draft.status,
          contentRaw: draft.contentRaw,
          readTimeMinutes: draft.readTimeMinutes,
          pinned: draft.pinned,
          tags: draft.tags,
        },
      })
    } catch {
      invalidCount += 1
    }
  }
  return { items: items.sort((a, b) => b.savedAt.localeCompare(a.savedAt)), invalidCount }
}
export function writePostRecovery(
  storage: RecoveryStorage,
  key: string,
  draft: AdminPostDraft,
  savedAt = new Date().toISOString(),
) {
  const value: PostRecoveryEntry = { schemaVersion: 1, savedAt, draft }
  storage.setItem(key, JSON.stringify(value))
  return savedAt
}
