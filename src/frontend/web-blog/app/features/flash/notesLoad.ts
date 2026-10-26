/** @file notesLoad.ts @description 闪念列表读取：新鲜度判定、公开分页按已展示范围重新核对、整表读取与本地演示补种 */
import type { FlashNote } from './types'
import { defaultFlashNoteSeeds, FLASH_SEEDS_VERSION } from './mock'
import { FLASH_PUBLIC_PAGE_SIZE } from './state'
import { type FlashPublicFilter, buildPageQuery, isPublicNote, isUnfiltered } from './publicFilter'
import { ensureSeedsUpToDate } from './seed'
import { flashLoadFreshness } from './notesFreshness'
import type { FlashNotesSession } from './notesSession'

type Repo = FlashNotesSession['repo']
type PublicPages = { notes: FlashNote[]; count: number; read: number }
type Plan = { nextScope: 'self' | 'owner'; paged: boolean; queryKey: string; sameQuery: boolean }
type Readers = {
  readPaged: (plan: Plan, ownsLoad: () => boolean) => Promise<void>
  readList: (plan: Plan, targetUserId: string, ownsLoad: () => boolean) => Promise<void>
}

/** 逐页读取至已展示的页数；归属失效时返回 null，由调用方直接放弃本次结果。须经仓储对象调用以保留方法绑定 */
async function readPublicPages(
  repo: Repo,
  query: { filter: Required<FlashPublicFilter>; pageCount: number },
  ownsLoad: () => boolean,
): Promise<PublicPages | null> {
  const collected = new Map<string, FlashNote>()
  let count = 0
  let read = 0
  for (let page = 1; page <= query.pageCount; page++) {
    const result = await repo.listPublicPage!(buildPageQuery(page, query.filter))
    if (!ownsLoad()) return null
    result.items.filter(isPublicNote).forEach((note) => collected.set(note.id, note))
    count = result.total
    read = page
    if (!result.items.length || page * FLASH_PUBLIC_PAGE_SIZE >= result.total) break
  }
  return { notes: [...collected.values()], count, read }
}

/** 本地演示仓库：首次为空时注入种子并记录版本，否则补齐新版本种子；之后重新读取整表 */
async function seedLocalNotes(repo: Repo, targetUserId: string, list: FlashNote[]): Promise<FlashNote[]> {
  if (list.length === 0) {
    for (const draft of defaultFlashNoteSeeds) {
      await repo.create(targetUserId, draft)
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`flash:seeds:version:${targetUserId}`, String(FLASH_SEEDS_VERSION))
    }
  } else await ensureSeedsUpToDate(repo, targetUserId)
  return repo.list(targetUserId)
}

export function createFlashNotesLoader(s: FlashNotesSession) {
  const { repo, notes, loaded, total, pagesLoaded, loadedQuery, loadedAt, invalidated, viewingScope } = s
  const loadVersion = useState('flash-load-version', () => 0)
  function markLoaded(plan: Plan) {
    loadedQuery.value = plan.queryKey
    viewingScope.value = plan.nextScope
    loaded.value = true
    loadedAt.value = Date.now()
    invalidated.value = false
  }
  async function readPaged(plan: Plan, ownsLoad: () => boolean) {
    const filter = { ...s.publicFilter.value }
    // 重新验证时核对已展示的完整范围，避免回访后只剩第一页
    const pageCount = plan.sameQuery && loaded.value ? Math.max(1, pagesLoaded.value) : 1
    const pages = await readPublicPages(repo, { filter, pageCount }, ownsLoad)
    if (!pages) return
    notes.value = pages.notes
    total.value = pages.count
    pagesLoaded.value = pages.read
    loadedQuery.value = plan.queryKey
    if (isUnfiltered(filter)) s.publicTotal.value = pages.count
    if (import.meta.server) s.serverRendered.value = true
    markLoaded(plan)
  }
  async function readList(plan: Plan, targetUserId: string, ownsLoad: () => boolean) {
    let list = await repo.list(targetUserId)
    if (!ownsLoad()) return
    if (s.shouldSeedLocally) list = await seedLocalNotes(repo, targetUserId, list)
    if (!ownsLoad()) return
    notes.value = plan.nextScope === 'owner' ? list.filter(isPublicNote) : list
    total.value = notes.value.length
    pagesLoaded.value = 0
    markLoaded(plan)
  }
  return { loadVersion, ...createFlashLoad(s, loadVersion, { readPaged, readList }) }
}

function createFlashLoad(s: FlashNotesSession, loadVersion: Ref<number>, readers: Readers) {
  const { notes, loaded, total, pagesLoaded, loading, error, ownerKey } = s
  /** 本次读取的身份、查询与新鲜度，全部在请求前同步算出 */
  function planLoad() {
    const nextScope: 'self' | 'owner' = s.isLoggedIn.value ? 'self' : 'owner'
    const paged = s.pagedPublic.value
    const queryKey = paged ? s.publicQueryKey.value : ''
    const sameQuery = s.loadedQuery.value === queryKey
    const age = Date.now() - s.loadedAt.value
    const freshness = flashLoadFreshness({
      sameQuery,
      invalidated: s.invalidated.value,
      shouldSeedLocally: s.shouldSeedLocally,
      age,
      timedPublicRead: nextScope === 'owner' && !s.shouldSeedLocally,
    })
    return { nextScope, paged, queryKey, sameQuery, ...freshness }
  }
  /**
   * 加载笔记列表。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的闪念列表，同样支持 seed
   */
  async function load(force = false, options: { rethrow?: boolean } = {}) {
    s.synchronizeOwner()
    const owner = ownerKey.value
    const targetUserId = s.contentOwnerId.value
    const { fresh, stale, ...plan } = planLoad()
    if (loaded.value && !force && fresh) return

    const version = ++loadVersion.value
    const ownsLoad = () => version === loadVersion.value && owner === ownerKey.value
    // 私有实体仍由原仓储接纳写入；公开数据超过 5 分钟、已撤销或换了查询条件时不再展示旧结果。
    if (stale) {
      notes.value = []
      loaded.value = false
      total.value = 0
      pagesLoaded.value = 0
    }
    loading.value = true
    error.value = null
    s.moreLoading.value = false
    s.moreError.value = null
    try {
      if (plan.paged && s.repo.listPublicPage) await readers.readPaged(plan, ownsLoad)
      else await readers.readList(plan, targetUserId, ownsLoad)
    } catch (e) {
      if (ownsLoad()) error.value = e instanceof Error ? e.message : String(e)
      if (options.rethrow) throw e
    } finally {
      if (ownsLoad()) loading.value = false
    }
  }
  return { load }
}
