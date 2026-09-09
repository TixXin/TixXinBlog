/** @file useMomentStore.ts @description 公开动态缓存与响应版本，较早读取不能覆盖已确认的互动结果 */
import type { MomentItem } from '~/features/moment/types'

export function useMomentStore() {
  const entries = useState<Record<string, MomentItem>>('moment-public-items', () => Object.create(null))
  const versions = useState<Record<string, number>>('moment-item-versions', () => Object.create(null))
  const clock = useState('moment-item-clock', () => 0)
  const generation = useState('moment-collection-generation', () => 0)
  function accept(items: MomentItem[], started = clock.value, requestedGeneration = generation.value) {
    if (requestedGeneration !== generation.value) return
    for (const item of items) if ((versions.value[item.id] ?? 0) <= started) entries.value[item.id] = item
  }
  function patch(id: string, value: Partial<MomentItem>) {
    versions.value[id] = ++clock.value
    if (entries.value[id]) entries.value[id] = { ...entries.value[id]!, ...value }
  }
  function forget(id: string) {
    generation.value++
    versions.value[id] = ++clock.value
    Reflect.deleteProperty(entries.value, id)
  }
  function invalidate() {
    generation.value++
  }
  return { entries, clock, generation, accept, patch, forget, invalidate }
}
