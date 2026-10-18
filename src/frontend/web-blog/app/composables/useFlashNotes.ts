/**
 * @file useFlashNotes.ts
 * @description 闪念业务 composable：列表加载、增删改、首次 seed、tag 聚合
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 所有数据操作都委托给 FlashNoteRepository，本文件不直接读写 localStorage
 * - 跨页面通过 useState 共享实体列表，公开回访按 30 秒新鲜期重新验证
 * - 真实接口的公开视图按页读取：SSR 直出第一页，后续页按需追加；标签、类型、UTC 日期与关键词均交给后端分页，
 *   侧栏聚合（日历、统计、标签云、时间胶囊）与访客已赞状态来自挂载后读取的公开概览接口（GET /flashes/overview）
 * - 未登录时回退展示博主（owner）的闪念列表（只读）；登录后切换到当前用户自己的列表
 * - 写操作仅对登录用户开放，未登录触发 useLoginDrawer.open()
 */

import type { VisitorSubmissionFields } from '~/features/visitor/types'
import type {
  FlashComment,
  FlashNote,
  FlashNoteDraft,
  FlashOverview,
  FlashPublicPageQuery,
  FlashType,
} from '~/features/flash/types'
import { summarizeFlashNotes } from '~/features/flash/overview'
import { appendComment, withoutComment } from '~/features/flash/comments'
import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from '~/features/flash/mock'
import { mockOwnerUser } from '~/features/auth/mock'
import {
  FLASH_PUBLIC_FRESH_MS,
  FLASH_PUBLIC_PAGE_SIZE,
  FLASH_PUBLIC_STALE_MS,
  invalidateFlashNotes,
} from '~/features/flash/state'

/** 公开分页的服务端条件：可任意组合，全部为空表示全部公开闪念 */
export interface FlashPublicFilter {
  tag: string | null
  q: string
  type?: FlashType | null
  /** UTC 日（YYYY-MM-DD） */
  date?: string | null
}

/** 规范化筛选条件，空值统一为 null / 空串，便于比较与生成查询键 */
function normalizeFilter(filter: FlashPublicFilter): Required<FlashPublicFilter> {
  return { tag: filter.tag || null, q: filter.q.trim(), type: filter.type || null, date: filter.date || null }
}
const filterKey = (filter: Required<FlashPublicFilter>) =>
  JSON.stringify([filter.tag, filter.q, filter.type, filter.date])
const isUnfiltered = (filter: Required<FlashPublicFilter>) => !filter.tag && !filter.q && !filter.type && !filter.date

const isPublicNote = (note: FlashNote) => !note.isDraft && !note.isArchived

/**
 * 增量补种：seed 版本升级时，把当前 list 里没有的 seed id 补进 storage。
 * 已存在的 id 跳过（保留用户对该条目的修改/删除/归档），归档项也算"已存在"。
 * 一次性，写入版本号后下次 load 直接跳过。
 */
async function ensureSeedsUpToDate(repo: ReturnType<typeof useFlashRepository>, userId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const versionKey = `flash:seeds:version:${userId}`
  const localVersion = Number(window.localStorage.getItem(versionKey) ?? '0')
  if (localVersion >= FLASH_SEEDS_VERSION) return

  const [active, archived] = await Promise.all([repo.list(userId), repo.listArchived(userId)])
  const existingIds = new Set([...active, ...archived].map((n) => n.id))
  for (const draft of defaultFlashNoteSeeds) {
    if (draft.id && !existingIds.has(draft.id)) {
      await repo.create(userId, draft)
    }
  }
  window.localStorage.setItem(versionKey, String(FLASH_SEEDS_VERSION))
}

