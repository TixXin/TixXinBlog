/**
 * @file repository.http.ts
 * @description TabBookmarkRepository 的 HTTP 实现占位，预留给未来后端对接
 * @author TixXin
 * @since 2026-04-11
 *
 * 当前后端尚未就绪，此处仅作类型契约占位。
 * 仅在 nuxt.config.ts `runtimeConfig.public.useMockRepo === false` 时才会被实例化使用。
 *
 * 未来对接步骤：
 * 1. 把每个方法的 throw 替换为 `return $fetch('/api/tab/...', ...)`
 * 2. 把 nuxt.config.ts 的 useMockRepo 改成 false
 * 3. 组件 / composable 一行不用动
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

const NOT_IMPLEMENTED = 'HttpTabRepository 尚未实现，请保持 useMockRepo=true 或先完成后端 API 对接'

export class HttpTabRepository implements TabBookmarkRepository {
  listCategories(_userId: string): Promise<BookmarkCategory[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  listBookmarks(_userId: string): Promise<Bookmark[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  createCategory(_userId: string, _draft: BookmarkCategoryDraft): Promise<BookmarkCategory> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  updateCategory(_id: string, _patch: Partial<BookmarkCategoryDraft>): Promise<BookmarkCategory> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  removeCategory(_id: string): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  createBookmark(_userId: string, _draft: BookmarkDraft): Promise<Bookmark> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  updateBookmark(_id: string, _patch: Partial<BookmarkDraft>): Promise<Bookmark> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  removeBookmark(_id: string): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  reorderBookmarks(_userId: string, _updates: BookmarkReorderUpdate[]): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  reorderCategories(_userId: string, _updates: CategoryReorderUpdate[]): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  importBulk(_userId: string, _data: ImportPayload, _mode: ImportMode): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  exportBulk(_userId: string): Promise<{ categories: BookmarkCategory[]; bookmarks: Bookmark[] }> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
}
