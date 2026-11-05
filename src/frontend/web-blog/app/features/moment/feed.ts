/**
 * @file feed.ts
 * @description 公开动态流的分页常量与键集游标：页面每页条数、深页码一次读取的页数，以及由动态算出的续读游标。
 * @author TixXin
 * @since 2026-11-06
 */
import type { MomentItem, MomentPage, MomentQuery } from './types'

/** 动态流每页条数；地址栏 ?page=N 按它换算 */
export const MOMENT_FEED_PAGE_SIZE = 15
/** 直接打开深页码时一次读取的页数（后端公开列表单次上限 150 条） */
export const MOMENT_FEED_BATCH_PAGES = 10

/** 续读游标：与后端 `<置顶 0|1>.<编号>` 格式一致，从这条之后读取 */
export function momentCursor(item: Pick<MomentItem, 'id' | 'isPinned'> | undefined) {
  return item ? `${item.isPinned ? 1 : 0}.${item.id}` : undefined
}

/** 页数按总数换算，空列表也算一页 */
export function momentFeedPages(total: number) {
  return Math.max(1, Math.ceil(total / MOMENT_FEED_PAGE_SIZE))
}

/**
 * 读取动态流到 targetPage：追加时从游标之后读一页（翻页期间有新发布或删除也不重复、不漏）；
 * 直接打开深页码时每次读 MOMENT_FEED_BATCH_PAGES 页，后续批次同样按游标续读，不逐页串行请求。
 * 页码与页大小保持一致的偏移，游标锚点失效时后端按页码读取，结果仍落在同一位置。
 * 读到的编号按页写入 pages，返回本次的新条目、总数与最后一条的游标。
 */
export async function readMomentFeedPages(input: {
  list: (query: Pick<MomentQuery, 'page' | 'pageSize' | 'after'>) => Promise<MomentPage>
  signal: AbortSignal
  targetPage: number
  startPage: number
  cursor: string | undefined
  count: number | null
  pages: Map<number, string[]>
}) {
  const { list, signal, targetPage, pages } = input
  const items: MomentItem[] = []
  let { cursor, count } = input
  const appending = input.startPage > 1 && !!cursor
  for (let next = input.startPage; next <= targetPage;) {
    if (signal.aborted) throw new DOMException('动态读取已取消', 'AbortError')
    if (count !== null && next > momentFeedPages(count)) break
    const span = appending ? 1 : next === 1 ? Math.min(MOMENT_FEED_BATCH_PAGES, targetPage) : MOMENT_FEED_BATCH_PAGES
    const data = await list({
      page: (next - 1) / span + 1,
      pageSize: MOMENT_FEED_PAGE_SIZE * span,
      ...(cursor ? { after: cursor } : {}),
    })
    count = data.total
    const wanted = Math.min(span, targetPage - next + 1) * MOMENT_FEED_PAGE_SIZE
    const batch = data.items.slice(0, wanted)
    for (let offset = 0; offset === 0 || offset < batch.length; offset += MOMENT_FEED_PAGE_SIZE)
      pages.set(
        next + offset / MOMENT_FEED_PAGE_SIZE,
        batch.slice(offset, offset + MOMENT_FEED_PAGE_SIZE).map((item) => item.id),
      )
    items.push(...batch)
    cursor = momentCursor(batch.at(-1)) ?? cursor
    if (batch.length < wanted) break
    next += span
  }
  return { items, count: count ?? 0, cursor }
}
