/** @file useGuestbookCache.ts @description 留言缓存按读取时序接收，旧响应不能回滚已确认回应或恢复已删除内容 */
import type { GuestbookFeedSnapshot, GuestbookPublicSnapshot, GuestbookRecord } from '~/features/guestbook/types'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'

// 弱键就是统一 LRU 中的公开投影；淘汰时关联自然释放，不维护第二套缓存期限或队列。
const viewIndexes = new WeakMap<object, WeakMap<object, GuestbookFeedSnapshot>>()
export function useGuestbookCache() {
  const app = useNuxtApp()
  if (!viewIndexes.has(app)) viewIndexes.set(app, new WeakMap())
  const indexes = viewIndexes.get(app)!
  const entries = useState<Record<number, GuestbookRecord>>('guestbook-records', () => Object.create(null))
  const versions = useState<Record<number, number>>('guestbook-record-versions', () => Object.create(null))
  const clock = useState('guestbook-clock', () => 0)
  const generation = useState('guestbook-generation', () => 0)
  function accept(records: GuestbookRecord[], started: number, expectedGeneration: number) {
    if (expectedGeneration !== generation.value) return
    for (const record of records) if ((versions.value[record.id] ?? 0) <= started) entries.value[record.id] = record
  }
  function patch(id: number, value: Partial<GuestbookRecord>) {
    versions.value[id] = ++clock.value
    if (entries.value[id]) entries.value[id] = { ...entries.value[id]!, ...value }
  }
  function invalidate(id?: number) {
    if (id !== undefined) {
      versions.value[id] = ++clock.value
      Reflect.deleteProperty(entries.value, id)
    }
    invalidatePublicReads(app, ['guestbook-feed', 'guestbook-metadata'])
  }
  function project(snapshot: GuestbookFeedSnapshot): GuestbookPublicSnapshot {
    const projection = {
      ids: snapshot.ids.filter((id) => entries.value[id]?.moderationStatus === 'published'),
      key: snapshot.key,
      generation: snapshot.generation,
      readAt: snapshot.readAt,
    }
    indexes.set(projection, snapshot)
    return projection
  }
  function restore(value: unknown): GuestbookFeedSnapshot | undefined {
    if (!value || typeof value !== 'object') return undefined
    const snapshot = indexes.get(value)
    if (
      snapshot?.generation !== generation.value ||
      snapshot.ids.some((id) => !entries.value[id] || entries.value[id]?.moderationStatus === 'hidden')
    )
      return undefined
    return snapshot
  }
  return { entries, clock, generation, accept, patch, invalidate, project, restore }
}
