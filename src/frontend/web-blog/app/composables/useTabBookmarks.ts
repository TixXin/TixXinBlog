/**
 * @file useTabBookmarks.ts
 * @description 标签页业务 composable：分类与书签的加载、增删改、首次 seed
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
import { getSeedForUser } from '~/features/tab/mock'
import { fetchFavicon } from '~/features/tab/favicon'
import { mockOwnerUser } from '~/features/auth/mock'

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
  /** 当前展示的所有者：owner（未登录回退）或 self（登录后看自己的） */
  const viewingScope = useState<'self' | 'owner'>('tab-viewing-scope', () => 'owner')

  /** 是否处于只读模式：未登录时只能浏览博主的标签页 */
  const isReadOnly = computed(() => !isLoggedIn.value)

  /**
   * 加载分类与书签。
   * - 已登录：加载当前用户自己的列表，首次为空时注入 seed
   * - 未登录：回退展示博主（mockOwnerUser）的列表，同样支持 seed
   */
  async function load(force = false) {
    const targetUserId = isLoggedIn.value && currentUser.value ? currentUser.value.id : mockOwnerUser.id
    const nextScope: 'self' | 'owner' = isLoggedIn.value ? 'self' : 'owner'

    // 切换到不同 scope 时强制重载，避免显示上一身份的数据
    if (loaded.value && !force && viewingScope.value === nextScope) return

    loading.value = true
    error.value = null
    try {
      let cats = await repo.listCategories(targetUserId)
      let bms = await repo.listBookmarks(targetUserId)

      if (cats.length === 0) {
        // 首次进入：按用户 id 分发 seed（owner/visitor/空）
        const seed = getSeedForUser(targetUserId)
        if (seed.categories.length > 0) {
          const created: BookmarkCategory[] = []
          for (const draft of seed.categories) {
            created.push(await repo.createCategory(targetUserId, draft))
          }
          cats = created

          const nameToId = new Map(cats.map((c) => [c.name, c.id] as const))
          for (const bm of seed.bookmarks) {
            const categoryId = nameToId.get(bm.categoryName)
            if (!categoryId) continue
            await repo.createBookmark(targetUserId, {
              name: bm.name,
              url: bm.url,
              icon: bm.icon,
              color: bm.color,
              categoryId,
            })
          }
          bms = await repo.listBookmarks(targetUserId)
        }
      }

      categories.value = cats
      bookmarks.value = bms
      viewingScope.value = nextScope
      loaded.value = true
      // 默认选中第一个分类
      if (cats.length > 0) {
        // scope 切换时强制重选第一个分类，避免使用上一身份的 id
        const stillExists = activeCategoryId.value && cats.some((c) => c.id === activeCategoryId.value)
        if (!stillExists) {
          activeCategoryId.value = cats[0]!.id
        }
      } else {
        activeCategoryId.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  /** 创建书签；若设置允许则异步抓取 favicon 并补写 */
  async function addBookmark(draft: BookmarkDraft): Promise<Bookmark | null> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return null
    }
    const created = await repo.createBookmark(currentUser.value.id, draft)
    bookmarks.value = [...bookmarks.value, created]
    void maybeFetchFavicon(created)
    return created
  }

  /** 手动刷新单个书签的 favicon */
  async function refreshFavicon(id: string): Promise<boolean> {
    const bm = bookmarks.value.find((b) => b.id === id)
    if (!bm) return false
    const { settings } = useTabSettings()
    const url = await fetchFavicon(bm.url, settings.value.faviconProvider)
    const patch = { faviconUrl: url ?? undefined, faviconFailed: !url }
    const updated = await repo.updateBookmark(id, patch)
    bookmarks.value = bookmarks.value.map((b) => (b.id === id ? updated : b))
    return true
  }

  /** 若设置启用，则为新建/缺失 favicon 的书签异步抓取；失败写 faviconFailed */
  async function maybeFetchFavicon(bm: Bookmark): Promise<void> {
    const { settings } = useTabSettings()
    if (!settings.value.faviconAutoFetch) return
    if (bm.icon?.startsWith('lucide:')) return
    if (bm.faviconUrl || bm.faviconFailed) return
    const url = await fetchFavicon(bm.url, settings.value.faviconProvider)
    const patch = { faviconUrl: url ?? undefined, faviconFailed: !url }
    try {
      const updated = await repo.updateBookmark(bm.id, patch)
      bookmarks.value = bookmarks.value.map((b) => (b.id === bm.id ? updated : b))
    } catch {
      // 书签已被删除等异常时忽略
    }
  }

  /** 更新书签（patch 宽松接受 Bookmark 全部可写字段） */
  async function updateBookmark(id: string, patch: Partial<Omit<Bookmark, 'id' | 'userId'>>): Promise<Bookmark | null> {
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

  /** 批量更新书签排序（拖拽结束后一次性提交） */
  async function reorderBookmarks(updates: BookmarkReorderUpdate[]): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) return false
    await repo.reorderBookmarks(currentUser.value.id, updates)
    const patchMap = new Map(updates.map((u) => [u.id, u] as const))
    bookmarks.value = bookmarks.value.map((b) => {
      const p = patchMap.get(b.id)
      return p ? { ...b, categoryId: p.categoryId, sortOrder: p.sortOrder } : b
    })
    return true
  }

  /** 批量更新分类排序 */
  async function reorderCategories(updates: CategoryReorderUpdate[]): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) return false
    await repo.reorderCategories(currentUser.value.id, updates)
    const patchMap = new Map(updates.map((u) => [u.id, u] as const))
    categories.value = [...categories.value]
      .map((c) => (patchMap.get(c.id) ? { ...c, sortOrder: patchMap.get(c.id)!.sortOrder } : c))
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return true
  }

  /** 批量导入 */
  async function importBulk(data: ImportPayload, mode: ImportMode): Promise<boolean> {
    if (!isLoggedIn.value || !currentUser.value) {
      openLoginDrawer('login')
      return false
    }
    await repo.importBulk(currentUser.value.id, data, mode)
    await load(true)
    return true
  }

  /** 导出当前用户全部数据 */
  async function exportBulk(): Promise<{ categories: BookmarkCategory[]; bookmarks: Bookmark[] } | null> {
    const targetUserId = isLoggedIn.value && currentUser.value ? currentUser.value.id : mockOwnerUser.id
    return repo.exportBulk(targetUserId)
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
    viewingScope,
    isReadOnly,
    load,
    selectCategory,
    addBookmark,
    updateBookmark,
    removeBookmark,
    addCategory,
    removeCategory,
    reorderBookmarks,
    reorderCategories,
    importBulk,
    exportBulk,
    refreshFavicon,
  }
}
