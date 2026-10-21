/**
 * @file useTabBookmarkOperations.ts
 * @description 标签页书签与分类弹窗状态、提交与排序等操作逻辑
 * @author TixXin
 * @since 2026-04-11
 */

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { AuthView } from '~/features/auth/types'
import type {
  Bookmark,
  BookmarkCategory,
  BookmarkDraft,
  BookmarkCategoryDraft,
  BookmarkReorderUpdate,
  CategoryReorderUpdate,
} from './types'

export interface UseTabBookmarkOperationsOptions {
  isLoggedIn: Ref<boolean>
  openLoginDrawer: (view?: AuthView, modal?: boolean) => void
  bookmarks: Ref<Bookmark[]>
  addBookmark: (draft: BookmarkDraft) => Promise<Bookmark | null>
  updateBookmark: (id: string, patch: Partial<Omit<Bookmark, 'id' | 'userId'>>) => Promise<Bookmark | null>
  removeBookmark: (id: string) => Promise<boolean>
  addCategory: (draft: BookmarkCategoryDraft) => Promise<BookmarkCategory | null>
  removeCategory: (id: string) => Promise<boolean>
  reorderBookmarks: (updates: BookmarkReorderUpdate[]) => Promise<boolean>
  reorderCategories: (updates: CategoryReorderUpdate[]) => Promise<boolean>
}

/**
 * 标签页书签和分类的 CRUD、弹窗与拖拽排序
 */
export function useTabBookmarkOperations(options: UseTabBookmarkOperationsOptions) {
  const { t } = useI18n()
  const { error: showError, info } = useToast()

  const addBookmarkVisible = ref(false)
  const addCategoryVisible = ref(false)
  const settingsOpen = ref(false)
  const importOpen = ref(false)

  function onAddBookmarkClick() {
    if (!options.isLoggedIn.value) {
      options.openLoginDrawer('login')
      return
    }
    addBookmarkVisible.value = true
  }

  function onAddCategoryClick() {
    if (!options.isLoggedIn.value) {
      options.openLoginDrawer('login')
      return
    }
    addCategoryVisible.value = true
  }

  async function onSubmitBookmark(draft: BookmarkDraft) {
    try {
      if (await options.addBookmark(draft)) addBookmarkVisible.value = false
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('misc.tab.page.saveFailed'))
    }
  }

  async function onUpdateBookmarkFromDialog(payload: { id: string; patch: BookmarkDraft }) {
    try {
      if (await options.updateBookmark(payload.id, payload.patch)) addBookmarkVisible.value = false
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('misc.tab.page.saveFailed'))
    }
  }

  async function onRemoveBookmark(id: string) {
    await options.removeBookmark(id)
  }

  async function onSubmitCategory(draft: BookmarkCategoryDraft) {
    await options.addCategory(draft)
  }

  async function onRemoveCategory(id: string) {
    if (!window.confirm(t('misc.tab.page.removeCategoryConfirm'))) return
    await options.removeCategory(id)
  }

  async function onReorder(updates: BookmarkReorderUpdate[]) {
    await options.reorderBookmarks(updates)
  }

  async function onReorderCategories(updates: CategoryReorderUpdate[]) {
    await options.reorderCategories(updates)
  }

  function onReadOnlyBlocked() {
    info(t('misc.tab.page.readOnlyBlocked'))
  }

  function onDonate() {
    // 打赏功能占位，后续实现
  }

  async function onBookmarkDropped(payload: { bookmarkId: string; targetCategoryId: string }) {
    const current = options.bookmarks.value.find((b) => b.id === payload.bookmarkId)
    if (!current || current.categoryId === payload.targetCategoryId) return
    await options.updateBookmark(payload.bookmarkId, { categoryId: payload.targetCategoryId })
  }

  return {
    addBookmarkVisible,
    addCategoryVisible,
    settingsOpen,
    importOpen,
    onAddBookmarkClick,
    onAddCategoryClick,
    onSubmitBookmark,
    onUpdateBookmarkFromDialog,
    onRemoveBookmark,
    onSubmitCategory,
    onRemoveCategory,
    onReorder,
    onReorderCategories,
    onReadOnlyBlocked,
    onDonate,
    onBookmarkDropped,
  }
}
