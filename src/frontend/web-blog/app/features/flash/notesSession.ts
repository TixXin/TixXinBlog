/** @file notesSession.ts @description 闪念列表的共享状态与身份归属：SSR 下发的列表与分页状态、公开查询条件与换身份时的同步清理 */
import type { ComputedRef } from 'vue'
import type { FlashNote } from './types'
import { mockOwnerUser } from '../auth/mock'
import { FLASH_PUBLIC_PAGE_SIZE, invalidateFlashNotes } from './state'
import { type FlashPublicFilter, filterKey } from './publicFilter'

/** 跨组件共享的列表状态；公开分页状态随 SSR payload 下发，水合时不重复请求首屏 */
function useFlashNotesStore() {
  return {
    notes: useState<FlashNote[]>('flash-notes', () => []),
    loaded: useState<boolean>('flash-notes-loaded', () => false),
    loading: useState<boolean>('flash-notes-loading', () => false),
    error: useState<string | null>('flash-notes-error', () => null),
    loadedAt: useState('flash-notes-loaded-at', () => 0),
    invalidated: useState('flash-notes-invalidated', () => false),
    loadedOwner: useState('flash-notes-owner', () => ''),
    total: useState('flash-notes-total', () => 0),
    pagesLoaded: useState('flash-notes-pages', () => 0),
    loadedQuery: useState('flash-notes-query', () => ''),
    publicTotal: useState<number | null>('flash-public-total', () => null),
    serverRendered: useState('flash-notes-ssr', () => false),
    moreLoading: useState('flash-more-loading', () => false),
    moreError: useState<string | null>('flash-more-error', () => null),
  }
}

export function createFlashNotesSession() {
  const app = useNuxtApp()
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  // 本地演示数据归属站点所有者；真实管理员 UUID 不应创建第二份重复的站点数据。
  const contentOwnerId = computed(() =>
    currentUser.value?.role === 'owner' ? mockOwnerUser.id : (currentUser.value?.id ?? mockOwnerUser.id),
  )
  // HTTP 模式下种子由后端 DevSeeder 负责，前端不再补种（create 是管理员能力）
  const shouldSeedLocally = useRuntimeConfig().public.useMockRepo !== false
  const store = useFlashNotesStore()
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
    if (store.loadedOwner.value === ownerKey.value) return
    invalidateFlashNotes(app, { clear: true })
    store.loadedOwner.value = ownerKey.value
    viewingScope.value = isLoggedIn.value ? 'self' : 'owner'
  }
  // 重新挂载时在首次渲染前清理旧身份；活动页面的身份变化也不能等待异步请求再隐藏草稿。
  synchronizeOwner()
  watch(ownerKey, synchronizeOwner, { flush: 'sync' })
  const identity = { app, repo, currentUser, isLoggedIn, contentOwnerId, shouldSeedLocally, ownerKey }
  const query = { publicFilter, publicQueryKey, viewingScope, synchronizeOwner }
  return { ...store, ...identity, ...query, ...createFlashPagingFlags(store, repo, isLoggedIn) }
}

export type FlashNotesSession = ReturnType<typeof createFlashNotesSession>

function createFlashPagingFlags(
  store: ReturnType<typeof useFlashNotesStore>,
  repo: ReturnType<typeof useFlashRepository>,
  isLoggedIn: ComputedRef<boolean>,
) {
  const { loaded, pagesLoaded, total } = store
  /** 是否处于只读模式：未登录时只能浏览博主的闪念 */
  const isReadOnly = computed(() => !isLoggedIn.value)
  /** 未登录且仓库支持单页读取时按页加载；登录后的私有视图与本地演示仓库保持整表读取 */
  const pagedPublic = computed(() => !isLoggedIn.value && typeof repo.listPublicPage === 'function')
  const hasMore = computed(
    () => pagedPublic.value && loaded.value && pagesLoaded.value * FLASH_PUBLIC_PAGE_SIZE < total.value,
  )
  return { isReadOnly, pagedPublic, hasMore }
}
