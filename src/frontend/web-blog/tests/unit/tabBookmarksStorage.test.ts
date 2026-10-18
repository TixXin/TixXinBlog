/** @file tabBookmarksStorage.test.ts @description 书签访客只读、存储错误和排序状态回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useTabBookmarks } from '../../app/composables/useTabBookmarks'
import type { CurrentUser } from '../../app/features/auth/types'
import type { Bookmark, BookmarkCategory } from '../../app/features/tab/types'
import { mockOwnerUser } from '../../app/features/auth/mock'
import { LocalTabRepository } from '../../app/features/tab/repository.local'

const mocks = vi.hoisted(() => ({
  auth: {} as { currentUser: Ref<CurrentUser | null>; isLoggedIn: Ref<boolean> },
  open: vi.fn(),
  favicon: vi.fn(),
  repo: {
    listCategories: vi.fn(),
    listBookmarks: vi.fn(),
    createCategory: vi.fn(),
    removeCategory: vi.fn(),
    createBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    reorderBookmarks: vi.fn(),
    reorderCategories: vi.fn(),
    importBulk: vi.fn(),
    exportBulk: vi.fn(),
  },
}))
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useTabRepository', () => () => mocks.repo)
mockNuxtImport('useLoginDrawer', () => () => ({ open: mocks.open }))
mockNuxtImport('useTabSettings', () => () => ({
  settings: ref({ faviconAutoFetch: false, faviconProvider: 'google' }),
}))
vi.mock('../../app/features/tab/favicon', () => ({ fetchFavicon: mocks.favicon }))

const wrappers: { unmount(): void }[] = []
const categories: BookmarkCategory[] = [
  { id: 'docs', userId: mockOwnerUser.id, name: '文档', icon: 'lucide:book', color: '#567890', sortOrder: 1 },
  { id: 'tools', userId: mockOwnerUser.id, name: '工具', icon: 'lucide:wrench', color: '#456789', sortOrder: 2 },
]
const bookmarks: Bookmark[] = [
  { id: 'vue', userId: mockOwnerUser.id, categoryId: 'docs', name: 'Vue', url: 'https://vuejs.org', sortOrder: 1 },
  { id: 'nuxt', userId: mockOwnerUser.id, categoryId: 'docs', name: 'Nuxt', url: 'https://nuxt.com', sortOrder: 2 },
  { id: 'git', userId: mockOwnerUser.id, categoryId: 'tools', name: 'Git', url: 'https://git-scm.com', sortOrder: 1 },
]

async function setup() {
  let state!: ReturnType<typeof useTabBookmarks>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          state = useTabBookmarks()
          return () => h('div')
        },
      }),
    ),
  )
  await state.load()
  return state
}

function signIn() {
  mocks.auth.currentUser.value = { ...mockOwnerUser, id: 'administrator-uuid' }
  mocks.auth.isLoggedIn.value = true
}

beforeEach(() => {
  for (const mock of Object.values(mocks.repo)) mock.mockReset()
  mocks.open.mockReset()
  mocks.favicon.mockReset().mockResolvedValue('https://example.com/favicon.ico')
  mocks.auth = { currentUser: ref(null), isLoggedIn: ref(false) }
  mocks.repo.listCategories.mockResolvedValue(categories.map((category) => ({ ...category })))
  mocks.repo.listBookmarks.mockResolvedValue(bookmarks.map((bookmark) => ({ ...bookmark })))
  const app = useNuxtApp()
  for (const key of Object.keys(app.payload.state)) {
    if (key.startsWith('$stab-')) Reflect.deleteProperty(app.payload.state, key)
  }
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('书签访客只读视图', () => {
  it('未登录加载博主书签，分类筛选和计数仍可用', async () => {
    const state = await setup()
    expect(mocks.repo.listCategories).toHaveBeenCalledWith(mockOwnerUser.id)
    expect(mocks.repo.listBookmarks).toHaveBeenCalledWith(mockOwnerUser.id)
    expect(state.isReadOnly.value).toBe(true)
    expect(state.viewingScope.value).toBe('owner')
    expect(state.visibleBookmarks.value.map((bookmark) => bookmark.id)).toEqual(['vue', 'nuxt'])
    expect(state.categoryCounts.value).toEqual({ docs: 2, tools: 1 })
    state.selectCategory('tools')
    expect(state.visibleBookmarks.value.map((bookmark) => bookmark.id)).toEqual(['git'])
    state.selectCategory(null)
    expect(state.visibleBookmarks.value).toHaveLength(3)
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('访客增删改和导入均提示登录且不写仓库', async () => {
    const state = await setup()
    expect(await state.addBookmark({ name: '新书签', url: 'https://example.com', categoryId: 'docs' })).toBeNull()
    expect(await state.updateBookmark('vue', { name: '改名' })).toBeNull()
    expect(await state.removeBookmark('vue')).toBe(false)
    expect(await state.addCategory({ name: '阅读', icon: 'lucide:book', color: '#333333' })).toBeNull()
    expect(await state.removeCategory('docs')).toBe(false)
    expect(await state.importBulk({ categories: [], bookmarks: [] }, 'replace')).toBe(false)
    expect(mocks.open).toHaveBeenCalledTimes(6)
    expect(mocks.open).toHaveBeenLastCalledWith('login')
    for (const method of [
      'createBookmark',
      'updateBookmark',
      'removeBookmark',
      'createCategory',
      'removeCategory',
      'importBulk',
    ] as const) {
      expect(mocks.repo[method]).not.toHaveBeenCalled()
    }
    expect(state.bookmarks.value).toEqual(bookmarks)
    expect(state.categories.value).toEqual(categories)
  })

  it('访客不能排序或刷新 favicon，不能绕过只读视图写入', async () => {
    const state = await setup()
    expect(await state.reorderBookmarks([{ id: 'vue', categoryId: 'tools', sortOrder: 0 }])).toBe(false)
    expect(await state.reorderCategories([{ id: 'tools', sortOrder: 0 }])).toBe(false)
    expect(await state.refreshFavicon('vue')).toBe(false)
    expect(mocks.repo.reorderBookmarks).not.toHaveBeenCalled()
    expect(mocks.repo.reorderCategories).not.toHaveBeenCalled()
    expect(mocks.favicon).not.toHaveBeenCalled()
    expect(mocks.repo.updateBookmark).not.toHaveBeenCalled()
    expect(state.bookmarks.value).toEqual(bookmarks)
    expect(state.categories.value).toEqual(categories)
  })

  it('登录后沿用博主归属，登出后重新加载只读视图', async () => {
    const state = await setup()
    signIn()
    await state.load()
    expect(state.isReadOnly.value).toBe(false)
    expect(state.viewingScope.value).toBe('self')
    expect(mocks.repo.listBookmarks).toHaveBeenLastCalledWith(mockOwnerUser.id)
    mocks.auth.currentUser.value = null
    mocks.auth.isLoggedIn.value = false
    await state.load()
    expect(state.isReadOnly.value).toBe(true)
    expect(state.viewingScope.value).toBe('owner')
    expect(mocks.repo.listBookmarks).toHaveBeenCalledTimes(3)
  })
})

describe('书签存储容错和排序', () => {
  it('登录后可刷新 favicon 并更新对应书签，未知书签不发起请求', async () => {
    signIn()
    const state = await setup()
    const faviconUrl = 'https://example.com/favicon.ico'
    const updated = { ...bookmarks[0]!, faviconUrl, faviconFailed: false }
    mocks.repo.updateBookmark.mockResolvedValue(updated)
    expect(await state.refreshFavicon('vue')).toBe(true)
    expect(mocks.favicon).toHaveBeenCalledExactlyOnceWith('https://vuejs.org', 'google')
    expect(mocks.repo.updateBookmark).toHaveBeenCalledExactlyOnceWith('vue', {
      faviconUrl,
      faviconFailed: false,
    })
    expect(state.bookmarks.value).toEqual([updated, bookmarks[1], bookmarks[2]])
    expect(mocks.open).not.toHaveBeenCalled()
    expect(await state.refreshFavicon('missing')).toBe(false)
    expect(mocks.favicon).toHaveBeenCalledTimes(1)
    expect(mocks.repo.updateBookmark).toHaveBeenCalledTimes(1)
  })

  it('浏览器禁止读取存储时 load 捕获异常并结束加载', async () => {
    const repo = new LocalTabRepository()
    mocks.repo.listCategories.mockImplementation((id: string) => repo.listCategories(id))
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('浏览器已禁用本地存储', 'SecurityError')
      },
    })
    const state = await setup()
    expect(state.loading.value).toBe(false)
    expect(state.loaded.value).toBe(false)
    expect(state.error.value).toContain('浏览器已禁用本地存储')
    expect(state.categories.value).toEqual([])
    expect(state.bookmarks.value).toEqual([])
    expect(mocks.repo.createCategory).not.toHaveBeenCalled()
  })

  it('访问 localStorage 属性本身抛错时 load 仍结束并报告存储失败', async () => {
    const repo = new LocalTabRepository()
    mocks.repo.listCategories.mockImplementation((id: string) => repo.listCategories(id))
    const originals = [...new Set([globalThis, window])].map((target) => ({
      target,
      descriptor: Object.getOwnPropertyDescriptor(target, 'localStorage'),
    }))
    try {
      for (const { target } of originals) {
        Object.defineProperty(target, 'localStorage', {
          configurable: true,
          get() {
            throw new DOMException('浏览器禁止访问 localStorage', 'SecurityError')
          },
        })
      }
      expect(() => window.localStorage).toThrow('浏览器禁止访问 localStorage')
      const state = await setup()
      expect(state.loading.value).toBe(false)
      expect(state.loaded.value).toBe(false)
      expect(state.error.value).toContain('浏览器禁止访问 localStorage')
      expect(state.bookmarks.value).toEqual([])
      expect(mocks.repo.createCategory).not.toHaveBeenCalled()
    } finally {
      for (const { target, descriptor } of originals.reverse()) {
        if (descriptor) Object.defineProperty(target, 'localStorage', descriptor)
        else Reflect.deleteProperty(target, 'localStorage')
      }
    }
  })

  it.each(['bookmarks', 'categories'] as const)('%s 排序存储失败保留旧状态，重试成功才更新顺序', async (kind) => {
    signIn()
    const state = await setup()
    if (kind === 'bookmarks') {
      const updates = [{ id: 'nuxt', categoryId: 'tools', sortOrder: 0 }]
      mocks.repo.reorderBookmarks.mockRejectedValueOnce(new Error('存储空间不足')).mockResolvedValueOnce(undefined)
      expect(await state.reorderBookmarks(updates)).toBe(false)
      expect(state.bookmarks.value).toEqual(bookmarks)
      expect(state.error.value).toBe('书签排序未保存，浏览器存储不可用或空间不足。')
      expect(await state.reorderBookmarks(updates)).toBe(true)
      expect(mocks.repo.reorderBookmarks).toHaveBeenLastCalledWith(mockOwnerUser.id, updates)
      expect(state.bookmarks.value.map((bookmark) => bookmark.id)).toEqual(['nuxt', 'vue', 'git'])
      expect(state.categoryCounts.value).toEqual({ docs: 1, tools: 2 })
    } else {
      const updates = [{ id: 'tools', sortOrder: 0 }]
      mocks.repo.reorderCategories.mockRejectedValueOnce(new Error('存储空间不足')).mockResolvedValueOnce(undefined)
      expect(await state.reorderCategories(updates)).toBe(false)
      expect(state.categories.value).toEqual(categories)
      expect(state.error.value).toBe('分组排序未保存，浏览器存储不可用或空间不足。')
      expect(await state.reorderCategories(updates)).toBe(true)
      expect(mocks.repo.reorderCategories).toHaveBeenLastCalledWith(mockOwnerUser.id, updates)
      expect(state.categories.value.map((category) => category.id)).toEqual(['tools', 'docs'])
    }
    expect(state.error.value).toBeNull()
    expect(state.activeCategoryId.value).toBe('docs')
  })

  it('登录后导入成功才刷新列表，失败保留旧列表并向调用方报告', async () => {
    signIn()
    const state = await setup()
    const data = { categories: [], bookmarks: [] }
    mocks.repo.importBulk.mockRejectedValueOnce(new Error('本地保存失败')).mockResolvedValueOnce(undefined)
    await expect(state.importBulk(data, 'replace')).rejects.toThrow('本地保存失败')
    expect(state.bookmarks.value).toEqual(bookmarks)
    expect(mocks.repo.listBookmarks).toHaveBeenCalledTimes(1)
    mocks.repo.listCategories.mockResolvedValue([categories[1]])
    mocks.repo.listBookmarks.mockResolvedValue([bookmarks[2]])
    expect(await state.importBulk(data, 'replace')).toBe(true)
    expect(mocks.repo.importBulk).toHaveBeenLastCalledWith(mockOwnerUser.id, data, 'replace')
    expect(state.bookmarks.value).toEqual([bookmarks[2]])
    expect(state.activeCategoryId.value).toBe('tools')
  })
})
