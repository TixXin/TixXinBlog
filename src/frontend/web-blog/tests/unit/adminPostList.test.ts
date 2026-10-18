/** @file adminPostList.test.ts @description 后台文章页码、跨页选择、全量筛选读取及请求归属回归。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PostsPage from '../../app/pages/admin/posts/index.vue'
import type { AdminPostListRow } from '../../app/features/post/types'
import type { PostBatchResult } from '../../app/features/post/batchTypes'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  review: vi.fn(),
  push: vi.fn(),
  auth: {} as {
    currentUser: Ref<{ id: string } | null>
    isLoggedIn: Ref<boolean>
    restore: ReturnType<typeof vi.fn>
  },
  route: {} as { path: string; fullPath: string; query: Record<string, string> },
  batch: {} as Record<string, unknown>,
  changed: undefined as ((result: PostBatchResult) => Promise<void>) | undefined,
}))
mockNuxtImport('useAdminApi', () => () => mocks.api)
mockNuxtImport('useCurrentUser', () => () => mocks.auth)
mockNuxtImport('useToast', () => () => ({ success: vi.fn() }))
mockNuxtImport('useRoute', () => () => mocks.route)
mockNuxtImport('useRouter', () => () => ({
  push: mocks.push,
  replace: mocks.push,
  resolve: ({ query }: { query: Record<string, string> }) => ({
    fullPath: '/admin/posts?' + new URLSearchParams(query),
  }),
  afterEach: () => () => undefined,
  beforeEach: () => () => undefined,
}))
mockNuxtImport('usePostBatch', () => (changed: (result: PostBatchResult) => Promise<void>) => {
  mocks.changed = changed
  return mocks.batch
})
const wrappers: VueWrapper[] = []
let rows: AdminPostListRow[] = []
function row(id: number): AdminPostListRow {
  return {
    id,
    revision: id + 1,
    title: `文章 ${id}`,
    deleted: false,
    status: 'draft',
    category: 'tech',
    folder: '开发笔记',
    tags: ['Vue'],
    pinned: false,
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
}
function setRoute(query: Record<string, string>) {
  Object.assign(mocks.route, { query, fullPath: '/admin/posts?' + new URLSearchParams(query) })
}
function readList(path: string, options?: { query?: Record<string, string | number | undefined> }) {
  if (path === '/admin/posts/filters') return { folders: ['开发笔记'], tags: ['Vue'] }
  if (path !== '/admin/posts') throw new Error(path)
  const page = Number(options?.query?.page ?? 1)
  const size = Number(options?.query?.pageSize ?? 20)
  return { items: rows.slice((page - 1) * size, page * size), total: rows.length }
}
function button(wrapper: VueWrapper, text: string) {
  const target = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!target) throw new Error(`找不到按钮：${text}`)
  return target
}
async function mountPage() {
  const wrapper = await mountSuspended(PostsPage, { global: { stubs: { AdminPostBatch: true } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  mocks.api.mockReset().mockImplementation(async (path, options) => readList(path, options))
  mocks.review.mockReset()
  mocks.push.mockReset().mockImplementation(async (to) => {
    // 挂载阶段可能用字符串地址调用路由；只有带查询对象的导航才同步测试路由。
    if (!to || typeof to !== 'object' || !to.query) return
    setRoute(to.query)
  })
  mocks.auth = { currentUser: ref({ id: 'owner' }), isLoggedIn: ref(true), restore: vi.fn().mockResolvedValue(true) }
  mocks.route = reactive({ path: '/admin/posts', fullPath: '/admin/posts', query: {} })
  mocks.batch = {
    open: ref(false),
    acknowledgement: ref(''),
    preview: ref(null),
    result: ref(null),
    pending: ref(false),
    error: ref(''),
    attempted: ref(false),
    recent: ref([]),
    recentError: ref(''),
    batchIndex: ref(1),
    batchCount: ref(0),
    totalCount: ref(0),
    canNext: ref(false),
    review: mocks.review,
    loadRecent: vi.fn(),
    inspect: vi.fn(),
    execute: vi.fn(),
    queryResult: vi.fn(),
    nextBatch: vi.fn(),
  }
  rows = Array.from({ length: 45 }, (_, index) => row(index + 1))
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

it('跨页保留选择、半选状态和原始版本，取消本页全选不影响其他页', async () => {
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  expect((page.get('.admin-posts__batch input').element as HTMLInputElement).indeterminate).toBe(true)
  await button(page, '下一页').trigger('click')
  await flushPromises()
  await page.get('.admin-posts__batch input').setValue(true)
  expect(page.text()).toContain('已选 21 篇（跨页保留）')
  await page.get('.admin-posts__batch input').setValue(false)
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
  await page.get('input[aria-label="选择文章：文章 21"]').setValue(true)
  rows[0] = { ...rows[0]!, revision: 99 }
  await button(page, '上一页').trigger('click')
  await flushPromises()
  expect((page.get('input[aria-label="选择文章：文章 1"]').element as HTMLInputElement).checked).toBe(true)
  await button(page, '预览批量操作').trigger('click')
  expect(mocks.review).toHaveBeenCalledWith('archive', [
    { id: 1, revision: 2 },
    { id: 21, revision: 22 },
  ])
  await button(page, '清空选择').trigger('click')
  expect(page.text()).toContain('已选 0 篇（跨页保留）')
})

it('页码和跳页保留已应用筛选，排序保留选择，筛选变化清空选择', async () => {
  rows = Array.from({ length: 200 }, (_, index) => row(index + 1))
  setRoute({ status: 'draft', folder: '开发笔记', tag: 'Vue' })
  const page = await mountPage()
  expect(page.get('[aria-current="page"]').text()).toBe('1')
  expect(page.findAll('.admin-posts__pagination button[aria-label]').length).toBeLessThanOrEqual(7)
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  await page.get('input[aria-label="搜索文章标题"]').setValue('尚未提交')
  await page.get('#admin-posts-page').setValue(8)
  await page.get('.admin-posts__jump').trigger('submit')
  await flushPromises()
  expect(mocks.route.query).toMatchObject({ page: '8', status: 'draft', folder: '开发笔记', tag: 'Vue' })
  expect(mocks.route.query.search).toBeUndefined()
  expect((page.get('input[aria-label="搜索文章标题"]').element as HTMLInputElement).value).toBe('尚未提交')
  expect(page.get('[aria-current="page"]').text()).toBe('8')
  await page.get('select[aria-label="排序方向"]').setValue('asc')
  await flushPromises()
  expect(mocks.route.query.search).toBeUndefined()
  expect(mocks.route.query.order).toBe('asc')
  expect(mocks.route.query.page).toBeUndefined()
  expect((page.get('input[aria-label="搜索文章标题"]').element as HTMLInputElement).value).toBe('尚未提交')
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
  await page.get('select[aria-label="文章状态"]').setValue('published')
  await flushPromises()
  expect(page.text()).toContain('已选 0 篇（跨页保留）')
  expect(mocks.route.query.page).toBeUndefined()
})

it('拒绝无效跳页，越界地址修正到末页，空列表停在第一页', async () => {
  setRoute({ page: '99' })
  const page = await mountPage()
  expect(page.get('[aria-current="page"]').text()).toBe('3')
  expect(button(page, '下一页').attributes('disabled')).toBeDefined()
  mocks.push.mockClear()
  for (const value of ['', 0, -1, 1.5, 4]) {
    await page.get('#admin-posts-page').setValue(value)
    await page.get('.admin-posts__jump').trigger('submit')
  }
  expect(mocks.push).not.toHaveBeenCalled()
  rows = []
  setRoute({ status: 'trash', page: '2' })
  await flushPromises()
  expect(page.text()).toContain('第 1 / 1 页 · 共 0 篇')
  expect(button(page, '上一页').attributes('disabled')).toBeDefined()
  expect(button(page, '下一页').attributes('disabled')).toBeDefined()
})

it('全部筛选按每页100篇读取，预览包含所有页面的编号和版本', async () => {
  rows = Array.from({ length: 121 }, (_, index) => row(index + 1))
  setRoute({ status: 'draft', category: 'tech', folder: '开发笔记', tag: 'Vue', search: '文章' })
  const page = await mountPage()
  await button(page, '选择全部筛选结果').trigger('click')
  await flushPromises()
  expect(page.text()).toContain('已选 121 篇（跨页保留）')
  const reads = mocks.api.mock.calls.filter(
    ([path, options]) => path === '/admin/posts' && options.query.pageSize === 100,
  )
  expect(reads.map(([, options]) => options.query.page)).toEqual([1, 2])
  expect(reads[1]![1].query).toMatchObject({
    status: 'draft',
    category: 'tech',
    folder: '开发笔记',
    tag: 'Vue',
    search: '文章',
  })
  await button(page, '预览批量操作').trigger('click')
  expect(mocks.review).toHaveBeenCalledWith(
    'archive',
    rows.map(({ id, revision }) => ({ id, revision })),
  )
})

it('后续页失败不会留下部分全选，重试可成功；超上限禁用全选', async () => {
  rows = Array.from({ length: 121 }, (_, index) => row(index + 1))
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  mocks.api.mockImplementation(async (path, options) => {
    if (options?.query?.pageSize === 100 && options.query.page === 2) throw new Error('网络失败')
    return readList(path, options)
  })
  await button(page, '选择全部筛选结果').trigger('click')
  await flushPromises()
  expect(page.text()).toContain('原有选择已保留')
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
  mocks.api.mockImplementation(async (path, options) => readList(path, options))
  await button(page, '选择全部筛选结果').trigger('click')
  await flushPromises()
  expect(page.text()).toContain('已选 121 篇（跨页保留）')
  rows = Array.from({ length: 501 }, (_, index) => row(index + 1))
  setRoute({ status: 'published' })
  await flushPromises()
  expect(button(page, '选择全部筛选结果').attributes('disabled')).toBeDefined()
  expect(page.text()).toContain('筛选结果超过上限')
})

it.each(['total', 'duplicate'])('全选期间检测到%s变化时保留原选择', async (kind) => {
  rows = Array.from({ length: 121 }, (_, index) => row(index + 1))
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  mocks.api.mockImplementation(async (path, options) => {
    const value = readList(path, options)
    if (options?.query?.pageSize === 100 && options.query.page === 2 && 'items' in value)
      return kind === 'total' ? { ...value, total: 122 } : { ...value, items: [row(1), ...value.items.slice(1)] }
    return value
  })
  await button(page, '选择全部筛选结果').trigger('click')
  await flushPromises()
  expect(page.text()).toContain('重新全选')
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
})

it.each(['clear', 'filter', 'owner'])('全选读取期间%s撤销后忽略迟到结果', async (action) => {
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  let finish!: (value: unknown) => void
  mocks.api.mockImplementation((path, options) =>
    options?.query?.pageSize === 100
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Promise.resolve(readList(path, options)),
  )
  await button(page, '选择全部筛选结果').trigger('click')
  if (action === 'clear') await button(page, '取消全选并清空').trigger('click')
  else if (action === 'filter') setRoute({ status: 'archived' })
  else mocks.auth.currentUser.value = { id: 'other-owner' }
  await flushPromises()
  finish({ items: rows, total: rows.length })
  await flushPromises()
  expect(page.text()).toContain('已选 0 篇（跨页保留）')
  expect(page.text()).not.toContain('正在读取筛选结果')
})

it('执行回调只移除成功项，失败项保留原版本供重新核对', async () => {
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  await page.get('input[aria-label="选择文章：文章 2"]').setValue(true)
  await mocks.changed!({
    preview: { items: [row(1), row(2)] },
    results: [
      { id: 1, success: true },
      { id: 2, success: false },
    ],
  } as PostBatchResult)
  await flushPromises()
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
  expect((page.get('input[aria-label="选择文章：文章 2"]').element as HTMLInputElement).checked).toBe(true)
})

it('末页移除后只修正页码，不提交搜索框里的草稿', async () => {
  rows = Array.from({ length: 21 }, (_, index) => row(index + 1))
  setRoute({ page: '2', status: 'draft' })
  const page = await mountPage()
  await page.get('input[aria-label="搜索文章标题"]').setValue('尚未提交')
  rows = rows.slice(0, 20)
  await mocks.changed!({
    preview: { items: [row(21)] },
    results: [{ id: 21, success: true }],
  } as PostBatchResult)
  await flushPromises()
  expect(mocks.route.query).toMatchObject({ status: 'draft' })
  expect(mocks.route.query.search).toBeUndefined()
  expect(mocks.route.query.page).toBeUndefined()
  expect(page.text()).toContain('第 1 / 1 页 · 共 20 篇')
})

it('浏览器历史切换页码保留选择，旧页迟到响应不覆盖新页', async () => {
  const page = await mountPage()
  await page.get('input[aria-label="选择文章：文章 1"]').setValue(true)
  let finish!: (value: unknown) => void
  mocks.api.mockImplementation((path, options) =>
    options?.query?.page === 2
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Promise.resolve(readList(path, options)),
  )
  setRoute({ page: '2' })
  await flushPromises()
  setRoute({ page: '3' })
  await flushPromises()
  finish({ items: rows.slice(20, 40), total: rows.length })
  await flushPromises()
  expect(page.get('[aria-current="page"]').text()).toBe('3')
  expect(page.find('input[aria-label="选择文章：文章 41"]').exists()).toBe(true)
  expect(page.find('input[aria-label="选择文章：文章 21"]').exists()).toBe(false)
  expect(page.text()).toContain('已选 1 篇（跨页保留）')
})
