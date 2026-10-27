/**
 * @file bookmarkWrites.ts
 * @description 标签页书签与分类的写入：增删改、图标抓取、批量排序与导入导出；仓储成功后才同步列表，未登录时提示登录
 * @author TixXin
 * @since 2026-10-27
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
} from './types'
import { fetchFavicon } from './favicon'
import type { TabBookmarkSession } from './bookmarkSession'
import { loadTabBookmarks } from './bookmarkLoad'

const replaceBookmark = (s: TabBookmarkSession, id: string, updated: Bookmark) => {
  s.bookmarks.value = s.bookmarks.value.map((b) => (b.id === id ? updated : b))
}

/** 抓取图标并写回；无法获取时保存失败标记 */
async function saveFavicon(s: TabBookmarkSession, bm: Bookmark) {
  const { settings } = useTabSettings()
  const url = await fetchFavicon(bm.url, settings.value.faviconProvider)
  const updated = await s.repo.updateBookmark(bm.id, { faviconUrl: url ?? undefined, faviconFailed: !url })
  replaceBookmark(s, bm.id, updated)
}

/** 若设置启用，则为新建/缺失 favicon 的书签异步抓取；失败写 faviconFailed */
async function maybeFetchFavicon(s: TabBookmarkSession, bm: Bookmark): Promise<void> {
  const { settings } = useTabSettings()
  if (!settings.value.faviconAutoFetch) return
  if (bm.icon?.startsWith('lucide:')) return
  if (bm.faviconUrl || bm.faviconFailed) return
  const url = await fetchFavicon(bm.url, settings.value.faviconProvider)
  const patch = { faviconUrl: url ?? undefined, faviconFailed: !url }
  try {
    replaceBookmark(s, bm.id, await s.repo.updateBookmark(bm.id, patch))
  } catch {
    // 书签已被删除等异常时忽略
  }
}

/** 创建书签；若设置允许则异步抓取 favicon 并补写 */
export async function addBookmark(s: TabBookmarkSession, draft: BookmarkDraft): Promise<Bookmark | null> {
  if (!s.requireLogin()) return null
  const created = await s.repo.createBookmark(s.contentOwnerId.value, draft)
  s.bookmarks.value = [...s.bookmarks.value, created]
  void maybeFetchFavicon(s, created)
  return created
}

/** 手动刷新单个书签的 favicon */
export async function refreshFavicon(s: TabBookmarkSession, id: string): Promise<boolean> {
  if (!s.requireLogin()) return false
  const bm = s.bookmarks.value.find((b) => b.id === id)
  if (!bm) return false
  await saveFavicon(s, bm)
  return true
}

/** 更新书签（patch 宽松接受 Bookmark 全部可写字段） */
export async function updateBookmark(
  s: TabBookmarkSession,
  id: string,
  patch: Partial<Omit<Bookmark, 'id' | 'userId'>>,
): Promise<Bookmark | null> {
  if (!s.requireLogin()) return null
  const updated = await s.repo.updateBookmark(id, patch)
  replaceBookmark(s, id, updated)
  return updated
}

/** 删除书签 */
export async function removeBookmark(s: TabBookmarkSession, id: string): Promise<boolean> {
  if (!s.requireLogin()) return false
  await s.repo.removeBookmark(id)
  s.bookmarks.value = s.bookmarks.value.filter((b) => b.id !== id)
  return true
}

/** 创建分类 */
export async function addCategory(
  s: TabBookmarkSession,
  draft: BookmarkCategoryDraft,
): Promise<BookmarkCategory | null> {
  if (!s.requireLogin()) return null
  const created = await s.repo.createCategory(s.contentOwnerId.value, draft)
  s.categories.value = [...s.categories.value, created]
  return created
}

/** 删除分类（连带其下书签） */
export async function removeCategory(s: TabBookmarkSession, id: string): Promise<boolean> {
  if (!s.requireLogin()) return false
  await s.repo.removeCategory(id)
  s.categories.value = s.categories.value.filter((c) => c.id !== id)
  s.bookmarks.value = s.bookmarks.value.filter((b) => b.categoryId !== id)
  if (s.activeCategoryId.value === id) {
    s.activeCategoryId.value = s.categories.value[0]?.id ?? null
  }
  return true
}

/** 批量更新书签排序（拖拽结束后一次性提交） */
export async function reorderBookmarks(s: TabBookmarkSession, updates: BookmarkReorderUpdate[]): Promise<boolean> {
  if (!s.canWrite()) return false
  try {
    await s.repo.reorderBookmarks(s.contentOwnerId.value, updates)
  } catch {
    s.error.value = s.t('misc.tab.bookmarks.reorderBookmarksFailed')
    return false
  }
  s.error.value = null
  const patchMap = new Map(updates.map((u) => [u.id, u] as const))
  s.bookmarks.value = s.bookmarks.value
    .map((b) => {
      const p = patchMap.get(b.id)
      return p ? { ...b, categoryId: p.categoryId, sortOrder: p.sortOrder } : b
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return true
}

/** 批量更新分类排序 */
export async function reorderCategories(s: TabBookmarkSession, updates: CategoryReorderUpdate[]): Promise<boolean> {
  if (!s.canWrite()) return false
  try {
    await s.repo.reorderCategories(s.contentOwnerId.value, updates)
  } catch {
    s.error.value = s.t('misc.tab.bookmarks.reorderCategoriesFailed')
    return false
  }
  s.error.value = null
  const patchMap = new Map(updates.map((u) => [u.id, u] as const))
  s.categories.value = [...s.categories.value]
    .map((c) => (patchMap.get(c.id) ? { ...c, sortOrder: patchMap.get(c.id)!.sortOrder } : c))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return true
}

/** 批量导入 */
export async function importBulk(s: TabBookmarkSession, data: ImportPayload, mode: ImportMode): Promise<boolean> {
  if (!s.requireLogin()) return false
  await s.repo.importBulk(s.contentOwnerId.value, data, mode)
  await loadTabBookmarks(s, true)
  return true
}