export function useFlashNotes() {
  const app = useNuxtApp()
  const repo = useFlashRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  // 本地演示数据归属站点所有者；真实管理员 UUID 不应创建第二份重复的站点数据。
  const contentOwnerId = computed(() =>
    currentUser.value?.role === 'owner' ? mockOwnerUser.id : (currentUser.value?.id ?? mockOwnerUser.id),
  )
  const { open: openLoginDrawer } = useLoginDrawer()
  // HTTP 模式下种子由后端 DevSeeder 负责,前端不再补种(create 是管理员能力)
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
  // 公开概览：仅客户端读取，用于侧栏聚合与访客已赞状态，不进入 SSR payload
  const overview = useState<FlashOverview | null>('flash-overview', () => null)
  const overviewLoaded = useState('flash-overview-loaded', () => false)
  const overviewLoading = useState('flash-overview-loading', () => false)
  const overviewError = useState<string | null>('flash-overview-error', () => null)
  const overviewLoadedAt = useState('flash-overview-loaded-at', () => 0)
  const overviewVersion = useState('flash-overview-version', () => 0)
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

  function pageQuery(page: number, filter: Required<FlashPublicFilter>): FlashPublicPageQuery {
    return {
      page,
      pageSize: FLASH_PUBLIC_PAGE_SIZE,
      ...(filter.tag ? { tag: filter.tag } : {}),
      ...(filter.q ? { q: filter.q } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.date ? { date: filter.date } : {}),
    }
  }

  /**
   * 加载笔记列表。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的闪念列表，同样支持 seed
   */
  const loadVersion = useState('flash-load-version', () => 0)
  /**
   * @param options.rethrow SSR 首屏需要把上游失败交给 AsyncData，降级页才会以 503 返回而不进入页面缓存
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
          const result = await repo.listPublicPage(pageQuery(page, filter))
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
          // 全新用户：全量 seed
          for (const draft of defaultFlashNoteSeeds) {
            await repo.create(targetUserId, draft)
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`flash:seeds:version:${targetUserId}`, String(FLASH_SEEDS_VERSION))
          }
          list = await repo.list(targetUserId)
        } else {
          // 老用户：按版本增量补种新增的 seed id（不动用户已修改/删除/归档的）
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
      const result = await repo.listPublicPage(pageQuery(page, publicFilter.value))
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

  /** 按概览中的已赞编号补齐列表的个人点赞状态（SSR 首屏不带访客身份） */
  function applyLiked(likedIds: string[]) {
    const liked = new Set(likedIds)
    notes.value = notes.value.map((note) =>
      !!note.liked === liked.has(note.id) ? note : { ...note, liked: liked.has(note.id) },
    )
  }

  /**
   * 读取公开概览（一次聚合请求）：侧栏日历、统计、时间胶囊与标签云，以及首屏缺少的个人点赞状态。
   * 只在客户端挂载后调用，不阻塞首屏；30 秒内复用，写后失效或身份变化时作废在途结果。
   */
  async function loadOverview(force = false) {
    if (import.meta.server || !pagedPublic.value || !repo.overview) return
    const age = Date.now() - overviewLoadedAt.value
    if (overviewLoaded.value && !force && age >= 0 && age < FLASH_PUBLIC_FRESH_MS) return
    if (overviewLoading.value) return
    const version = ++overviewVersion.value
    const owner = ownerKey.value
    const owns = () => version === overviewVersion.value && owner === ownerKey.value
    overviewLoading.value = true
    overviewError.value = null
    try {
      const result = await repo.overview()
      if (!owns()) return
      overview.value = result
      overviewLoaded.value = true
      overviewLoadedAt.value = Date.now()
      applyLiked(result.likedIds)
    } catch (e) {
      if (owns()) overviewError.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (owns()) overviewLoading.value = false
    }
  }

  function assertOwner(owner: string) {
    if (owner !== ownerKey.value) throw new Error('闪念所属身份或内容库已变化，请重新核对后操作')
  }
  function acceptWrite(owner: string, apply: (current: FlashNote[]) => FlashNote[]) {
    assertOwner(owner)
    invalidateFlashNotes(app)
    notes.value = apply(notes.value)
    // 写入先完成而首次列表仍在途中时，撤销旧响应后重新取得完整集合。
    if (!loaded.value) void load(true)
    // 在途概览随写入作废；尚未取得概览时重新读取，侧栏不停在空白
    if (pagedPublic.value && !overviewLoaded.value) void loadOverview(true)
  }

  /** 创建一条新闪念。未登录则打开登录弹窗。 */
  async function add(draft: FlashNoteDraft): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const created = await repo.create(contentOwnerId.value, draft)
    acceptWrite(owner, (current) => [created, ...current.filter((note) => note.id !== created.id)])
    return created
  }

  /** 更新指定闪念 */
  async function update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.update(id, patch)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    return updated
  }

  /** 删除指定闪念 */
  async function remove(id: string): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    const owner = ownerKey.value
    await repo.remove(id)
    acceptWrite(owner, (current) => current.filter((n) => n.id !== id))
    return true
  }

  /** 关键词搜索（基于当前展示的列表所属用户） */
  async function search(query: string): Promise<FlashNote[]> {
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const result = await repo.search(targetUserId, query)
    assertOwner(owner)
    return result
  }

  /**
   * 单独拉取博主（owner）的公开闪念列表，不影响主 notes 状态。
   * 详情页用：任何访客都能看到博主笔记，不受登录态影响。
   */
  async function fetchOwnerNotes(): Promise<FlashNote[]> {
    if (repo.listPublic) return repo.listPublic()
    let list = await repo.list(mockOwnerUser.id)
    if (shouldSeedLocally) {
      if (list.length === 0) {
        for (const draft of defaultFlashNoteSeeds) {
          await repo.create(mockOwnerUser.id, draft)
        }
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`flash:seeds:version:${mockOwnerUser.id}`, String(FLASH_SEEDS_VERSION))
        }
        list = await repo.list(mockOwnerUser.id)
      } else {
        await ensureSeedsUpToDate(repo, mockOwnerUser.id)
        list = await repo.list(mockOwnerUser.id)
      }
    }
    return list.filter((note) => !note.isDraft && !note.isArchived)
  }

  /**
   * 切换点赞 —— 游客也可操作，设备级每日去重由 UI 层（flash.vue）管理。
   * composable 层不再检查登录态，只负责数据读写。
   */
  async function toggleLike(id: string): Promise<boolean> {
    const owner = ownerKey.value
    const updated = await repo.toggleLike(id)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    // 概览中的已赞编号同步本次结果，翻到下一页或回访时不回退
    const current = overview.value
    if (pagedPublic.value && current) {
      const others = current.likedIds.filter((likedId) => likedId !== id)
      overview.value = { ...current, likedIds: updated.liked ? [...others, id] : others }
    }
    return true
  }

  /** 设置置顶态（仅登录者） */
  async function setPinned(id: string, pinned: boolean): Promise<FlashNote | null> {
    if (!isLoggedIn.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.setPinned(id, pinned)
    acceptWrite(owner, (current) => current.map((n) => (n.id === id ? updated : n)))
    return updated
  }

  /**
   * 归档指定闪念（仅登录者）。归档后 list() 不再返回，归档箱视图单独拉取。
   * unarchive（恢复）走 setArchived(false)。
   */
  async function setArchived(id: string, archived: boolean): Promise<FlashNote | null> {
    if (!isLoggedIn.value) {
      openLoginDrawer('login')
      return null
    }
    const owner = ownerKey.value
    const updated = await repo.setArchived(id, archived)
    acceptWrite(owner, (current) => {
      const remaining = current.filter((n) => n.id !== id)
      return archived ? remaining : [updated, ...remaining]
    })
    return updated
  }

  /** 加载归档箱列表，返回给 UI 单独展示，不污染主 notes 状态 */
  async function loadArchived(): Promise<FlashNote[]> {
    const owner = ownerKey.value
    const targetUserId = contentOwnerId.value
    const result = await repo.listArchived(targetUserId)
    assertOwner(owner)
    return result
  }

  /**
   * 添加评论 —— 支持登录用户和游客两种身份来源。
   * 登录用户自动取 currentUser 信息；游客由调用方传入 guestAuthor。
   * 若两者都没有则返回 null，由 UI 层决定是否弹出身份录入面板。
   */
  async function addComment(
    noteId: string,
    content: string,
    guestAuthor?: { id: string; name: string; avatar: string },
    fields: VisitorSubmissionFields = {},
  ): Promise<FlashComment | null> {
    let authorId: string
    let authorName: string
    let authorAvatar: string

    if (isLoggedIn.value && currentUser.value) {
      authorId = currentUser.value.id
      authorName = currentUser.value.nickname
      authorAvatar = currentUser.value.avatar
    } else if (guestAuthor) {
      authorId = guestAuthor.id
      authorName = guestAuthor.name
      authorAvatar = guestAuthor.avatar
    } else {
      // 无身份 → UI 层弹出身份录入
      return null
    }

    const owner = ownerKey.value
    const created = await repo.addComment(noteId, {
      ...fields,
      authorId,
      authorName,
      authorAvatar,
      content,
    })
    acceptWrite(owner, (current) => current.map((n) => (n.id === noteId ? appendComment(n, created) : n)))
    return created
  }

  /**
   * 删除评论 —— 不再强制登录，游客也能删除自己发的评论。
   * 权限校验在 UI 层通过 canDeleteComment 完成（匹配 currentUserId 或 guestId）。
   */
  async function removeComment(noteId: string, commentId: string): Promise<boolean> {
    const owner = ownerKey.value
    await repo.removeComment(noteId, commentId)
    acceptWrite(owner, (current) => current.map((n) => (n.id === noteId ? withoutComment(n, commentId) : n)))
    return true
  }

  /** 侧栏聚合：公开分页视图用概览接口，私有视图与本地演示由已持有的完整集合计算 */
  const overviewData = computed<FlashOverview | null>(() => {
    if (pagedPublic.value) return overview.value
    return loaded.value ? summarizeFlashNotes(notes.value) : null
  })
  const aggregatesReady = computed(() => (pagedPublic.value ? overviewLoaded.value : loaded.value))
  /** 公开闪念总数：概览就绪前用首屏分页返回的总数 */
  const totalCount = computed<number | null>(() => {
    if (!pagedPublic.value) return loaded.value ? notes.value.length : null
    return overview.value?.total ?? publicTotal.value
  })

  /** 标签聚合：按出现次数倒序 */
  const tagCloud = computed<{ name: string; count: number }[]>(() => overviewData.value?.tags ?? [])

  /** 本月（UTC）新增数量 */
  const monthlyCount = computed(() => overviewData.value?.monthCount ?? 0)

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
    overview: overviewData,
    overviewLoaded,
    overviewLoading,
    overviewError,
    aggregatesReady,
    totalCount,
    tagCloud,
    monthlyCount,
    load,
    loadMore,
    loadOverview,
    setPublicFilter,
    add,
    update,
    remove,
    search,
    fetchOwnerNotes,
    toggleLike,
    setPinned,
    setArchived,
    loadArchived,
    addComment,
    removeComment,
  }
}
