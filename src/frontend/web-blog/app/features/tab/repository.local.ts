/**
 * @file repository.local.ts
 * @description TabBookmarkRepository 的 LocalStorage 实现，mock 阶段使用
 * @author TixXin
 * @since 2026-04-11
 *
 * 存储 key：
 * - `tab:categories:${userId}` → JSON 数组（BookmarkCategory[]）
 * - `tab:bookmarks:${userId}`  → JSON 数组（Bookmark[]）
 *
 * SSR 安全：在 typeof window === 'undefined' 时所有读返回空、写为 no-op。
 */

import type { TabBookmarkRepository } from './repository'
import type {
  Bookmark,
  BookmarkCategory,
  BookmarkCategoryDraft,
  BookmarkDraft,
  BookmarkReorderUpdate,
  CategoryReorderUpdate,
  ImportMode,
  ImportPayload,
} from './types'

const CATEGORY_PREFIX = 'tab:categories:'
const BOOKMARK_PREFIX = 'tab:bookmarks:'

function categoryKey(userId: string): string {
  return `${CATEGORY_PREFIX}${userId}`
}

function bookmarkKey(userId: string): string {
  return `${BOOKMARK_PREFIX}${userId}`
}

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeJson<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 容量超限或被禁用 → 静默失败
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class LocalTabRepository implements TabBookmarkRepository {
  listCategories(userId: string): Promise<BookmarkCategory[]> {
    const categories = readJson<BookmarkCategory>(categoryKey(userId))
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    return Promise.resolve(sorted)
  }

  listBookmarks(userId: string): Promise<Bookmark[]> {
    const bookmarks = readJson<Bookmark>(bookmarkKey(userId))
    const sorted = [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder)
    return Promise.resolve(sorted)
  }

  createCategory(userId: string, draft: BookmarkCategoryDraft): Promise<BookmarkCategory> {
    const categories = readJson<BookmarkCategory>(categoryKey(userId))
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0)
    const next: BookmarkCategory = {
      id: generateId('cat'),
      userId,
      name: draft.name,
      icon: draft.icon,
      color: draft.color,
      sortOrder: maxOrder + 1,
    }
    categories.push(next)
    writeJson(categoryKey(userId), categories)
    return Promise.resolve(next)
  }

  updateCategory(id: string, patch: Partial<BookmarkCategoryDraft>): Promise<BookmarkCategory> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('LocalTabRepository.updateCategory called on server'))
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(CATEGORY_PREFIX)) continue
      const categories = readJson<BookmarkCategory>(key)
      const idx = categories.findIndex((c) => c.id === id)
      if (idx === -1) continue
      const original = categories[idx]!
      const next: BookmarkCategory = {
        ...original,
        name: patch.name ?? original.name,
        icon: patch.icon ?? original.icon,
        color: patch.color ?? original.color,
      }
      categories[idx] = next
      writeJson(key, categories)
      return Promise.resolve(next)
    }
    return Promise.reject(new Error(`BookmarkCategory ${id} not found`))
  }

  removeCategory(id: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(CATEGORY_PREFIX)) continue
      const userId = key.slice(CATEGORY_PREFIX.length)
      const categories = readJson<BookmarkCategory>(key)
      const filtered = categories.filter((c) => c.id !== id)
      if (filtered.length === categories.length) continue

      writeJson(key, filtered)
      // 同步删除该分类下的所有书签
      const bmKey = bookmarkKey(userId)
      const bookmarks = readJson<Bookmark>(bmKey)
      writeJson(
        bmKey,
        bookmarks.filter((b) => b.categoryId !== id),
      )
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  createBookmark(userId: string, draft: BookmarkDraft): Promise<Bookmark> {
    const bookmarks = readJson<Bookmark>(bookmarkKey(userId))
    const sameCat = bookmarks.filter((b) => b.categoryId === draft.categoryId)
    const maxOrder = sameCat.reduce((m, b) => Math.max(m, b.sortOrder), 0)
    const next: Bookmark = {
      id: generateId('bm'),
      userId,
      name: draft.name,
      url: draft.url,
      icon: draft.icon,
      color: draft.color,
      categoryId: draft.categoryId,
      sortOrder: maxOrder + 1,
    }
    bookmarks.push(next)
    writeJson(bookmarkKey(userId), bookmarks)
    return Promise.resolve(next)
  }

  updateBookmark(id: string, patch: Partial<BookmarkDraft>): Promise<Bookmark> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('LocalTabRepository.updateBookmark called on server'))
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(BOOKMARK_PREFIX)) continue
      const bookmarks = readJson<Bookmark>(key)
      const idx = bookmarks.findIndex((b) => b.id === id)
      if (idx === -1) continue
      const original = bookmarks[idx]!
      const next: Bookmark = {
        ...original,
        name: patch.name ?? original.name,
        url: patch.url ?? original.url,
        icon: patch.icon ?? original.icon,
        color: patch.color ?? original.color,
        categoryId: patch.categoryId ?? original.categoryId,
      }
      bookmarks[idx] = next
      writeJson(key, bookmarks)
      return Promise.resolve(next)
    }
    return Promise.reject(new Error(`Bookmark ${id} not found`))
  }

  removeBookmark(id: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(BOOKMARK_PREFIX)) continue
      const bookmarks = readJson<Bookmark>(key)
      const filtered = bookmarks.filter((b) => b.id !== id)
      if (filtered.length !== bookmarks.length) {
        writeJson(key, filtered)
        return Promise.resolve()
      }
    }
    return Promise.resolve()
  }

  reorderBookmarks(userId: string, updates: BookmarkReorderUpdate[]): Promise<void> {
    const key = bookmarkKey(userId)
    const list = readJson<Bookmark>(key)
    const patchMap = new Map(updates.map((u) => [u.id, u] as const))
    const next = list.map((b) => {
      const p = patchMap.get(b.id)
      return p ? { ...b, categoryId: p.categoryId, sortOrder: p.sortOrder } : b
    })
    writeJson(key, next)
    return Promise.resolve()
  }

  reorderCategories(userId: string, updates: CategoryReorderUpdate[]): Promise<void> {
    const key = categoryKey(userId)
    const list = readJson<BookmarkCategory>(key)
    const patchMap = new Map(updates.map((u) => [u.id, u] as const))
    const next = list.map((c) => {
      const p = patchMap.get(c.id)
      return p ? { ...c, sortOrder: p.sortOrder } : c
    })
    writeJson(key, next)
    return Promise.resolve()
  }

  async importBulk(userId: string, data: ImportPayload, mode: ImportMode): Promise<void> {
    const catKey = categoryKey(userId)
    const bmKey = bookmarkKey(userId)
    let existingCats: BookmarkCategory[] = mode === 'replace' ? [] : readJson<BookmarkCategory>(catKey)
    let existingBms: Bookmark[] = mode === 'replace' ? [] : readJson<Bookmark>(bmKey)

    // 分类：merge 按 name 去重；append/replace 全部生成新记录
    const nameToId = new Map(existingCats.map((c) => [c.name, c.id] as const))
    const maxCatOrder = () => existingCats.reduce((m, c) => Math.max(m, c.sortOrder), 0)

    for (const catDraft of data.categories) {
      if (mode === 'merge' && nameToId.has(catDraft.name)) continue
      const created: BookmarkCategory = {
        id: generateId('cat'),
        userId,
        name: catDraft.name,
        icon: catDraft.icon,
        color: catDraft.color,
        sortOrder: maxCatOrder() + 1,
        description: catDraft.description,
      }
      existingCats = [...existingCats, created]
      nameToId.set(created.name, created.id)
    }

    // 书签：按 categoryName 映射到 id
    const sameCatMaxOrder = (catId: string): number => {
      return existingBms
        .filter((b) => b.categoryId === catId)
        .reduce((m, b) => Math.max(m, b.sortOrder), 0)
    }
    const nowIso = new Date().toISOString()

    for (const bm of data.bookmarks) {
      const categoryId = nameToId.get(bm.categoryName) ?? ''
      if (!categoryId) continue
      if (mode === 'merge') {
        const dup = existingBms.some((b) => b.categoryId === categoryId && b.url === bm.url)
        if (dup) continue
      }
      const created: Bookmark = {
        id: generateId('bm'),
        userId,
        name: bm.name,
        url: bm.url,
        icon: bm.icon,
        color: bm.color,
        categoryId,
        sortOrder: sameCatMaxOrder(categoryId) + 1,
        description: bm.description,
        createdAt: nowIso,
      }
      existingBms = [...existingBms, created]
    }

    writeJson(catKey, existingCats)
    writeJson(bmKey, existingBms)
  }

  exportBulk(userId: string): Promise<{ categories: BookmarkCategory[]; bookmarks: Bookmark[] }> {
    const categories = readJson<BookmarkCategory>(categoryKey(userId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const bookmarks = readJson<Bookmark>(bookmarkKey(userId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return Promise.resolve({ categories, bookmarks })
  }
}
