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

type Translate = ReturnType<typeof useI18n>['t']

/** 新增入口：未登录时打开登录，否则打开对应弹窗 */
function createDialogs(options: UseTabBookmarkOperationsOptions) {
  const addBookmarkVisible = ref(false)
  const addCategoryVisible = ref(false)
  const settingsOpen = ref(false)
  const importOpen = ref(false)
  const openIfLoggedIn = (visible: Ref<boolean>) => {
    if (!options.isLoggedIn.value) {
      options.openLoginDrawer('login')
      return
    }
    visible.value = true
  }
  return {
    addBookmarkVisible,
    addCategoryVisible,
    settingsOpen,
    importOpen,
    onAddBookmarkClick: () => openIfLoggedIn(addBookmarkVisible),
    onAddCategoryClick: () => openIfLoggedIn(addCategoryVisible),
  }
}

/** 书签弹窗提交：保存成功才关闭弹窗，失败提示原因 */
function createBookmarkSubmit(
  options: UseTabBookmarkOperationsOptions,
  addBookmarkVisible: Ref<boolean>,
  t: Translate,
  showError: (message: string) => void,
) {
  const saveFailed = (cause: unknown) =>
    showError(cause instanceof Error ? cause.message : t('misc.tab.page.saveFailed'))
  async function onSubmitBookmark(draft: BookmarkDraft) {
    try {
      if (await options.addBookmark(draft)) addBookmarkVisible.value = false
    } catch (cause) {
      saveFailed(cause)
    }
  }
  async function onUpdateBookmarkFromDialog(payload: { id: string; patch: BookmarkDraft }) {
    try {
      if (await options.updateBookmark(payload.id, payload.patch)) addBookmarkVisible.value = false
    } catch (cause) {
      saveFailed(cause)
    }
  }
  return { onSubmitBookmark, onUpdateBookmarkFromDialog }
}

/** 删除、排序与拖放：删除分类前确认，书签拖到其他分类才更新 */
function createListHandlers(options: UseTabBookmarkOperationsOptions, t: Translate) {
  return {
    onRemoveBookmark: async (id: string) => {
      await options.removeBookmark(id)
    },
    onSubmitCategory: async (draft: BookmarkCategoryDraft) => {
      await options.addCategory(draft)
    },
    onRemoveCategory: async (id: string) => {
      if (!window.confirm(t('misc.tab.page.removeCategoryConfirm'))) return
      await options.removeCategory(id)
    },
    onReorder: async (updates: BookmarkReorderUpdate[]) => {
      await options.reorderBookmarks(updates)
    },
    onReorderCategories: async (updates: CategoryReorderUpdate[]) => {
      await options.reorderCategories(updates)
    },
    onBookmarkDropped: async (payload: { bookmarkId: string; targetCategoryId: string }) => {
      const current = options.bookmarks.value.find((b) => b.id === payload.bookmarkId)
      if (!current || current.categoryId === payload.targetCategoryId) return
      await options.updateBookmark(payload.bookmarkId, { categoryId: payload.targetCategoryId })
    },
  }
}

/**
 * 标签页书签和分类的 CRUD、弹窗与拖拽排序
 */
export function useTabBookmarkOperations(options: UseTabBookmarkOperationsOptions) {
  const { t } = useI18n()
  const { error: showError, info } = useToast()
  const dialogs = createDialogs(options)
  const submit = createBookmarkSubmit(options, dialogs.addBookmarkVisible, t, showError)
  const list = createListHandlers(options, t)
  return {
    addBookmarkVisible: dialogs.addBookmarkVisible,
    addCategoryVisible: dialogs.addCategoryVisible,
    settingsOpen: dialogs.settingsOpen,
    importOpen: dialogs.importOpen,
    onAddBookmarkClick: dialogs.onAddBookmarkClick,
    onAddCategoryClick: dialogs.onAddCategoryClick,
    onSubmitBookmark: submit.onSubmitBookmark,
    onUpdateBookmarkFromDialog: submit.onUpdateBookmarkFromDialog,
    onRemoveBookmark: list.onRemoveBookmark,
    onSubmitCategory: list.onSubmitCategory,
    onRemoveCategory: list.onRemoveCategory,
    onReorder: list.onReorder,
    onReorderCategories: list.onReorderCategories,
    onReadOnlyBlocked: () => {
      info(t('misc.tab.page.readOnlyBlocked'))
    },
    onDonate: () => {
      // 打赏功能占位，后续实现
    },
    onBookmarkDropped: list.onBookmarkDropped,
  }
}
