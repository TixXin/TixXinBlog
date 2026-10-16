/** @file useGuestbookMetadata.ts @description 留言侧栏仅显示真实公开聚合，失败时保留已知值并暴露错误 */
import type { GuestbookMetadata } from '~/features/guestbook/types'
export async function useGuestbookMetadata() {
  const repo = useGuestbookRepository()
  const entities = useGuestbookCache()
  type PublicMetadata = Omit<GuestbookMetadata, 'pinned'> & { pinnedId: number | null; generation: number }
  const result = usePublicReadData(
    'guestbook-metadata',
    async (_app, { signal }): Promise<PublicMetadata> => {
      const started = entities.clock.value,
        generation = entities.generation.value
      const value = await repo.metadata(signal)
      if (signal.aborted || generation !== entities.generation.value)
        throw new DOMException('留言统计已失效', 'AbortError')
      if (value.pinned) entities.accept([value.pinned], started, generation)
      return {
        stats: value.stats,
        members: value.members,
        rules: value.rules,
        pinnedId: value.pinned?.id ?? null,
        generation,
      }
    },
    {
      domain: 'guestbook-metadata',
      kind: 'metadata',
      lazy: true,
      cache: {
        project: (value) => value,
        restore: (value) => {
          const snapshot = value as PublicMetadata
          if (snapshot.generation !== entities.generation.value) return undefined
          const pinned = snapshot.pinnedId === null ? null : entities.entries.value[snapshot.pinnedId]
          if (snapshot.pinnedId !== null && (!pinned || pinned.moderationStatus !== 'published')) return undefined
          return snapshot
        },
      },
    },
  )
  await result
  return {
    data: computed<GuestbookMetadata | null>(() => {
      const value = result.data.value
      return value
        ? {
            stats: value.stats,
            members: value.members,
            rules: value.rules,
            pinned: value.pinnedId === null ? null : (entities.entries.value[value.pinnedId] ?? null),
          }
        : null
    }),
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
