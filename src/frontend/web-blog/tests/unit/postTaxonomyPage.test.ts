/** @file postTaxonomyPage.test.ts @description 标签与专栏页按原名定位、用接口标识分页，并给出独立标题、描述和 canonical。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TagPage from '../../app/pages/tags/[name].vue'
import CategoryPage from '../../app/pages/categories/[slug].vue'
import { resolvePostTaxonomy } from '../../app/features/post/taxonomy'
import type { PostItem, PostSummary } from '../../app/features/post/types'

const summary: PostSummary = {
  tags: [
    { label: 'Vue 3', slug: 'vue-3', color: 'blue', count: 2 },
    { label: '空标签', slug: 'empty', color: 'sky', count: 0 },
  ],
  categories: [
    { name: '前端 / 工程', count: 2 },
    { name: '空专栏', count: 0 },
  ],
  stats: { posts: 2, views: 0, comments: 0, tags: 1, siteAgeDays: 1 },
}
const post: PostItem = {
  id: 7,
  title: '组合式函数笔记',
  summary: '记录一次整理',
  tags: [{ label: 'Vue 3', color: 'blue' }],
  category: 'tech',
  readTime: 5,
  likes: 1,
  views: 2,
  comments: 0,
  date: '2026-10-01',
  folder: '前端 / 工程',
}
const mocks = vi.hoisted(() => ({
  summary: null as PostSummary | null,
  metadataError: null as Error | null,
  posts: [] as PostItem[],
  total: 1,
  listError: null as Error | null,
  refresh: vi.fn(),
  list: vi.fn(),
}))
mockNuxtImport('usePostMetadata', () => async () => ({
  metadata: ref(mocks.summary),
  error: ref(mocks.metadataError),
}))
mockNuxtImport('usePostList', () => async (options: unknown) => {
  mocks.list(options)
  return {
    posts: ref(mocks.posts),
    total: ref(mocks.total),
    pending: ref(false),
    error: ref(mocks.listError),
    refresh: mocks.refresh,
    pageSize: 15,
  }
})

const List = defineComponent({
  name: 'BlogPostCardList',
  props: {
    posts: { type: Array, required: true },
    total: { type: Number, required: true },
    currentPage: { type: Number, required: true },
    errorMessage: { type: String, default: '' },
  },
  emits: ['page', 'retry'],
  setup(props, { emit }) {
    return () =>
      h('div', [
        h('p', { class: 'list-state' }, `${props.currentPage}/${props.total}/${props.errorMessage}`),
        ...((props.posts as PostItem[] | undefined) ?? []).map((item) => h('article', item.title)),
        h(
          'button',
          { type: 'button', class: 'next-page', onClick: () => emit('page', Number(props.currentPage) + 1) },
          '下一页',
        ),
        h('button', { type: 'button', class: 'retry-list', onClick: () => emit('retry') }, '重试'),
      ])
  },
})
const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  mocks.summary = summary
  mocks.metadataError = null
  mocks.posts = [post]
  mocks.total = 16
  mocks.listError = null
  mocks.refresh.mockReset()
  mocks.list.mockReset()
  useRuntimeConfig().public.siteUrl = 'https://journal.example'
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await flushPromises()
})

async function mountPage(page: unknown, route: string) {
  const wrapper = await mountSuspended(page, {
    route,
    global: { stubs: { BlogPostCardList: List } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('标签与专栏的公开标识', () => {
  it('标签用原名匹配并把 slug 交给接口，专栏沿用 folder 名称', () => {
    expect(resolvePostTaxonomy('tag', 'Vue 3', summary)).toMatchObject({
      name: 'Vue 3',
      tag: 'vue-3',
      folder: null,
      path: '/tags/Vue%203',
    })
    expect(resolvePostTaxonomy('category', '前端 / 工程', summary)).toMatchObject({
      name: '前端 / 工程',
      tag: null,
      folder: '前端 / 工程',
      path: `/categories/${encodeURIComponent('前端 / 工程')}`,
    })
    expect(resolvePostTaxonomy('tag', '空标签', summary)).toBeNull()
    expect(resolvePostTaxonomy('category', '空专栏', summary)).toBeNull()
    expect(resolvePostTaxonomy('tag', '不存在', summary)).toBeNull()
  })
})

describe('标签独立页', () => {
  it('第二页展示文章、名称标题和带页码的自引用 canonical，列表按 slug 请求', async () => {
    const wrapper = await mountPage(TagPage, '/tags/Vue%203')
    const options = mocks.list.mock.calls[0]?.[0]
    expect(options.page.value).toBe(1)
    expect(options.selectedTag.value).toBe('vue-3')
    expect(options.selectedCategory.value).toBeNull()
    expect(options.displayMode.value).toBe('pagination')
    expect(options.resetOnScopeChange).toBe(false)
    // 独立数据键：客户端从首页或其他分类页跳转时不会复用旧页面的筛选 handler
    expect(options.key).toBe('post-list:tag:Vue 3')
    expect(wrapper.get('h1').text()).toContain('标签：Vue 3')
    expect(wrapper.get('article').text()).toBe('组合式函数笔记')
    await wrapper.get('.next-page').trigger('click')
    // 分页写入走路由器，地址在点击后的导航里提交。
    await vi.waitFor(() => expect(useRoute().query.page).toBe('2'))
    expect(useRoute().params.name).toBe('Vue 3')
    expect(options.page.value).toBe(2)
    expect(wrapper.text()).toContain('浏览标签「Vue 3」下的公开文章，第 2 页。')
    expect(wrapper.get('.list-state').text()).toBe('2/16/')
    await vi.waitFor(() => expect(document.title).toContain('标签：Vue 3 · 第 2 页'))
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('第 2 页')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://journal.example/tags/Vue%203?page=2',
    )
    await wrapper.get('.retry-list').trigger('click')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('超出末页时替换回最后一页，未知或无公开文章的标签返回 404', async () => {
    await mountPage(TagPage, '/tags/Vue%203?page=9')
    await flushPromises()
    expect(useRoute().params.name).toBe('Vue 3')
    // 越界纠正在挂载后发起替换导航，等待路由真正落到末页
    await vi.waitFor(() => expect(useRoute().query.page).toBe('2'))
    mocks.summary = { ...summary, tags: summary.tags.map((tag) => ({ ...tag, count: 0 })) }
    await expect(mountPage(TagPage, '/tags/Vue%203')).rejects.toMatchObject({ statusCode: 404 })
    mocks.summary = summary
    mocks.metadataError = new Error('目录不可用')
    await expect(mountPage(TagPage, '/tags/Vue%203')).rejects.toMatchObject({ statusCode: 503 })
  })

  it('文章加载失败时保留页面并提供重试', async () => {
    mocks.listError = new Error('上游失败')
    mocks.posts = []
    const wrapper = await mountPage(TagPage, '/tags/Vue%203')
    expect(wrapper.get('.list-state').text()).toContain('文章加载失败，请重试')
    await wrapper.get('.retry-list').trigger('click')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
})

describe('专栏独立页', () => {
  it('用专栏名称筛选 folder，第一页 canonical 不带页码', async () => {
    mocks.total = 2
    const wrapper = await mountPage(CategoryPage, `/categories/${encodeURIComponent('前端 / 工程')}`)
    const options = mocks.list.mock.calls[0]?.[0]
    expect(options.selectedTag.value).toBeNull()
    expect(options.selectedCategory.value).toBe('前端 / 工程')
    expect(options.key).toBe('post-list:category:前端 / 工程')
    expect(options.page.value).toBe(1)
    expect(wrapper.get('h1').text()).toContain('专栏：前端 / 工程')
    expect(wrapper.text()).toContain('浏览专栏「前端 / 工程」下的公开文章。')
    expect(wrapper.get('a').attributes('href')).toBe('/')
    await vi.waitFor(() =>
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        `https://journal.example/categories/${encodeURIComponent('前端 / 工程')}`,
      ),
    )
    expect(document.title).toContain('专栏：前端 / 工程')
    expect(document.title).not.toContain('第')
  })

  it('没有公开文章的专栏返回 404', async () => {
    await expect(mountPage(CategoryPage, `/categories/${encodeURIComponent('空专栏')}`)).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
