/**
 * @file usePostListRoute.ts
 * @description 以URL为文章列表状态来源，用户筛选与历史恢复分别处理，避免双向监听循环
 * @author TixXin
 * @since 2026-09-07
 */
import { readPostListQuery, writePostListQuery } from '~/features/post/listQuery'
import type { PostListQueryState } from '~/features/post/listQuery'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'

export function usePostListRoute() {
  const route = useRoute()
  const router = useRouter()
  const app = useNuxtApp()
  const hydrating = ref(import.meta.client && app.isHydrating)
  let initialState = readPostListQuery(route.query)
  const serverPage = app.payload.data['post-list'] as { page?: number; scopeKey?: string } | undefined
  if (hydrating.value && Number.isInteger(serverPage?.page) && typeof serverPage?.scopeKey === 'string') {
    try {
      const scope = JSON.parse(serverPage.scopeKey) as { tag?: string; folder?: string; mode?: string }
      initialState = readPostListQuery({
        page: String(serverPage.page),
        tag: scope.tag,
        category: scope.folder,
        mode: scope.mode,
      })
    } catch {
      /* 无有效 SSR 查询时沿用初始路由。 */
    }
  }
  // 早期原生历史可能已改变 URL；首帧卡片和分页控件仍须与 SSR 使用同一查询。
  onMounted(() => {
    hydrating.value = false
  })
  let leavingTo: string | undefined
  onBeforeRouteLeave((to) => {
    leavingTo = to.fullPath
  })
  const removeAfter = router.afterEach((to, from, failure) => {
    // 被新导航取消的旧触底请求不能解开离开锁；仅本页恢复或本次离开被守卫拒绝时恢复操作。
    if (
      router.currentRoute.value.path === '/' &&
      ((!failure && to.path === '/') ||
        (to.fullPath === leavingTo && from.path === '/' && isNavigationFailure(failure, NavigationFailureType.aborted)))
    )
      leavingTo = undefined
  })
  onBeforeUnmount(removeAfter)
  const state = computed(() => (hydrating.value ? initialState : readPostListQuery(route.query)))
  function update(patch: Partial<PostListQueryState>, replace = false) {
    // Nuxt 的 useRoute 在新页面接管前仍可能指向旧列表，写 URL 必须核对即时路由。
    if (leavingTo || router.currentRoute.value.path !== '/' || route.path !== '/') return Promise.resolve()
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
