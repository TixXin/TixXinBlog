/**
 * @file tabBookmarks.test.ts
 * @description 标签页书签的身份归属、只读写入边界、初始化与失败状态保护
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useTabBookmarks } from '../../app/composables/useTabBookmarks'
import type { Bookmark, BookmarkCategory, ImportPayload } from '../../app/features/tab/types'
import type { CurrentUser } from '../../app/features/auth/types'
import type { SeedSet } from '../../app/features/tab/mock'

const mocks = vi.hoisted(() => ({
  repo: {
    listCategories: vi.fn(),
    listBookmarks: vi.fn(),
    createCategory: vi.fn(),
    createBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    removeCategory: vi.fn(),
    reorderBookmarks: vi.fn(),
    reorderCategories: vi.fn(),
    importBulk: vi.fn(),
    exportBulk: vi.fn(),
  },
  auth: {} as {
    currentUser: Ref<Pick<CurrentUser, 'id' | 'role'> | null>
    isLoggedIn: Ref<boolean>
  },
  settings: {} as Ref<{ faviconAutoFetch: boolean; faviconProvider: 'google' | 'duckduckgo' }>,
  openLogin: vi.fn(),
  seed: vi.fn<() => SeedSet>(),
  favicon: vi.fn(),
}))

mockNuxtImport('useTabRepository', () => () => mocks.repo)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useLoginDrawer', () => () => ({ open: mocks.openLogin }))
mockNuxtImport('useTabSettings', () => () => ({ settings: mocks.settings }))
vi.mock('../../app/features/tab/mock', () => ({ getSeedForUser: mocks.seed }))
vi.mock('../../app/features/tab/favicon', () => ({ fetchFavicon: mocks.favicon }))

const wrappers: { unmount(): void }[] = []
const stateKeys = [
  'tab-categories',
  'tab-bookmarks',
  'tab-loaded',
  'tab-loading',
  'tab-error',
  'tab-active-category',
  'tab-viewing-scope',
]

function category(id: string, sortOrder = 0): BookmarkCategory {
  return { id, userId: 'owner-001', name: `分组 ${id}`, icon: 'lucide:folder', color: '', sortOrder }
}

function bookmark(id: string, categoryId = 'first', sortOrder = 0): Bookmark {
  return { id, userId: 'owner-001', name: `书签 ${id}`, url: `https://example.com/${id}`, categoryId, sortOrder }
}

function login(id = 'real-owner-uuid', role: CurrentUser['role'] = 'owner') {
  mocks.auth.currentUser.value = { id, role }
  mocks.auth.isLoggedIn.value = true
}

async function setup() {
  let state!: ReturnType<typeof useTabBookmarks>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          clearNuxtState(stateKeys)
          state = useTabBookmarks()
          return () => h('div')
        },
      }),
    ),
  )
  return state
}

beforeEach(() => {
  Object.values(mocks.repo).forEach((mock) => mock.mockReset())
  mocks.openLogin.mockReset()
  mocks.seed.mockReset().mockReturnValue({ categories: [], bookmarks: [] })
  mocks.favicon.mockReset().mockResolvedValue(null)
  mocks.auth = { currentUser: ref(null), isLoggedIn: ref(false) }
  mocks.settings = ref({ faviconAutoFetch: false, faviconProvider: 'google' })
  mocks.repo.listCategories.mockResolvedValue([category('first'), category('second', 1)])
  mocks.repo.listBookmarks.mockResolvedValue([
    bookmark('one', 'first'),
    bookmark('two', 'second', 1),
    bookmark('three', 'first', 2),
  ])
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('标签页书签', () => {
  it('匿名读取博主书签，默认选择首分类并计算分类计数；已加载时复用，强制刷新重新读取', async () => {
    const state = await setup()

    await state.load()

    expect(mocks.repo.listCategories).toHaveBeenCalledWith('owner-001')
    expect(mocks.repo.listBookmarks).toHaveBeenCalledWith('owner-001')
    expect(state.isReadOnly.value).toBe(true)
    expect(state.viewingScope.value).toBe('owner')
    expect(state.activeCategoryId.value).toBe('first')
    expect(state.visibleBookmarks.value.map((item) => item.id)).toEqual(['one', 'three'])
    expect(state.categoryCounts.value).toEqual({ first: 2, second: 1 })
    state.selectCategory(null)
    expect(state.visibleBookmarks.value).toHaveLength(3)
    state.selectCategory('second')
    await state.load()
    expect(mocks.repo.listCategories).toHaveBeenCalledTimes(1)
    await state.load(true)
    expect(mocks.repo.listCategories).toHaveBeenCalledTimes(2)
    expect(state.activeCategoryId.value).toBe('second')
    expect(state.loaded.value).toBe(true)
    expect(state.loading.value).toBe(false)
  })

  it('匿名增删改与导入提示登录，排序直接拒绝且不调用仓储写入', async () => {
    const state = await setup()
    const draft = { name: '文档', url: 'https://example.com/docs', categoryId: 'first' }

    expect(await state.addBookmark(draft)).toBeNull()
    expect(await state.updateBookmark('one', { name: '新名称' })).toBeNull()
    expect(await state.removeBookmark('one')).toBe(false)
    expect(await state.addCategory({ name: '资料', icon: 'lucide:folder', color: '' })).toBeNull()
    expect(await state.removeCategory('first')).toBe(false)
    expect(await state.importBulk({ categories: [], bookmarks: [] }, 'merge')).toBe(false)
    expect(await state.reorderBookmarks([{ id: 'one', categoryId: 'first', sortOrder: 2 }])).toBe(false)
    expect(await state.reorderCategories([{ id: 'first', sortOrder: 2 }])).toBe(false)

    expect(mocks.openLogin).toHaveBeenCalledTimes(6)
    expect(mocks.openLogin).toHaveBeenCalledWith('login')
    for (const method of Object.values(mocks.repo)) expect(method).not.toHaveBeenCalled()
  })

  it.each([false, true])('未建立完整身份时拒绝刷新图标（登录标记：%s）', async (isLoggedIn) => {
    const state = await setup()
    await state.load()
    mocks.auth.isLoggedIn.value = isLoggedIn

    expect(await state.refreshFavicon('one')).toBe(false)

    expect(mocks.openLogin).toHaveBeenCalledExactlyOnceWith('login')
    expect(mocks.favicon).not.toHaveBeenCalled()
    expect(mocks.repo.updateBookmark).not.toHaveBeenCalled()
    expect(state.bookmarks.value[0]).toEqual(bookmark('one'))
  })

  it('真实博主 UUID 始终使用已有本机博主归属，增改删只在仓储成功后同步列表', async () => {
    login()
    const state = await setup()
    await state.load()
    const draft = { name: '文档', url: 'https://example.com/docs', categoryId: 'first' }
    const created = { ...bookmark('new'), ...draft }
    mocks.repo.createBookmark.mockResolvedValue(created)
    mocks.repo.updateBookmark.mockResolvedValue({ ...created, name: '新版文档' })

    expect(await state.addBookmark(draft)).toEqual(created)
    expect(mocks.repo.createBookmark).toHaveBeenCalledWith('owner-001', draft)
    expect(mocks.repo.listCategories).toHaveBeenCalledWith('owner-001')
    expect(state.isReadOnly.value).toBe(false)
    expect(state.viewingScope.value).toBe('self')
    expect(await state.updateBookmark('new', { name: '新版文档' })).toMatchObject({ name: '新版文档' })
    expect(state.bookmarks.value.at(-1)?.name).toBe('新版文档')
    expect(await state.removeBookmark('new')).toBe(true)
    expect(mocks.repo.removeBookmark).toHaveBeenCalledWith('new')
    expect(state.bookmarks.value.map((item) => item.id)).toEqual(['one', 'two', 'three'])
  })

  it('首次空分类按名称映射种子书签，跳过不存在的分类，后续加载不重复初始化', async () => {
    const draft = { name: '资料', icon: 'lucide:folder', color: '' }
    mocks.repo.listCategories.mockResolvedValue([])
    mocks.repo.listBookmarks.mockResolvedValueOnce([]).mockResolvedValue([bookmark('seed', 'created')])
    mocks.repo.createCategory.mockResolvedValue({ ...category('created'), ...draft })
    mocks.seed.mockReturnValue({
      categories: [draft],
      bookmarks: [
        { categoryName: '资料', name: '手册', url: 'https://example.com/manual', icon: 'lucide:book', color: '' },
        { categoryName: '已删除分类', name: '旧链接', url: 'https://example.com/old' },
      ],
    })
    const state = await setup()

    await state.load()
    await state.load()

    expect(mocks.seed).toHaveBeenCalledWith('owner-001')
    expect(mocks.repo.createCategory).toHaveBeenCalledExactlyOnceWith('owner-001', draft)
    expect(mocks.repo.createBookmark).toHaveBeenCalledExactlyOnceWith('owner-001', {
      categoryId: 'created',
      name: '手册',
      url: 'https://example.com/manual',
      icon: 'lucide:book',
      color: '',
    })
    expect(state.activeCategoryId.value).toBe('created')
    expect(state.bookmarks.value).toEqual([bookmark('seed', 'created')])
  })

  it('从匿名切换登录范围会重新读取并丢弃上一范围的分类选择；空列表清空选择', async () => {
    const state = await setup()
    await state.load()
    state.selectCategory('second')
    login('visitor-custom', 'visitor')
    mocks.repo.listCategories.mockResolvedValue([category('personal')])
    mocks.repo.listBookmarks.mockResolvedValue([bookmark('mine', 'personal')])

    await state.load()

    expect(mocks.repo.listCategories).toHaveBeenLastCalledWith('visitor-custom')
    expect(state.activeCategoryId.value).toBe('personal')
    expect(state.visibleBookmarks.value.map((item) => item.id)).toEqual(['mine'])
    mocks.repo.listCategories.mockResolvedValue([])
    mocks.repo.listBookmarks.mockResolvedValue([])
    await state.load(true)
    expect(state.activeCategoryId.value).toBeNull()
    expect(state.bookmarks.value).toEqual([])
  })

  it('读取失败保留上次成功列表，结束加载并支持强制重试清除错误', async () => {
    const state = await setup()
    await state.load()
    mocks.repo.listBookmarks.mockRejectedValueOnce(new Error('浏览器存储不可用'))

    await state.load(true)

    expect(state.error.value).toBe('浏览器存储不可用')
    expect(state.loading.value).toBe(false)
    expect(state.bookmarks.value.map((item) => item.id)).toEqual(['one', 'two', 'three'])
    expect(state.categories.value.map((item) => item.id)).toEqual(['first', 'second'])
    await state.load(true)
    expect(state.error.value).toBeNull()
  })

  it('书签排序失败保留原顺序和归属，重试成功才更新并重排', async () => {
    login()
    const state = await setup()
    await state.load()
    const updates = [{ id: 'three', categoryId: 'second', sortOrder: -1 }]
    mocks.repo.reorderBookmarks.mockRejectedValueOnce(new Error('存储空间不足'))

    expect(await state.reorderBookmarks(updates)).toBe(false)
    expect(state.error.value).toContain('书签排序未保存')
    expect(state.bookmarks.value.map((item) => [item.id, item.categoryId])).toEqual([
      ['one', 'first'],
      ['two', 'second'],
      ['three', 'first'],
    ])
    expect(await state.reorderBookmarks(updates)).toBe(true)
    expect(mocks.repo.reorderBookmarks).toHaveBeenLastCalledWith('owner-001', updates)
    expect(state.bookmarks.value.map((item) => item.id)).toEqual(['three', 'one', 'two'])
    expect(state.categoryCounts.value).toEqual({ second: 2, first: 1 })
    expect(state.error.value).toBeNull()
  })

  it('分类排序失败保留原顺序，成功后按新序号排列', async () => {
    login()
    const state = await setup()
    await state.load()
    const updates = [{ id: 'second', sortOrder: -1 }]
    mocks.repo.reorderCategories.mockRejectedValueOnce(new Error('存储空间不足'))

    expect(await state.reorderCategories(updates)).toBe(false)
    expect(state.categories.value.map((item) => item.id)).toEqual(['first', 'second'])
    expect(state.error.value).toContain('分组排序未保存')
    expect(await state.reorderCategories(updates)).toBe(true)
    expect(mocks.repo.reorderCategories).toHaveBeenLastCalledWith('owner-001', updates)
    expect(state.categories.value.map((item) => item.id)).toEqual(['second', 'first'])
    expect(state.error.value).toBeNull()
  })

  it('分类创建使用博主归属；删除失败保留列表，成功后同步删除书签并切换选中分类', async () => {
    login()
    const state = await setup()
    await state.load()
    const draft = { name: '收藏', icon: 'lucide:folder', color: '' }
    mocks.repo.createCategory.mockResolvedValue({ ...category('new'), ...draft })
    await state.addCategory(draft)
    expect(mocks.repo.createCategory).toHaveBeenCalledWith('owner-001', draft)
    expect(state.categories.value.at(-1)?.name).toBe('收藏')
    mocks.repo.removeCategory.mockRejectedValueOnce(new Error('写入失败'))

    await expect(state.removeCategory('first')).rejects.toThrow('写入失败')
    expect(state.categories.value).toHaveLength(3)
    expect(state.bookmarks.value).toHaveLength(3)
    expect(state.activeCategoryId.value).toBe('first')
    expect(await state.removeCategory('first')).toBe(true)
    expect(state.bookmarks.value.map((item) => item.id)).toEqual(['two'])
    expect(state.activeCategoryId.value).toBe('second')
    await state.removeCategory('second')
    await state.removeCategory('new')
    expect(state.activeCategoryId.value).toBeNull()
    expect(state.bookmarks.value).toEqual([])
  })

  it('自动图标抓取按设置开启并缓存结果，Lucide 图标无需抓取', async () => {
    login()
    mocks.settings.value = { faviconAutoFetch: true, faviconProvider: 'duckduckgo' }
    const state = await setup()
    const created = bookmark('new')
    const faviconUrl = 'https://example.com/favicon.ico'
    mocks.repo.createBookmark
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ ...created, id: 'lucide', icon: 'lucide:book' })
    mocks.favicon.mockResolvedValue(faviconUrl)
    mocks.repo.updateBookmark.mockResolvedValue({ ...created, faviconUrl, faviconFailed: false })

    await state.addBookmark(created)
    await flushPromises()

    expect(mocks.favicon).toHaveBeenCalledWith(created.url, 'duckduckgo')
    expect(mocks.repo.updateBookmark).toHaveBeenCalledWith('new', { faviconUrl, faviconFailed: false })
    expect(state.bookmarks.value[0]?.faviconUrl).toBe(faviconUrl)
    await state.addBookmark({ ...created, icon: 'lucide:book' })
    await flushPromises()
    expect(mocks.favicon).toHaveBeenCalledTimes(1)
  })

  it('手动刷新缺失书签不请求；图标无法获取时保存失败标记', async () => {
    login()
    const state = await setup()
    await state.load()
    mocks.repo.updateBookmark.mockResolvedValue({ ...bookmark('one'), faviconFailed: true })

    expect(await state.refreshFavicon('missing')).toBe(false)
    expect(mocks.favicon).not.toHaveBeenCalled()
    expect(await state.refreshFavicon('one')).toBe(true)
    expect(mocks.repo.updateBookmark).toHaveBeenCalledWith('one', { faviconUrl: undefined, faviconFailed: true })
    expect(state.bookmarks.value[0]?.faviconFailed).toBe(true)
  })

  it('导入透传策略后强制重读，导出仍使用稳定博主归属', async () => {
    login()
    const state = await setup()
    await state.load()
    const payload: ImportPayload = {
      categories: [{ name: '导入收藏', icon: 'lucide:folder', color: '' }],
      bookmarks: [],
    }
    const imported = [category('imported')]
    mocks.repo.listCategories.mockResolvedValue(imported)
    mocks.repo.listBookmarks.mockResolvedValue([])
    mocks.repo.exportBulk.mockResolvedValue({ categories: imported, bookmarks: [] })

    expect(await state.importBulk(payload, 'replace')).toBe(true)
    expect(mocks.repo.importBulk).toHaveBeenCalledWith('owner-001', payload, 'replace')
    expect(mocks.repo.listCategories).toHaveBeenCalledTimes(2)
    expect(state.categories.value).toEqual(imported)
    expect(state.activeCategoryId.value).toBe('imported')
    expect(await state.exportBulk()).toEqual({ categories: imported, bookmarks: [] })
    expect(mocks.repo.exportBulk).toHaveBeenCalledWith('owner-001')
  })
})
