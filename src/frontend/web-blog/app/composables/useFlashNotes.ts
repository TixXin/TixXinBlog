/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、分页追加、所有权同步与公开/私有状态编排
 * @author TixXin
 * @since 2026-04-11
 */

import type { FlashNote } from '~/features/flash/types'
import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from '~/features/flash/mock'
import { mockOwnerUser } from '~/features/auth/mock'
import {
  FLASH_PUBLIC_FRESH_MS,
  FLASH_PUBLIC_PAGE_SIZE,
  FLASH_PUBLIC_STALE_MS,
  invalidateFlashNotes,
} from '~/features/flash/state'
import {
  type FlashPublicFilter,
  buildPageQuery,
  filterKey,
  isPublicNote,
  isUnfiltered,
  normalizeFilter,
} from '~/features/flash/publicFilter'
import { ensureSeedsUpToDate } from '~/features/flash/seed'
import { useFlashOverviewState } from '~/features/flash/useFlashOverviewState'
import { useFlashActions } from '~/features/flash/useFlashActions'

export type { FlashPublicFilter }

export function useFlashNotes() {
  const app = useNuxtApp()
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  // 本地演示数据归属站点所有者；真实管理员 UUID 不应创建第二份重复的站点数据。
  const contentOwnerId = computed(() =>
    currentUser.value?.role === 'owner' ? mockOwnerUser.id : (currentUser.value?.id ?? mockOwnerUser.id),
  )
  // HTTP 模式下种子由后端 DevSeeder 负责，前端不再补种（create 是管理员能力）
  const shouldSeedLocally = useRuntimeConfig().public.useMockRepo !== false

  const notes = useState<FlashNote[]>('flash-notes', () => [])
  const loaded = useState<boolean>('flash-notes-loaded', () => false)
  const loading = useState<boolean>('flash-notes-loading', () => false)
  const error = useState<string | null>('flash-notes-error', () => null)
  const loadedAt = useState('flash-notes-loaded-at', () => 0)
  const invalidated = useState('flash-notes-invalidated', () => false)
  const loadedOwner = useState('flash-notes-owner', () => '')
  // 公开分页状态：随 SSR payload 下发，水合时不重复请求首屏
  const total = useState('flash-notes-total', () => 0)
  const pagesLoaded = useState('flash-notes-pages', () => 0)
  const loadedQuery = useState('flash-notes-query', () => '')
  const publicTotal = useState<number | null>('flash-public-total', () => null)
  const serverRendered = useState('flash-notes-ssr', () => false)
  const moreLoading = useState('flash-more-loading', () => false)
  const moreError = useState<string | null>('flash-more-error', () => null)

  /** 当前实例的公开查询；离开页面后回访从“全部”开始，与页面筛选控件的初始值一致 */
  const publicFilter = ref<Required<FlashPublicFilter>>({ tag: null, q: '', type: null, date: null })
  const publicQueryKey = computed(() => filterKey(publicFilter.value))
  const contentContext = useState<string>('page-content-context', () => '')
  /** 当前展示的所有者：owner（未登录回退）或 self（登录后看自己的） */
  const viewingScope = useState<'self' | 'owner'>('flash-notes-scope', () => 'owner')
  const ownerKey = computed(() =>
    JSON.stringify([
      currentUser.value?.id ?? null,
      isLoggedIn.value ? 'self' : 'owner',
      contentOwnerId.value,
      contentContext.value,
    ]),
  )

  function synchronizeOwner() {
    if (loadedOwner.value === ownerKey.value) return
    invalidateFlashNotes(app, { clear: true })
    loadedOwner.value = ownerKey.value
    viewingScope.value = isLoggedIn.value ? 'self' : 'owner'
  }
  // 重新挂载时在首次渲染前清理旧身份；活动页面的身份变化也不能等待异步请求再隐藏草稿。
  synchronizeOwner()
  watch(ownerKey, synchronizeOwner, { flush: 'sync' })

  /** 是否处于只读模式：未登录时只能浏览博主的闪念 */
  const isReadOnly = computed(() => !isLoggedIn.value)
  /** 未登录且仓库支持单页读取时按页加载；登录后的私有视图与本地演示仓库保持整表读取 */
  const pagedPublic = computed(() => !isLoggedIn.value && typeof repo.listPublicPage === 'function')
  const hasMore = computed(
    () => pagedPublic.value && loaded.value && pagesLoaded.value * FLASH_PUBLIC_PAGE_SIZE < total.value,
  )

  // SSR 写入的读取时刻来自服务器时钟；水合时按本机时钟重新起算，避免时钟偏差把首屏判成过期并清空。
  if (import.meta.client && app.isHydrating && serverRendered.value) {
    loadedAt.value = Date.now()
    serverRendered.value = false
  }

  const overviewState = useFlashOverviewState({
    repo,
    pagedPublic,
    ownerKey,
    notes,
    loaded,
    publicTotal,
  })

  const loadVersion = useState('flash-load-version', () => 0)

  /**
   * 加载笔记列表。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的闪念列表，同样支持 seed
   */
  async function load(force = false, options: { rethrow?: boolean } = {}) {
    synchronizeOwner()
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const nextScope: 'self' | 'owner' = isLoggedIn.value ? 'self' : 'owner'
    const paged = pagedPublic.value
    const queryKey = paged ? publicQueryKey.value : ''
    const sameQuery = loadedQuery.value === queryKey
    const age = Date.now() - loadedAt.value
    const timedPublicRead = nextScope === 'owner' && !shouldSeedLocally
    const fresh = sameQuery && !invalidated.value && (shouldSeedLocally || (age >= 0 && age < FLASH_PUBLIC_FRESH_MS))
    if (loaded.value && !force && fresh) return

    const version = ++loadVersion.value
    const ownsLoad = () => version === loadVersion.value && owner === ownerKey.value
    // 私有实体仍由原仓储接纳写入；公开数据超过 5 分钟、已撤销或换了查询条件时不再展示旧结果。
    if (timedPublicRead && (!sameQuery || invalidated.value || age < 0 || age > FLASH_PUBLIC_STALE_MS)) {
      notes.value = []
      loaded.value = false
      total.value = 0
      pagesLoaded.value = 0
    }
    loading.value = true
    error.value = null
    moreLoading.value = false
    moreError.value = null
    try {
      if (paged && repo.listPublicPage) {
        const filter = { ...publicFilter.value }
        // 重新验证时核对已展示的完整范围，避免回访后只剩第一页
        const pageCount = sameQuery && loaded.value ? Math.max(1, pagesLoaded.value) : 1
        const collected = new Map<string, FlashNote>()
        let count = 0
        let read = 0
        for (let page = 1; page <= pageCount; page++) {
          const result = await repo.listPublicPage(buildPageQuery(page, filter))
          if (!ownsLoad()) return
          result.items.filter(isPublicNote).forEach((note) => collected.set(note.id, note))
          count = result.total
          read = page
          if (!result.items.length || page * FLASH_PUBLIC_PAGE_SIZE >= result.total) break
        }
        notes.value = [...collected.values()]
        total.value = count
        pagesLoaded.value = read
        loadedQuery.value = queryKey
        if (isUnfiltered(filter)) publicTotal.value = count
        if (import.meta.server) serverRendered.value = true
        viewingScope.value = nextScope
        loaded.value = true
        loadedAt.value = Date.now()
        invalidated.value = false
        return
      }
      let list = await repo.list(targetUserId)
      if (!ownsLoad()) return
      if (shouldSeedLocally) {
        if (list.length === 0) {
          for (const draft of defaultFlashNoteSeeds) {
            await repo.create(targetUserId, draft)
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`flash:seeds:version:${targetUserId}`, String(FLASH_SEEDS_VERSION))
          }
          list = await repo.list(targetUserId)
        } else {
          await ensureSeedsUpToDate(repo, targetUserId)
          list = await repo.list(targetUserId)
        }
      }
      if (!ownsLoad()) return
      notes.value = nextScope === 'owner' ? list.filter(isPublicNote) : list
      total.value = notes.value.length
      pagesLoaded.value = 0
      loadedQuery.value = queryKey
      viewingScope.value = nextScope
      loaded.value = true
      loadedAt.value = Date.now()
      invalidated.value = false
    } catch (e) {
      if (ownsLoad()) error.value = e instanceof Error ? e.message : String(e)
      if (options.rethrow) throw e
    } finally {
      if (ownsLoad()) loading.value = false
    }
  }

  /** 切换公开分页的服务端条件；条件不变时不重复请求 */
  function setPublicFilter(next: FlashPublicFilter) {
    const normalized = normalizeFilter(next)
    if (filterKey(normalized) === publicQueryKey.value) return
    publicFilter.value = normalized
    if (pagedPublic.value) void load()
  }

  /** 追加下一页公开闪念；查询、身份或读取代次变化后迟到的结果直接丢弃 */
  async function loadMore() {
    if (!hasMore.value || loading.value || moreLoading.value || !repo.listPublicPage) return
    if (loadedQuery.value !== publicQueryKey.value) return
    const version = loadVersion.value
    const owner = ownerKey.value
    const queryKey = loadedQuery.value
    const owns = () => version === loadVersion.value && owner === ownerKey.value && queryKey === loadedQuery.value
    const page = pagesLoaded.value + 1
    moreLoading.value = true
    moreError.value = null
    try {
      const result = await repo.listPublicPage(buildPageQuery(page, publicFilter.value))
      if (!owns()) return
      // 翻页期间有新发布会让偏移整体后移，按编号去重后再追加
      const seen = new Set(notes.value.map((note) => note.id))
      notes.value = [...notes.value, ...result.items.filter((note) => isPublicNote(note) && !seen.has(note.id))]
      total.value = result.total
      pagesLoaded.value = page
    } catch (e) {
      if (owns()) moreError.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (owns()) moreLoading.value = false
    }
  }

  const actions = useFlashActions({
    app,
    repo,
    currentUser,
    isLoggedIn,
    contentOwnerId,
    ownerKey,
    notes,
    loaded,
    overview: overviewState.overview,
    pagedPublic,
    overviewLoaded: overviewState.overviewLoaded,
    shouldSeedLocally,
    load,
    loadOverview: overviewState.loadOverview,
  })

  return {
    notes,
    loaded,
    loading,
    error,
    viewingScope,
    ownerKey,
    isReadOnly,
    pagedPublic,
    total,
    hasMore,
    moreLoading,
    moreError,
    overview: overviewState.overviewData,
    overviewLoaded: overviewState.overviewLoaded,
    overviewLoading: overviewState.overviewLoading,
    overviewError: overviewState.overviewError,
    overviewRetrying: overviewState.overviewRetrying,
    aggregatesReady: overviewState.aggregatesReady,
    totalCount: overviewState.totalCount,
    tagCloud: overviewState.tagCloud,
    monthlyCount: overviewState.monthlyCount,
    load,
    loadMore,
    loadOverview: overviewState.loadOverview,
    retryOverview: overviewState.retryOverview,
    setPublicFilter,
    ...actions,
  }
}
