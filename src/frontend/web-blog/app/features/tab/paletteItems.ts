/**
 * @file paletteItems.ts
 * @description 标签页命令面板的条目模型：书签、分类与动作合并为统一条目，模糊搜索、按来源分组，以及方向键与 Enter、Esc 的选择规则
 * @author TixXin
 * @since 2026-10-27
 */
import Fuse from 'fuse.js'
import type { Translate } from '~/utils/format'
import type { Bookmark, BookmarkCategory } from './types'

export interface CommandAction {
  id: string
  title: string
  subtitle?: string
  icon: string
  shortcut?: string
  section: 'actions'
  run: () => void | Promise<void>
}

export interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  icon: string
  shortcut?: string
  source: 'bookmark' | 'category' | 'action'
  payload: unknown
}

export interface PaletteSection {
  id: string
  label: string
  items: PaletteItem[]
}

/** 每次最多展示的条目数 */
const PALETTE_LIMIT = 30

/** 把书签/分类/动作合并为统一 item，动作在前 */
export function buildPaletteItems(
  bookmarks: Bookmark[],
  categories: BookmarkCategory[],
  actions: CommandAction[],
  t: Translate,
): PaletteItem[] {
  const bmItems: PaletteItem[] = bookmarks.map((b) => ({
    id: `bm-${b.id}`,
    title: b.name,
    subtitle: b.url,
    icon: b.icon?.startsWith('lucide:') ? b.icon : 'lucide:bookmark',
    source: 'bookmark',
    payload: b,
  }))
  const catItems: PaletteItem[] = categories.map((c) => ({
    id: `cat-${c.id}`,
    title: c.name,
    subtitle: t('misc.tab.common.category'),
    icon: c.icon || 'lucide:folder',
    source: 'category',
    payload: c,
  }))
  const actItems: PaletteItem[] = actions.map((a) => ({
    id: `act-${a.id}`,
    title: a.title,
    subtitle: a.subtitle,
    icon: a.icon,
    shortcut: a.shortcut,
    source: 'action',
    payload: a,
  }))
  return [...actItems, ...bmItems, ...catItems]
}

export function createPaletteFuse(items: PaletteItem[]) {
  return new Fuse(items, { keys: ['title', 'subtitle'], threshold: 0.4, ignoreLocation: true })
}

/** 空查询取前 30 项，否则按模糊搜索排名取前 30 项 */
export function filterPaletteItems(items: PaletteItem[], fuse: Fuse<PaletteItem>, query: string): PaletteItem[] {
  const q = query.trim()
  if (!q) return items.slice(0, PALETTE_LIMIT)
  return fuse
    .search(q)
    .slice(0, PALETTE_LIMIT)
    .map((r) => r.item)
}

/** 分段组织结果：动作、书签、分类，空组不出现 */
export function groupPaletteSections(items: PaletteItem[], t: Translate): PaletteSection[] {
  const actions: PaletteItem[] = []
  const bmList: PaletteItem[] = []
  const catList: PaletteItem[] = []
  for (const it of items) {
    if (it.source === 'action') actions.push(it)
    else if (it.source === 'bookmark') bmList.push(it)
    else catList.push(it)
  }
  const sections: PaletteSection[] = []
  if (actions.length > 0) sections.push({ id: 'actions', label: t('misc.tab.palette.sectionActions'), items: actions })
  if (bmList.length > 0) sections.push({ id: 'bookmarks', label: t('misc.tab.common.bookmark'), items: bmList })
  if (catList.length > 0) sections.push({ id: 'categories', label: t('misc.tab.common.category'), items: catList })
  return sections
}

/** 读屏播报的当前选择 */
export function paletteSelectionStatus(items: PaletteItem[], focusedId: string | null, t: Translate) {
  const index = items.findIndex((item) => item.id === focusedId)
  const item = items[index]
  return item
    ? t('misc.tab.palette.selectionStatus', { index: index + 1, total: items.length, title: item.title })
    : t('misc.tab.palette.empty')
}

export type PaletteKeyAction = { kind: 'move'; index: number } | { kind: 'run'; index: number } | { kind: 'close' }

/** 按键对应的操作：上下键循环移动（未选中时向上落到末项），Enter 执行当前项，Esc 关闭；其他键不处理 */
export function paletteKeyAction(key: string, index: number, total: number): PaletteKeyAction | null {
  if (key === 'ArrowDown') return { kind: 'move', index: (index + 1) % total }
  if (key === 'ArrowUp') return { kind: 'move', index: index < 0 ? total - 1 : (index - 1 + total) % total }
  if (key === 'Enter') return { kind: 'run', index }
  if (key === 'Escape') return { kind: 'close' }
  return null
}
