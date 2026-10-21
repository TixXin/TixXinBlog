/**
 * @file useGuestbookRouteFilters.ts
 * @description 留言板路由筛选状态：关键词搜索、指定日期筛选与可读描述
 * @author TixXin
 * @since 2026-10-21
 */

export function useGuestbookRouteFilters() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  const search = computed({
    get: () => String(route.query.q ?? ''),
    set: (value) => {
      void router.replace({ path: '/guestbook', query: { ...route.query, q: value || undefined } })
    },
  })

  const selectedDate = computed(() => (typeof route.query.date === 'string' ? route.query.date : null))
  const clearFilters = () => router.replace({ path: '/guestbook' })

  const filterLabel = computed(() =>
    [
      search.value && t('interaction.guestbook.filterKeyword', { keyword: search.value }),
      selectedDate.value && t('interaction.guestbook.filterDate', { date: selectedDate.value }),
    ]
      .filter(Boolean)
      .join(t('interaction.guestbook.filterSeparator')),
  )

  return {
    search,
    selectedDate,
    clearFilters,
    filterLabel,
  }
}
