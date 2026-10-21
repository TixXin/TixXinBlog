/**
 * @file useSubscriptionsPage.ts
 * @description 订阅页面状态管理、双数据源（博客/本机）切换、查询筛选与编辑流程组合函数
 * @author TixXin
 * @since 2026-04-20
 */

import { statistics, parseAmount } from '@tixxin/subscription-domain'
import type {
  SubscriptionCurrency,
  SubscriptionItem,
  SubscriptionQuery,
  SubscriptionStats,
} from '~/features/subscription/types'
import { filterSubscriptions, publicSubscriptionQuery } from '~/features/subscription/query'

export function useSubscriptionsPage(
  feed: Awaited<ReturnType<typeof useSubscriptions>>,
  options: {
    ownerEditor: Ref<{ canLeave(): boolean; focusName(): void } | null>
    ownerPanel: Ref<HTMLElement | null>
    localPanel: Ref<{ focusName(): void; scrollIntoView(opts?: ScrollIntoViewOptions): void } | null>
  },
) {
  const { ownerEditor, ownerPanel, localPanel } = options
  const { t } = useI18n()
  const today = useSubscriptionToday()
  const auth = useCurrentUser()
  const local = useLocalSubscriptions()

  const mode = ref<'blog' | 'local'>('blog')
  const localQuery = reactive<SubscriptionQuery>(publicSubscriptionQuery({}))

  const ownerExpanded = ref(false)
  const ownerId = ref<number | null>(null)
  const searchText = ref('')

  const query = computed(() => (mode.value === 'blog' ? feed.query.value : localQuery))
  const localFiltered = computed(() => filterSubscriptions(local.data.value.items, localQuery))
  const stats = computed<SubscriptionStats | null>(() =>
    mode.value === 'blog' ? feed.stats.value : local.ready.value ? statistics(localFiltered.value, today.value) : null,
  )
  const total = computed(() =>
    mode.value === 'blog' ? feed.total.value : local.ready.value ? localFiltered.value.length : null,
  )
  const items = computed(() =>
    mode.value === 'blog'
      ? feed.items.value
      : local.ready.value
        ? localFiltered.value.slice((localQuery.page - 1) * localQuery.pageSize, localQuery.page * localQuery.pageSize)
        : [],
  )
  const currency = computed<SubscriptionCurrency>(() => (query.value.currency as SubscriptionCurrency) ?? 'USD')
  const pending = computed(() => mode.value === 'blog' && feed.pending.value)
  const filtered = computed(() => !!(query.value.q || query.value.category || query.value.subscriptionStatus))
  const controlsReady = computed(() => (mode.value === 'blog' ? feed.ready.value : local.ready.value))
  const sorted = computed(() => query.value.sort !== 'manual')
  const filterCount = computed(
    () =>
      Number(!!query.value.category) + Number(!!query.value.subscriptionStatus) + Number(query.value.sort !== 'manual'),
  )

  const selectedStats = computed(() => stats.value?.currencies.find((item) => item.currency === currency.value))
  const nextRenewal = computed(() => selectedStats.value?.upcoming.find((item) => !item.overdue))
  const renewalDayHint = computed(() => {
    const date = nextRenewal.value?.date,
      base = stats.value?.asOf ?? today.value
    if (!date || !base) return ''
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86_400_000)
    return days === 0
      ? t('misc.subscription.page.renewalToday')
      : days === 1
        ? t('misc.subscription.page.renewalTomorrow')
        : ''
  })
  const overdueCount = computed(() => selectedStats.value?.upcoming.filter((item) => item.overdue).length ?? 0)

  watch(
    [() => query.value.q, mode, currency],
    () => {
      searchText.value = query.value.q ?? ''
    },
    { immediate: true },
  )

  const localPriceChanged = computed(() => {
    const saved = local.saved.value
    if (!saved) return false
    try {
      return (
        parseAmount(local.form.amountInput, local.form.currency) !== saved.amount ||
        local.form.currency !== saved.currency ||
        local.form.billingCycle !== saved.billingCycle
      )
    } catch {
      return true
    }
  })

  watch([() => localFiltered.value.length, () => localQuery.pageSize], ([count, size]) => {
    const pages = Math.max(1, Math.ceil(count / size))
    if (localQuery.page > pages) localQuery.page = pages
  })

  function changeQuery(patch: Record<string, string | number | undefined>) {
    if (mode.value === 'blog') void feed.changeQuery(patch)
    else Object.assign(localQuery, publicSubscriptionQuery({ ...localQuery, page: undefined, ...patch }))
  }

  function clearFilters() {
    changeQuery({
      q: undefined,
      category: undefined,
      subscriptionStatus: undefined,
      sort: undefined,
    })
  }

  function switchMode(next: 'blog' | 'local') {
    if (next === mode.value || local.saving.value) return
    if (mode.value === 'blog' && ownerEditor.value && !ownerEditor.value.canLeave()) return
    if (mode.value === 'local' && local.dirty.value && !window.confirm(t('misc.subscription.page.confirmSwitchSource')))
      return
    const carried = currency.value
    mode.value = next
    if (carried !== (query.value.currency ?? 'USD')) changeQuery({ currency: carried })
  }

  async function openOwner(targetId: number | null) {
    if (ownerEditor.value && !ownerEditor.value.canLeave()) return
    ownerId.value = targetId
    ownerExpanded.value = true
    await nextTick()
    ownerPanel.value?.scrollIntoView({ block: 'start' })
    ownerEditor.value?.focusName()
  }

  async function editItem(item: SubscriptionItem) {
    if (mode.value === 'blog') await openOwner(Number(item.id))
    else {
      const record = local.data.value.items.find((row) => row.id === item.id)
      if (record && local.edit(record)) {
        await nextTick()
        localPanel.value?.focusName()
      }
    }
  }

  function removeLocal(item: SubscriptionItem) {
    const record = local.data.value.items.find((row) => row.id === item.id)
    if (record) void local.remove(record)
  }

  async function ownerSaved() {
    ownerExpanded.value = false
    await feed.refresh()
  }

  async function addLocal() {
    if (!local.edit(undefined, currency.value)) return
    await nextTick()
    localPanel.value?.focusName()
  }

  async function saveLocal() {
    const savedCurrency = local.form.currency
    await local.save()
    if (!local.editing.value && !local.error.value) {
      changeQuery({ currency: savedCurrency, q: undefined, category: undefined, subscriptionStatus: undefined })
    }
  }

  function search() {
    changeQuery({ q: searchText.value.trim() || undefined })
  }

  return {
    local,
    auth,
    mode,
    localQuery,
    ownerExpanded,
    ownerId,
    searchText,
    query,
    stats,
    total,
    items,
    currency,
    pending,
    filtered,
    controlsReady,
    sorted,
    filterCount,
    nextRenewal,
    renewalDayHint,
    overdueCount,
    localPriceChanged,
    today,
    switchMode,
    changeQuery,
    clearFilters,
    openOwner,
    editItem,
    removeLocal,
    ownerSaved,
    addLocal,
    saveLocal,
    search,
  }
}
