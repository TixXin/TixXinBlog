/**
 * @file useMomentFilters.ts
 * @description 朋友圈搜索、话题与日期以URL共享，列表和主题侧栏使用同一状态
 * @author TixXin
 * @since 2026-04-11
 */

export function useMomentFilters() {
  const route = useRoute()
  const router = useRouter()
  function read(key: string) {
    const value = route.query[key]
    const first = Array.isArray(value) ? value[0] : value
    return typeof first === 'string' ? first.trim().slice(0, 200) : ''
  }
  function update(key: string, value: string | null, replace = false) {
    const inTopic = route.path.startsWith('/moments/topic/')
    const query = Object.fromEntries(
      Object.entries(route.path === '/moments' || inTopic ? route.query : {}).filter(
        ([name]) => name !== key && (key === 'page' || name !== 'page'),
      ),
    )
    if (inTopic && key !== 'topic') query.topic = String(route.params.name ?? '')
    if (value) query[key] = value
    return replace ? router.replace({ path: '/moments', query }) : router.push({ path: '/moments', query })
  }
  const selectedDate = computed({
    get: () => {
      const value = read('date')
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
    },
    set: (value: string | null) => {
      void update('date', value)
    },
  })
  const selectedTopic = computed({
    get: () => read('topic') || (route.path.startsWith('/moments/topic/') ? String(route.params.name ?? '') : null),
    set: (value: string | null) => {
      void update('topic', value)
    },
  })
  const searchKeyword = computed({
    get: () => read('q'),
    set: (value: string) => {
      void update('q', value, true)
    },
  })
  function clearFilters() {
    const query = Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !['date', 'topic', 'q', 'page'].includes(key)),
    )
    return router.push({ path: '/moments', query })
  }
  const page = computed(() => {
    const value = Number(read('page'))
    return Number.isInteger(value) && value > 0 ? Math.min(value, 10000) : 1
  })
  const filterQuery = computed<Record<string, string>>(() =>
    Object.fromEntries(
      [
        ['q', searchKeyword.value],
        ['topic', selectedTopic.value ?? ''],
        ['date', selectedDate.value ?? ''],
        ['page', page.value > 1 ? String(page.value) : ''],
      ].filter(([, value]) => !!value),
    ),
  )
  function setPage(value: number, replace = false) {
    return update('page', value > 1 ? String(value) : null, replace)
  }
  return { selectedDate, selectedTopic, searchKeyword, page, setPage, filterQuery, clearFilters }
}
