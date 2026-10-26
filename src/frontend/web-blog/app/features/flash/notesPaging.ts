/** @file notesPaging.ts @description 闪念公开分页：切换服务端筛选条件与追加下一页，迟到结果按查询、身份与读取代次丢弃 */
import { type FlashPublicFilter, buildPageQuery, filterKey, isPublicNote, normalizeFilter } from './publicFilter'
import type { FlashNotesSession } from './notesSession'

export function createFlashPublicPaging(s: FlashNotesSession, loadVersion: Ref<number>, load: () => Promise<void>) {
  const { repo, notes, loadedQuery, publicQueryKey, moreLoading, moreError, ownerKey } = s
  /** 切换公开分页的服务端条件；条件不变时不重复请求 */
  function setPublicFilter(next: FlashPublicFilter) {
    const normalized = normalizeFilter(next)
    if (filterKey(normalized) === publicQueryKey.value) return
    s.publicFilter.value = normalized
    if (s.pagedPublic.value) void load()
  }

  /** 追加下一页公开闪念；查询、身份或读取代次变化后迟到的结果直接丢弃 */
  async function loadMore() {
    if (!s.hasMore.value || s.loading.value || moreLoading.value || !repo.listPublicPage) return
    if (loadedQuery.value !== publicQueryKey.value) return
    const version = loadVersion.value
    const owner = ownerKey.value
    const queryKey = loadedQuery.value
    const owns = () => version === loadVersion.value && owner === ownerKey.value && queryKey === loadedQuery.value
    const page = s.pagesLoaded.value + 1
    moreLoading.value = true
    moreError.value = null
    try {
      const result = await repo.listPublicPage(buildPageQuery(page, s.publicFilter.value))
      if (!owns()) return
      // 翻页期间有新发布会让偏移整体后移，按编号去重后再追加
      const seen = new Set(notes.value.map((note) => note.id))
      notes.value = [...notes.value, ...result.items.filter((note) => isPublicNote(note) && !seen.has(note.id))]
      s.total.value = result.total
      s.pagesLoaded.value = page
    } catch (e) {
      if (owns()) moreError.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (owns()) moreLoading.value = false
    }
  }
  return { setPublicFilter, loadMore }
}
