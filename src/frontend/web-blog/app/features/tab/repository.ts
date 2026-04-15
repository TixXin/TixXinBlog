/**
 * @file repository.ts
 * @description 标签页书签 / 分类的数据仓库接口契约
 * @author TixXin
 * @since 2026-04-11
 *
 * 与 flash 模块同样的 Repository 模式：组件 / composable 只依赖接口，
 * 现在由 localStorage 实现，未来切 HTTP 不用改调用方。
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

export interface TabBookmarkRepository {
  /** 列出指定用户的全部分类（含默认分类） */
  listCategories(userId: string): Promise<BookmarkCategory[]>
  /** 列出指定用户的全部书签 */
  listBookmarks(userId: string): Promise<Bookmark[]>

  /** 创建分类 */
  createCategory(userId: string, draft: BookmarkCategoryDraft): Promise<BookmarkCategory>
  /** 更新分类 */
  updateCategory(id: string, patch: Partial<BookmarkCategoryDraft>): Promise<BookmarkCategory>
  /** 删除分类（连带删除其下书签） */
  removeCategory(id: string): Promise<void>

  /** 创建书签 */
  createBookmark(userId: string, draft: BookmarkDraft): Promise<Bookmark>
  /** 更新书签 */
  updateBookmark(id: string, patch: Partial<BookmarkDraft>): Promise<Bookmark>
  /** 删除书签 */
  removeBookmark(id: string): Promise<void>

  /** 批量更新书签排序 / 所属分类（拖拽结束一次提交，避免多次 JSON IO） */
  reorderBookmarks(userId: string, updates: BookmarkReorderUpdate[]): Promise<void>
  /** 批量更新分类排序 */
  reorderCategories(userId: string, updates: CategoryReorderUpdate[]): Promise<void>

  /** 批量导入：mode=merge 同名跳过 / append 全部追加 / replace 清空旧数据 */
  importBulk(userId: string, data: ImportPayload, mode: ImportMode): Promise<void>
  /** 导出当前用户全部分类与书签 */
  exportBulk(userId: string): Promise<{ categories: BookmarkCategory[]; bookmarks: Bookmark[] }>
}
