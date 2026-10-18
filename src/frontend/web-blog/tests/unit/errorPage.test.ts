/** @file errorPage.test.ts @description 错误页的推荐读取、搜索恢复、状态码隔离与标题 SEO 回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createError } from '#app'
import ErrorPage from '../../app/error.vue'
import { fetchPostPage } from '../../app/features/post/api'
import type { PostItem, PostPage } from '../../app/features/post/types'
import { defaultSiteSettings } from '../../app/features/site/settings'
import { invalidatePublicReads } from '../../app/utils/invalidatePublicReads'

const mocks = vi.hoisted(() => ({ clearError: vi.fn(), head: vi.fn(), seo: vi.fn() }))
vi.mock('../../app/features/post/api', () => ({ fetchPostPage: vi.fn() }))
mockNuxtImport('clearError', () => mocks.clearError)
mockNuxtImport('useHead', () => mocks.head)
mockNuxtImport('useSeoMeta', () => mocks.seo)
mockNuxtImport('useSiteSettings', () => () => ({
  settings: ref({ ...defaultSiteSettings, name: '山间手记' }),
  available: ref(true),
  error: ref(''),
  refresh: vi.fn(),
  accept: vi.fn(),
}))

const posts: PostItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: 5 - index,
  slug: `autumn-notes-${5 - index}`,
  title: `秋日散步 ${5 - index}`,
  summary: '沿着河岸记录秋天的颜色。',
  tags: [],
  category: 'life',
  readTime: 3,
  likes: 0,
  views: 0,
  comments: 0,
  date: `2026-10-0${5 - index}`,
  folder: '随笔',
}))
const sample: PostPage = { items: posts, total: 20, page: 1, pageSize: 5 }
const wrappers: { unmount(): void }[] = []

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchPostPage).mockReset().mockResolvedValue(sample)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function mountError(statusCode = 404, title?: string) {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        invalidatePublicReads(useNuxtApp(), ['posts'])
        clearNuxtData('error-recent-posts')
        return () => h(ErrorPage, { error: createError({ statusCode, data: title ? { title } : undefined }) })
      },
    }),
    { global: { stubs: { Icon: true, CommonContentImage: true } } },
  )
  wrappers.push(wrapper)
  return wrapper
}

describe('404 内容发现', () => {
  it('推荐请求未完成时仍显示原有 h1、搜索与返回首页，成功后展示最近五篇文章', async () => {
    let finish!: (value: PostPage) => void
    vi.mocked(fetchPostPage).mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const wrapper = await mountError()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('h1').text()).toBe('页面未找到')
    expect(wrapper.get('[role="search"]').attributes('aria-label')).toBe('站内搜索')
    expect(wrapper.get('input').attributes('aria-label')).toBe('搜索关键词')
    expect(wrapper.get('[role="status"]').text()).toBe('正在加载近期文章…')
    await wrapper.get('.state-block__action').trigger('click')
    expect(mocks.clearError).toHaveBeenCalledWith({ redirect: '/' })
    expect(fetchPostPage).toHaveBeenCalledExactlyOnceWith(
      '/api/v1',
      { page: 1, pageSize: 5, pinnedFirst: false },
      expect.any(AbortSignal),
    )

    finish(sample)
    await vi.waitFor(() => expect(wrapper.findAll('.recent-post-item')).toHaveLength(5))
    expect(wrapper.findAll('.recent-post-item__title').map((item) => item.text())).toEqual(
      posts.map((post) => post.title),
    )
    expect(wrapper.get('.recent-post-item').attributes('href')).toBe('/articles/autumn-notes-5')
    expect(wrapper.get('.recent-posts__more').attributes('href')).toBe('/')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('使用现有搜索地址规则处理空白、中文和特殊字符，提交时清除错误', async () => {
    const wrapper = await mountError()
    const form = wrapper.get('form[role="search"]')
    await wrapper.get('input').setValue('   ')
    await form.trigger('submit')
    expect(mocks.clearError).not.toHaveBeenCalled()
    await wrapper.get('input').setValue('  秋天 & Vue + /?  ')
    await form.trigger('submit')
    const target = new URL(mocks.clearError.mock.lastCall![0].redirect, 'https://blog.example')
    expect(target.pathname).toBe('/search')
    expect([...target.searchParams]).toEqual([['q', '秋天 & Vue + /?']])
    expect(wrapper.get('button[type="submit"]').text()).toBe('搜索')
  })

  it('接口失败仅显示推荐不可用，不替换错误页或回退样本，搜索和首页仍可用', async () => {
    vi.mocked(fetchPostPage).mockRejectedValueOnce(new Error('上游暂不可用'))
    const wrapper = await mountError()
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toContain('近期文章暂时无法加载'))
    expect(wrapper.get('h1').text()).toBe('页面未找到')
    expect(wrapper.get('.state-block__code').text()).toBe('404')
    expect(wrapper.find('.recent-posts').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('暂无已发布文章')
    await wrapper.get('input').setValue('散步')
    await wrapper.get('form').trigger('submit')
    expect(mocks.clearError).toHaveBeenCalledWith({ redirect: '/search?q=%E6%95%A3%E6%AD%A5' })
    await wrapper.get('.state-block__action').trigger('click')
    expect(mocks.clearError).toHaveBeenLastCalledWith({ redirect: '/' })
  })

  it('真实空列表与读取失败分别展示，不填充推荐占位文章', async () => {
    vi.mocked(fetchPostPage).mockResolvedValueOnce({ ...sample, items: [], total: 0 })
    const wrapper = await mountError()
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('暂无已发布文章。'))
    expect(wrapper.find('.recent-posts').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('页面未找到')
  })

  it('接口返回不足五篇时全部展示，超过五篇时限制推荐数量', async () => {
    vi.mocked(fetchPostPage).mockResolvedValueOnce({ ...sample, items: posts.slice(0, 2), total: 2 })
    const short = await mountError()
    await vi.waitFor(() => expect(short.findAll('.recent-post-item')).toHaveLength(2))
    short.unmount()
    wrappers.pop()
    vi.mocked(fetchPostPage).mockResolvedValueOnce({
      ...sample,
      items: [...posts, { ...posts[0]!, id: 6, title: '更早的记录' }],
    })
    const full = await mountError()
    await vi.waitFor(() => expect(full.findAll('.recent-post-item')).toHaveLength(5))
    expect(full.text()).not.toContain('更早的记录')
  })

  it('保留自定义标题、站名模板、单一 h1 与禁止索引的 SEO 设置', async () => {
    const wrapper = await mountError(404, '文章未找到')
    expect(wrapper.findAll('h1').map((heading) => heading.text())).toEqual(['文章未找到'])
    const head = mocks.head.mock.lastCall![0]
    expect(head.htmlAttrs).toEqual({ lang: 'zh-CN' })
    expect(head.title()).toBe('文章未找到')
    expect(head.titleTemplate('文章未找到')).toBe('文章未找到 - 山间手记')
    expect(head.titleTemplate('')).toBe('山间手记')
    const seo = mocks.seo.mock.lastCall![0]
    expect(seo.robots).toBe('noindex, follow')
    expect(seo.ogSiteName()).toBe('山间手记')
    expect(seo.ogTitle()).toBe('文章未找到')
  })

  it.each([403, 500, 503])('%i 错误不请求或展示推荐内容，保留原有恢复操作', async (statusCode) => {
    const wrapper = await mountError(statusCode)
    expect(fetchPostPage).not.toHaveBeenCalled()
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
    expect(wrapper.find('.recent-posts').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe(statusCode >= 500 ? '服务器错误' : '出错了')
    expect(wrapper.get('.state-block__action').text()).toBe(statusCode >= 500 ? '重试当前页面' : '返回首页')
    if (statusCode >= 500) {
      await wrapper.get('.error-page__secondary').trigger('click')
      expect(mocks.clearError).toHaveBeenCalledWith({ redirect: '/' })
    }
  })
})
