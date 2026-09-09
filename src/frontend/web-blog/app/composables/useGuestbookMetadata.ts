/** @file useGuestbookMetadata.ts @description 留言侧栏仅显示真实公开聚合，失败时保留已知值并暴露错误 */
import type { GuestbookMetadata } from '~/features/guestbook/types'
export async function useGuestbookMetadata() {
  const repo = useGuestbookRepository()
  const retained = useState<GuestbookMetadata | null>('guestbook-metadata-retained', () => null)
  const result = useAsyncData('guestbook-metadata', (_app, { signal }) => repo.metadata(signal))
  watch(
    result.data,
    (value) => {
      if (value) retained.value = value
    },
    { immediate: true },
  )
  await result
  if (result.data.value) retained.value = result.data.value
  return {
    data: computed(() => result.data.value ?? retained.value),
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
