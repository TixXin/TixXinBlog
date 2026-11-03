/**
 * @file postSearch.ts
 * @description 静态站的文章搜索：在列表全量与构建时导出的正文索引上匹配，规则与后端一致——
 * 标题、摘要、标签名与原始 Markdown 正文任一包含关键词（不区分大小写的子串），不匹配封面地址、slug 等其他字段；
 * 其余筛选与分页沿用列表回退，正文命中的条目按后端同一规则附上 contentMatch。
 * @author TixXin
 * @since 2026-11-03
 */
import { contentMatchWindow } from '~/features/search/contentMatch'
import { TEXT_QUERY_PARAMS, frozenAllKey, frozenCorpusKey } from './frozenApi'
import { staticFetchError, type LoadFrozen } from './staticFetch'
import { filterFrozenList } from './textQuery'

type Item = Record<string, unknown>
type Envelope = { data?: { items?: Item[] } }

function tagLabels(item: Item): string[] {
  return Array.isArray(item.tags)
    ? item.tags.map((tag) => (tag && typeof tag === 'object' ? String((tag as Item).label ?? '') : String(tag)))
    : []
}

/** 与后端 buildPostWhere 的 $or 条件逐项对应 */
export function postMatches(item: Item, contentRaw: string | undefined, keyword: string) {
  const needle = keyword.toLowerCase()
  const fields = [item.title, item.summary, contentRaw, ...tagLabels(item)]
  return fields.some((value) => typeof value === 'string' && value.toLowerCase().includes(needle))
}

/** 在文章全量与正文索引上按关键词过滤，再交给列表回退处理其余筛选与分页 */
export function searchFrozenPosts(key: string, items: Item[], corpus: Map<string, string>) {
  const [path = '', search = ''] = key.split('?', 2)
  const params = new URLSearchParams(search)
  const keyword = TEXT_QUERY_PARAMS.map((name) => (params.get(name) ?? '').trim()).find(Boolean) ?? ''
  for (const name of TEXT_QUERY_PARAMS) params.delete(name)
  const matched = items.filter((item) => postMatches(item, corpus.get(String(item.id)), keyword))
  const page = filterFrozenList(params.size ? `${path}?${params}` : path, matched)
  return {
    ...page,
    items: page.items.map((item) => {
      const contentMatch = contentMatchWindow(corpus.get(String(item.id)), keyword)
      return contentMatch ? { ...item, contentMatch } : item
    }),
  }
}

async function loadItems(load: LoadFrozen, key: string): Promise<Item[]> {
  const response = await load(key)
  const envelope = response.ok ? ((await response.json()) as Envelope) : undefined
  if (!Array.isArray(envelope?.data?.items)) throw staticFetchError(404, '静态站点没有文章的搜索数据')
  return envelope.data.items
}

export async function postSearchFallback(key: string, load: LoadFrozen) {
  const [items, bodies] = await Promise.all([
    loadItems(load, frozenAllKey('/posts')),
    loadItems(load, frozenCorpusKey('/posts')),
  ])
  const corpus = new Map(bodies.map((body) => [String(body.id), String(body.contentRaw ?? '')]))
  return new Response(JSON.stringify({ code: 0, message: 'ok', data: searchFrozenPosts(key, items, corpus) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
