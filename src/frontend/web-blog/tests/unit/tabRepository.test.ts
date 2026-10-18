/** @file tabRepository.test.ts @description 本地书签仓库的存储、排序和导入隔离回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalTabRepository } from '../../app/features/tab/repository.local'
import type { ImportPayload } from '../../app/features/tab/types'

const owner = 'tab-owner'
const visitor = 'tab-visitor'
const categoryKey = `tab:categories:${owner}`
const bookmarkKey = `tab:bookmarks:${owner}`
const categoryDraft = { name: '开发', icon: 'lucide:code', color: '#567890' }
const imported: ImportPayload = {
  categories: [categoryDraft, { name: '阅读', icon: 'lucide:book', color: '#333333' }],
  bookmarks: [
    { name: 'Vue 文档', url: 'https://vuejs.org', categoryName: '开发' },
    { name: 'Nuxt 文档', url: 'https://nuxt.com', categoryName: '开发', description: '框架指南' },
    { name: 'MDN', url: 'https://developer.mozilla.org', categoryName: '阅读' },
  ],
}

async function seed(repo: LocalTabRepository, userId = owner) {
  const category = await repo.createCategory(userId, categoryDraft)
  const bookmark = await repo.createBookmark(userId, {
    name: 'Vue',
    url: 'https://vuejs.org',
    categoryId: category.id,
  })
  return { category, bookmark }
}

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() {
      return data.size
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('本地书签仓库读写', () => {
  it.each(['{broken', '{}', 'null'])('无效列表 %s 回退空数组，读取不覆盖原数据', async (raw) => {
    localStorage.setItem(categoryKey, raw)
    localStorage.setItem(bookmarkKey, raw)
    const repo = new LocalTabRepository()
    expect(await repo.listCategories(owner)).toEqual([])
    expect(await repo.listBookmarks(owner)).toEqual([])
    expect(localStorage.getItem(categoryKey)).toBe(raw)
    expect(localStorage.getItem(bookmarkKey)).toBe(raw)
  })

  it('分类和书签跨仓库实例持久化，导出按排序读取并隔离其他用户', async () => {
    const repo = new LocalTabRepository()
    const first = await seed(repo)
    const other = await seed(repo, visitor)
    const secondCategory = await repo.createCategory(owner, { ...categoryDraft, name: '阅读' })
    const secondBookmark = await repo.createBookmark(owner, {
      name: 'MDN',
      url: 'https://developer.mozilla.org',
      categoryId: secondCategory.id,
    })
    await repo.reorderCategories(owner, [
      { id: secondCategory.id, sortOrder: 0 },
      { id: other.category.id, sortOrder: -1 },
    ])
    await repo.reorderBookmarks(owner, [
      { id: secondBookmark.id, categoryId: first.category.id, sortOrder: 0 },
      { id: other.bookmark.id, categoryId: first.category.id, sortOrder: -1 },
    ])
    const restored = await new LocalTabRepository().exportBulk(owner)
    expect(restored.categories.map((category) => category.id)).toEqual([secondCategory.id, first.category.id])
    expect(restored.bookmarks.map((bookmark) => bookmark.id)).toEqual([secondBookmark.id, first.bookmark.id])
    expect(restored.bookmarks[0]?.categoryId).toBe(first.category.id)
    expect(await repo.exportBulk(visitor)).toEqual({ categories: [other.category], bookmarks: [other.bookmark] })
  })

  it('书签写入被禁止时明确报告未保存，原数据不变', async () => {
    const repo = new LocalTabRepository()
    const { bookmark } = await seed(repo)
    const original = localStorage.getItem(bookmarkKey)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('存储被禁用', 'SecurityError')
    })
    await expect((async () => repo.updateBookmark(bookmark.id, { name: '未保存名称' }))()).rejects.toThrow('尚未保存')
    expect(localStorage.getItem(bookmarkKey)).toBe(original)
  })

  it('读取前恢复异常中断的导入，恢复失败时保留备份并报告错误', async () => {
    const repo = new LocalTabRepository()
    const existing = await seed(repo)
    const categories = localStorage.getItem(categoryKey)
    const bookmarks = localStorage.getItem(bookmarkKey)
    localStorage.setItem(
      'blog-local-write-backup',
      JSON.stringify([
        [categoryKey, categories],
        [bookmarkKey, bookmarks],
      ]),
    )
    localStorage.setItem(categoryKey, '[]')
    expect(await repo.exportBulk(owner)).toEqual({ categories: [existing.category], bookmarks: [existing.bookmark] })
    expect(localStorage.getItem('blog-local-write-backup')).toBeNull()

    const backup = JSON.stringify([
      [categoryKey, categories],
      [bookmarkKey, bookmarks],
    ])
    localStorage.setItem('blog-local-write-backup', backup)
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('存储空间不足', 'QuotaExceededError')
    })
    await expect((async () => repo.listCategories(owner))()).rejects.toThrow('备份恢复失败')
    expect(localStorage.getItem('blog-local-write-backup')).toBe(backup)
  })
})

describe('本地书签批量导入', () => {
  it('merge 复用同名分类，按分类与 URL 去重并保持既有编辑', async () => {
    const repo = new LocalTabRepository()
    const { category, bookmark } = await seed(repo)
    await repo.importBulk(owner, imported, 'merge')
    const exported = await repo.exportBulk(owner)
    expect(exported.categories).toHaveLength(2)
    expect(exported.categories.find((item) => item.name === '开发')?.id).toBe(category.id)
    expect(exported.bookmarks).toHaveLength(3)
    expect(exported.bookmarks.find((item) => item.url === 'https://vuejs.org')).toEqual(bookmark)
    expect(exported.bookmarks.find((item) => item.name === 'Nuxt 文档')).toMatchObject({
      categoryId: category.id,
      sortOrder: 2,
      description: '框架指南',
    })
    await repo.importBulk(owner, imported, 'merge')
    expect(await repo.exportBulk(owner)).toEqual(exported)
  })

  it('append 保留原分类并建立独立的新分类映射，不覆盖旧书签', async () => {
    const repo = new LocalTabRepository()
    const { category, bookmark } = await seed(repo)
    await repo.importBulk(owner, imported, 'append')
    const exported = await repo.exportBulk(owner)
    expect(exported.categories).toHaveLength(3)
    expect(exported.bookmarks).toHaveLength(4)
    expect(exported.bookmarks.find((item) => item.id === bookmark.id)).toEqual(bookmark)
    const newCategory = exported.categories.find((item) => item.name === category.name && item.id !== category.id)!
    expect(exported.bookmarks.filter((item) => item.categoryId === newCategory.id).map((item) => item.name)).toEqual([
      'Vue 文档',
      'Nuxt 文档',
    ])
  })

  it('replace 只替换目标用户，所有新书签关联重新生成的分类', async () => {
    const repo = new LocalTabRepository()
    const previous = await seed(repo)
    const other = await seed(repo, visitor)
    await repo.importBulk(owner, imported, 'replace')
    const exported = await repo.exportBulk(owner)
    expect(exported.categories).toHaveLength(2)
    expect(exported.bookmarks).toHaveLength(3)
    expect(exported.categories.some((item) => item.id === previous.category.id)).toBe(false)
    expect(exported.bookmarks.some((item) => item.id === previous.bookmark.id)).toBe(false)
    for (const bookmark of exported.bookmarks) {
      const source = imported.bookmarks.find((item) => item.url === bookmark.url)!
      expect(exported.categories.find((item) => item.id === bookmark.categoryId)?.name).toBe(source.categoryName)
      expect(bookmark.userId).toBe(owner)
    }
    expect(await repo.exportBulk(visitor)).toEqual({ categories: [other.category], bookmarks: [other.bookmark] })
  })

  it('导入第二个存储键失败时回滚两个原值，其他用户不受影响', async () => {
    const repo = new LocalTabRepository()
    const original = await seed(repo)
    const other = await seed(repo, visitor)
    const beforeCategories = localStorage.getItem(categoryKey)
    const beforeBookmarks = localStorage.getItem(bookmarkKey)
    const setItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === bookmarkKey && value !== beforeBookmarks) throw new DOMException('存储空间不足', 'QuotaExceededError')
      setItem(key, value)
    })
    await expect(repo.importBulk(owner, imported, 'replace')).rejects.toThrow('尚未保存')
    expect(localStorage.getItem(categoryKey)).toBe(beforeCategories)
    expect(localStorage.getItem(bookmarkKey)).toBe(beforeBookmarks)
    expect(await repo.exportBulk(owner)).toEqual({ categories: [original.category], bookmarks: [original.bookmark] })
    expect(await repo.exportBulk(visitor)).toEqual({ categories: [other.category], bookmarks: [other.bookmark] })
    expect(localStorage.getItem('blog-local-write-backup')).toBeNull()
  })

  it('备份写入被禁止时不开始覆盖已有数据', async () => {
    const repo = new LocalTabRepository()
    const existing = await seed(repo)
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('浏览器禁止存储', 'SecurityError')
    })
    await expect(repo.importBulk(owner, imported, 'replace')).rejects.toThrow('尚未保存')
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]?.[0]).toBe('blog-local-write-backup')
    expect(await repo.exportBulk(owner)).toEqual({ categories: [existing.category], bookmarks: [existing.bookmark] })
  })
})
