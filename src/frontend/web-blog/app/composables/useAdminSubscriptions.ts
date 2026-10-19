/** @file useAdminSubscriptions.ts @description 复用管理读取归属，订阅列表按版本更新、排序和软删除 */
import { subscriptionQuery } from '~/features/subscription/query'
import type { ManagedSubscription, SubscriptionEditable } from '~/features/subscription/types'
import { subscriptionErrorMessage } from '~/features/subscription/labels'
export function useAdminSubscriptions() {
  const repo = useSubscriptionRepository(),
    route = useRoute(),
    router = useRouter(),
    app = useNuxtApp(),
    // 在 setup 内取翻译函数：失败处理发生在 await 之后仍可使用
    { t } = useI18n()
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
  }, t('admin-media.subscriptionList.unavailable'))
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
    if (!patch && !window.confirm(t('admin-media.subscriptionList.removeConfirm', { name: item.name }))) return
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
      notice.value = patch ? t('admin-media.subscriptionList.updated') : t('admin-media.subscriptionList.removed')
      void app.runWithContext(() => refreshNuxtData('subscriptions-feed'))
      await resource.refresh()
    } catch (cause) {
      if (owns())
        error.value =
          (subscriptionErrorMessage(cause, t) ?? t('admin-media.subscriptionList.mutateFailed')) +
          ((cause as { statusCode?: number }).statusCode === 409
            ? t('admin-media.subscriptionList.conflictSuffix')
            : '')
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
