/** @file useAdminSubscriptions.ts @description 复用管理读取归属，订阅列表按版本更新、排序和软删除 */
import { subscriptionQuery } from '~/features/subscription/query'
import type { ManagedSubscription, SubscriptionEditable } from '~/features/subscription/types'
export function useAdminSubscriptions() {
  const repo = useSubscriptionRepository(),
    route = useRoute(),
    router = useRouter(),
    app = useNuxtApp()
  const query = computed(() => ({
    ...subscriptionQuery(route.query),
    status: ['draft', 'published', 'withdrawn'].includes(String(route.query.status))
      ? String(route.query.status)
      : 'all',
  }))
  const key = computed(() => JSON.stringify(query.value)),
    acceptedKey = ref('')
  const resource = useAdminReadResource(async () => {
    const requested = key.value,
      result = await repo.adminList(query.value)
    acceptedKey.value = requested
    return { key: requested, ...result }
  }, '订阅服务暂时不可用，请重试')
  const error = ref(''),
    notice = ref(''),
    busy = ref<number[]>([])
  watch(key, () => {
    error.value = ''
    void resource.refresh()
  })
  const data = computed(() => (resource.data.value?.key === key.value ? resource.data.value : null))
  async function mutate(item: ManagedSubscription, patch?: Partial<SubscriptionEditable>, sort = false) {
    if (busy.value.includes(item.id) || resource.pending.value) return
    if (!patch && !window.confirm(`删除订阅「${item.name}」？记录将从公开页面移除。`)) return
    const owns = resource.captureOwnership()
    busy.value = [...busy.value, item.id]
    error.value = ''
    notice.value = ''
    try {
      if (sort && patch?.sortOrder !== undefined)
        await repo.sort([{ id: item.id, revision: item.revision, sortOrder: patch.sortOrder }])
      else if (patch) await repo.update(item.id, patch, item.revision)
      else await repo.remove(item.id, item.revision)
      if (!owns()) return
      notice.value = patch ? '订阅已更新。' : '订阅已删除。'
      void app.runWithContext(() => refreshNuxtData('subscriptions-feed'))
      await resource.refresh()
    } catch (cause) {
      if (owns())
        error.value =
          (cause instanceof Error ? cause.message : '操作失败') +
          ((cause as { statusCode?: number }).statusCode === 409 ? '；请重新读取当前版本后再操作。' : '')
    } finally {
      busy.value = busy.value.filter((id) => id !== item.id)
    }
  }
  return {
    data,
    pending: resource.pending,
    error: computed(() => error.value || resource.error.value),
    notice,
    busy,
    query,
    filter: (patch: Record<string, string | number | undefined>) =>
      router.push({ query: { ...route.query, page: undefined, ...patch } }),
    load: resource.refresh,
    mutate,
    stale: computed(() => !!resource.data.value && acceptedKey.value !== key.value),
  }
}
