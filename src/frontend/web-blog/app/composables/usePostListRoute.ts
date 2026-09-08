/**
 * @file usePostListRoute.ts
 * @description 以URL为文章列表状态来源，用户筛选与历史恢复分别处理，避免双向监听循环
 * @author TixXin
 * @since 2026-09-07
 */
import { readPostListQuery, writePostListQuery } from '~/features/post/listQuery'
import type { PostListQueryState } from '~/features/post/listQuery'

export function usePostListRoute() {
  const route = useRoute()
  const router = useRouter()
  let leaving = false
  onBeforeRouteLeave(() => {
    leaving = true
  })
  const removeAfter = router.afterEach((_to, _from, failure) => {
    if (failure) leaving = false
  })
  onBeforeUnmount(removeAfter)
  const state = computed(() => readPostListQuery(route.query))
  function update(patch: Partial<PostListQueryState>, replace = false) {
    if (leaving || route.path !== '/') return Promise.resolve()
    const next = { ...state.value, ...patch }
    if ('tag' in patch || 'category' in patch || 'mode' in patch) next.page = 1
    const query = Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !['page', 'tag', 'category', 'mode'].includes(key)),
    )
    Object.assign(query, writePostListQuery(next))
    return replace ? router.replace({ path: '/', query }) : router.push({ path: '/', query })
  }
  const page = computed({
    get: () => state.value.page,
    set: (value) => {
      void update({ page: value }, state.value.mode === 'waterfall')
    },
  })
  const selectedTag = computed({
    get: () => state.value.tag,
    set: (value) => {
      void update({ tag: value })
    },
  })
  const selectedCategory = computed({
    get: () => state.value.category,
    set: (value) => {
      void update({ category: value })
    },
  })
  const displayMode = computed({
    get: () => state.value.mode,
    set: (value) => {
      void update({ mode: value })
    },
  })
  return {
    page,
    selectedTag,
    selectedCategory,
    displayMode,
    clearFilters: () => update({ tag: null, category: null }),
    replacePage: (value: number) => update({ page: value }, true),
  }
}
