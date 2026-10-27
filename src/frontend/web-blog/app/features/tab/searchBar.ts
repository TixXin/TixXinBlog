/**
 * @file searchBar.ts
 * @description 标签页搜索栏的纯逻辑：本地书签与分类命中、模糊搜索取前 5 项，外部搜索引擎名称与跳转地址
 * @author TixXin
 * @since 2026-10-27
 */
import Fuse from 'fuse.js'
import type { Translate } from '~/utils/format'
import type { TabSettings } from '~/composables/useTabSettings'
import type { Bookmark, BookmarkCategory } from './types'

export interface LocalHit {
  id: string
  title: string
  sub?: string
  icon?: string
  typeLabel: string
  source: 'bookmark' | 'category'
  payload: { url?: string; id?: string }
}

/** 书签在前、分类在后的全部可命中项 */
export function buildLocalHits(bookmarks: Bookmark[], categories: BookmarkCategory[], t: Translate): LocalHit[] {
  const bmList: LocalHit[] = bookmarks.map((b) => ({
    id: `bm-${b.id}`,
    title: b.name,
    sub: b.url,
    icon: b.icon,
    typeLabel: t('misc.tab.common.bookmark'),
    source: 'bookmark',
    payload: { url: b.url },
  }))
  const catList: LocalHit[] = categories.map((c) => ({
    id: `cat-${c.id}`,
    title: c.name,
    sub: t('misc.tab.common.category'),
    icon: c.icon,
    typeLabel: t('misc.tab.common.category'),
    source: 'category',
    payload: { id: c.id },
  }))
  return [...bmList, ...catList]
}

export function createLocalHitFuse(hits: LocalHit[]) {
  return new Fuse(hits, { keys: ['title', 'sub'], threshold: 0.4, ignoreLocation: true })
}

/** 空查询不显示命中，否则取模糊搜索前 5 项 */
export function searchLocalHits(fuse: Fuse<LocalHit>, query: string): LocalHit[] {
  const q = query.trim()
  if (!q) return []
  return fuse
    .search(q)
    .slice(0, 5)
    .map((r) => r.item)
}

export function searchEngineLabel(engine: TabSettings['searchEngine'], t: Translate): string {
  switch (engine) {
    case 'bing':
      return 'Bing'
    case 'duckduckgo':
      return 'DuckDuckGo'
    case 'baidu':
      return t('misc.tab.search.engine.baidu')
    case 'custom':
      return t('misc.tab.search.engine.custom')
    case 'google':
    default:
      return 'Google'
  }
}

/** 按设置的搜索引擎生成地址；自定义地址含 %s 时替换首个占位符，否则把关键词接在末尾 */
export function buildSearchUrl(s: Pick<TabSettings, 'searchEngine' | 'searchEngineCustomUrl'>, q: string): string {
  switch (s.searchEngine) {
    case 'bing':
      return `https://www.bing.com/search?q=${encodeURIComponent(q)}`
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
    case 'baidu':
      return `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
    case 'custom':
      if (s.searchEngineCustomUrl.includes('%s')) {
        return s.searchEngineCustomUrl.replace('%s', encodeURIComponent(q))
      }
      return `${s.searchEngineCustomUrl}${encodeURIComponent(q)}`
    case 'google':
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(q)}`
  }
}

/** 提交时打开的地址：以 http(s) 开头的输入直接打开，其他交给搜索引擎；空白不提交 */
export function searchTarget(settings: Pick<TabSettings, 'searchEngine' | 'searchEngineCustomUrl'>, query: string) {
  const q = query.trim()
  if (!q) return null
  if (/^https?:\/\//i.test(q)) return q
  return buildSearchUrl(settings, q)
}
