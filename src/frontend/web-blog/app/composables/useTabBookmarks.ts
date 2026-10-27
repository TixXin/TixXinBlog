/**
 * @file useTabBookmarks.ts
 * @description 标签页业务 composable：分类与书签的加载、增删改、首次 seed；按共享状态、加载与写入组装
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 数据读写全部委托给 TabBookmarkRepository
 * - 跨组件通过 useState 共享响应式列表
 * - 未登录时回退展示博主（mockOwnerUser）的分类与书签（只读）
 * - 写操作仅对登录用户开放，未登录触发 useLoginDrawer.open()
 */

import type {
  Bookmark,
  BookmarkCategory,
  BookmarkCategoryDraft,
  BookmarkDraft,
  BookmarkReorderUpdate,
  CategoryReorderUpdate,
  ImportMode,
  ImportPayload,
} from '~/features/tab/types'
import { createTabBookmarkSession } from '~/features/tab/bookmarkSession'
import { loadTabBookmarks } from '~/features/tab/bookmarkLoad'
import * as writes from '~/features/tab/bookmarkWrites'

export function useTabBookmarks() {
  const s = createTabBookmarkSession()

  /** 当前激活分类下的书签 */
  const visibleBookmarks = computed<Bookmark[]>(() => {
    if (!s.activeCategoryId.value) return s.bookmarks.value
    return s.bookmarks.value.filter((b) => b.categoryId === s.activeCategoryId.value)
  })

  /** 每个分类的书签计数 */
  const categoryCounts = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    s.bookmarks.value.forEach((b) => {
      map[b.categoryId] = (map[b.categoryId] ?? 0) + 1
    })
    return map
  })

  return {
    categories: s.categories,
    bookmarks: s.bookmarks,
    visibleBookmarks,
    categoryCounts,
    activeCategoryId: s.activeCategoryId,
    loaded: s.loaded,
    loading: s.loading,
    error: s.error,
    viewingScope: s.viewingScope,
    isReadOnly: s.isReadOnly,
    load: (force = false) => loadTabBookmarks(s, force),
    selectCategory: (id: string | null) => {
      s.activeCategoryId.value = id
    },
    addBookmark: (draft: BookmarkDraft) => writes.addBookmark(s, draft),
    updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'userId'>>) =>
      writes.updateBookmark(s, id, patch),
    removeBookmark: (id: string) => writes.removeBookmark(s, id),
    addCategory: (draft: BookmarkCategoryDraft) => writes.addCategory(s, draft),
    removeCategory: (id: string) => writes.removeCategory(s, id),
    reorderBookmarks: (updates: BookmarkReorderUpdate[]) => writes.reorderBookmarks(s, updates),
    reorderCategories: (updates: CategoryReorderUpdate[]) => writes.reorderCategories(s, updates),
    importBulk: (data: ImportPayload, mode: ImportMode) => writes.importBulk(s, data, mode),
    /** 导出当前用户全部数据 */
    exportBulk: async (): Promise<{ categories: BookmarkCategory[]; bookmarks: Bookmark[] } | null> =>
      s.repo.exportBulk(s.contentOwnerId.value),
    refreshFavicon: (id: string) => writes.refreshFavicon(s, id),
  }
}
