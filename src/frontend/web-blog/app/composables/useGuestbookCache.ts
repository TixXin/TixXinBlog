/** @file useGuestbookCache.ts @description 留言缓存按读取时序接收，旧响应不能回滚已确认回应或恢复已删除内容 */
import type { GuestbookRecord } from '~/features/guestbook/types'
export function useGuestbookCache() {
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
    generation.value++
    if (id !== undefined) {
      versions.value[id] = ++clock.value
      Reflect.deleteProperty(entries.value, id)
    }
  }
  return { entries, clock, generation, accept, patch, invalidate }
}
