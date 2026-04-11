/**
 * @file useTabBookmarks.ts
 * @description 标签页业务 composable：分类与书签的加载、增删改、首次 seed
 * @author TixXin
 * @since 2026-04-11
 *
 * 设计原则：
 * - 数据读写全部委托给 TabBookmarkRepository
 * - 跨组件通过 useState 共享响应式列表
 * - 未登录时返回空，写操作触发登录弹窗
 */

import type {
  Bookmark,
  BookmarkCategory,
  BookmarkCategoryDraft,
  BookmarkDraft,
} from '~/features/tab/types'
import { defaultCategorySeeds, defaultBookmarkSeeds } from '~/features/tab/mock'

export function useTabBookmarks() {
  const repo = useTabRepository()
  const { currentUser, isLoggedIn } = useCurrentUser()
  const { open: openLoginDrawer } = useLoginDrawer()

  const categories = useState<BookmarkCategory[]>('tab-categories', () => [])
  const bookmarks = useState<Bookmark[]>('tab-bookmarks', () => [])
  const loaded = useState<boolean>('tab-loaded', () => false)
  const loading = useState<boolean>('tab-loading', () => false)
  const error = useState<string | null>('tab-error', () => null)
  const activeCategoryId = useState<string | null>('tab-active-category', () => null)

  /** 加载当前用户的分类与书签。首次加载且为空时注入 seed。 */
  async function load(force = false) {
    if (!isLoggedIn.value || !currentUser.value) {
      categories.value = []
      bookmarks.value = []
      loaded.value = true
      activeCategoryId.value = null
      return
    }
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      const userId = currentUser.value.id
      let cats = await repo.listCategories(userId)
      let bms = await repo.listBookmarks(userId)

      if (cats.length === 0) {
        // 首次进入：seed 默认分类
        const created: BookmarkCategory[] = []
        for (const draft of defaultCategorySeeds) {
          created.push(await repo.createCategory(userId, draft))
        }
        cats = created

        // 然后按分类名映射 seed 书签
        const nameToId = new Map(cats.map((c) => [c.name, c.id] as const))
        for (const seed of defaultBookmarkSeeds) {
          const categoryId = nameToId.get(seed.categoryName)
          if (!categoryId) continue
          await repo.createBookmark(userId, {
            name: seed.name,
            url: seed.url,
            icon: seed.icon,
            color: seed.color,
            categoryId,
          })
        }
        bms = await repo.listBookmarks(userId)
      }

      categories.value = cats
      bookmarks.value = bms
      loaded.value = true
      // 默认选中第一个分类
      if (!activeCategoryId.value && cats.length > 0) {
        activeCategoryId.value = cats[0]!.id
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 创建书签 */
  async function addBookmark(draft: BookmarkDraft): Promise<Bookmark | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const created = await repo.createBookmark(currentUser.value.id, draft)
    bookmarks.value = [...bookmarks.value, created]
    return created
  }

  /** 更新书签 */
  async function updateBookmark(id: string, patch: Partial<BookmarkDraft>): Promise<Bookmark | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const updated = await repo.updateBookmark(id, patch)
    bookmarks.value = bookmarks.value.map((b) => (b.id === id ? updated : b))
    return updated
  }

  /** 删除书签 */
  async function removeBookmark(id: string): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    await repo.removeBookmark(id)
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id)
    return true
  }

  /** 创建分类 */
  async function addCategory(draft: BookmarkCategoryDraft): Promise<BookmarkCategory | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const created = await repo.createCategory(currentUser.value.id, draft)
    categories.value = [...categories.value, created]
    return created
  }

  /** 删除分类（连带其下书签） */
  async function removeCategory(id: string): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    await repo.removeCategory(id)
    categories.value = categories.value.filter((c) => c.id !== id)
    bookmarks.value = bookmarks.value.filter((b) => b.categoryId !== id)
    if (activeCategoryId.value === id) {
      activeCategoryId.value = categories.value[0]?.id ?? null
    }
    return true
  }

  /** 当前激活分类下的书签 */
  const visibleBookmarks = computed<Bookmark[]>(() => {
    if (!activeCategoryId.value) return bookmarks.value
    return bookmarks.value.filter((b) => b.categoryId === activeCategoryId.value)
  })

  /** 每个分类的书签计数 */
  const categoryCounts = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    bookmarks.value.forEach((b) => {
      map[b.categoryId] = (map[b.categoryId] ?? 0) + 1
    })
    return map
  })

  function selectCategory(id: string | null) {
    activeCategoryId.value = id
  }

  return {
    categories,
    bookmarks,
    visibleBookmarks,
    categoryCounts,
    activeCategoryId,
    loaded,
    loading,
    error,
    load,
    selectCategory,
    addBookmark,
    updateBookmark,
    removeBookmark,
    addCategory,
    removeCategory,
  }
}
