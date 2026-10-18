/** @file articleNavComponents.test.ts @description 文章相邻导航、相关文章和粘性顶栏的空态、更新、语义与原生焦点回归 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ArticleNav from '../../app/components/article/ArticleNav.vue'
import RelatedPosts from '../../app/components/article/RelatedPosts.vue'
import StickyHeader from '../../app/components/article/StickyHeader.vue'
import type { RelatedPost } from '../../app/features/post/types'

const previous: RelatedPost = {
  id: '41',
  slug: 'reading-notes',
  title: '阅读中的片刻停留',
  date: '2026-10-12',
  category: '随笔',
}
const next: RelatedPost = {
  id: '43',
  title: '沿着河岸散步',
  date: '2026-10-16',
  category: '生活',
}
const metadata = {
  title: '记录城市的声音',
  date: '2026-10-14',
  category: '摄影',
  readTime: '8 分钟',
}
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

function createHost() {
  const host = document.createElement('div')
  document.body.append(host)
  hosts.push(host)
  return host
}

async function mountNav(props: { prev: RelatedPost | null; next: RelatedPost | null; error?: boolean }) {
  const wrapper = await mountSuspended(ArticleNav, { props, attachTo: createHost() })
  wrappers.push(wrapper)
  return wrapper
}

async function mountRelated(posts: RelatedPost[]) {
  const wrapper = await mountSuspended(RelatedPosts, { props: { posts }, attachTo: createHost() })
  wrappers.push(wrapper)
  return wrapper
}

async function mountHeader(props = metadata) {
  const wrapper = await mountSuspended(StickyHeader, { props, attachTo: createHost() })
  wrappers.push(wrapper)
  return wrapper
}

describe('文章相邻导航', () => {
  it('两侧都为空时保留有名称的导航区域，不伪造链接或错误状态', async () => {
    const wrapper = await mountNav({ prev: null, next: null })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('相邻文章')
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
  })

  it.each([
    { side: 'prev', props: { prev: previous, next: null }, label: '上一篇', title: previous.title },
    { side: 'next', props: { prev: null, next }, label: '下一篇', title: next.title },
  ])('仅有 $side 时只展示对应方向和文章名称', async ({ side, props, label, title }) => {
    const wrapper = await mountNav(props)

    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.get(`a.article-nav__card--${side}`).text()).toContain(label)
    expect(wrapper.get('a').text()).toContain(title)
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
  })

  it('双向导航使用真实链接，分别采用 slug 与 ID 地址，并可取得原生焦点', async () => {
    const wrapper = await mountNav({ prev: previous, next })
    const links = wrapper.findAll<HTMLAnchorElement>('a')

    expect(links.map((link) => link.attributes('href'))).toEqual(['/articles/reading-notes', '/articles/43'])
    expect(links[0]!.text()).toContain('上一篇')
    expect(links[0]!.text()).toContain(previous.title)
    expect(links[1]!.text()).toContain('下一篇')
    expect(links[1]!.text()).toContain(next.title)
    // 保留真实 NuxtLink 的 anchor；DOM 单测检查焦点资格，不模拟浏览器原生按键激活。
    for (const link of links) {
      expect(link.element).toBeInstanceOf(HTMLAnchorElement)
      expect(link.element.tabIndex).toBe(0)
      link.element.focus()
      expect(document.activeElement).toBe(link.element)
    }
  })

  it('读取失败时用警示区域播报并提供重试，仍保留已取得的相邻文章', async () => {
    const wrapper = await mountNav({ prev: previous, next: null, error: true })

    expect(wrapper.get('[role="alert"]').text()).toBe('部分文章信息加载失败请重试加载相邻文章和相关推荐。')
    expect(wrapper.get('a').attributes('href')).toBe('/articles/reading-notes')
    expect(wrapper.get('a').text()).toContain(previous.title)

    await wrapper.setProps({ prev: null })
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.get('[role="alert"]').text()).toBe('部分文章信息加载失败请重试加载相邻文章和相关推荐。')
  })

  it('切换文章和恢复请求后同步移除旧标题、旧链接与错误状态', async () => {
    const wrapper = await mountNav({ prev: previous, next, error: true })
    const replacement = { ...next, id: '44', slug: '散步/后记', title: '散步后记' }

    await wrapper.setProps({ prev: null, next: replacement, error: false })

    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.get('a').attributes('href')).toBe('/articles/%E6%95%A3%E6%AD%A5%2F%E5%90%8E%E8%AE%B0')
    expect(wrapper.get('a').text()).toContain(replacement.title)
    expect(wrapper.text()).not.toContain(previous.title)
    expect(wrapper.text()).not.toContain(next.title)
    expect(wrapper.find('.request-feedback').exists()).toBe(false)
  })
})

describe('相关文章列表', () => {
  it('空数组展示栏目标题与空列表，不插入示例文章或可聚焦链接', async () => {
    const wrapper = await mountRelated([])

    expect(wrapper.get('h2').text()).toBe('相关文章')
    expect(wrapper.find('ul').exists()).toBe(true)
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.findAll('a')).toHaveLength(0)
  })

  it('按传入顺序呈现标题、日期和分类，装饰分隔符对读屏隐藏', async () => {
    const wrapper = await mountRelated([previous, next])
    const items = wrapper.findAll('li')

    expect(items).toHaveLength(2)
    for (const [index, post] of [previous, next].entries()) {
      const item = items[index]!
      expect(item.get('.related__post-title').text()).toBe(post.title)
      expect(item.get('.related__meta').text()).toContain(post.date)
      expect(item.get('.related__meta').text()).toContain(post.category)
      expect(item.get('.related__sep').attributes('aria-hidden')).toBe('true')
    }
    expect(items.map((item) => item.get('a').attributes('href'))).toEqual(['/articles/reading-notes', '/articles/43'])
  })

  it('每篇文章保持原生链接与焦点资格，标题构成可读的链接名称', async () => {
    const wrapper = await mountRelated([previous, next])
    const links = wrapper.findAll<HTMLAnchorElement>('a')

    for (const [index, link] of links.entries()) {
      expect(link.element).toBeInstanceOf(HTMLAnchorElement)
      expect(link.element.tabIndex).toBe(0)
      expect(link.text()).toContain([previous, next][index]!.title)
      link.element.focus()
      expect(document.activeElement).toBe(link.element)
    }
  })

  it('同一文章更新后刷新标题和地址，清空数据后删除全部旧链接', async () => {
    const wrapper = await mountRelated([previous, next])

    await wrapper.setProps({ posts: [{ ...previous, slug: 'revised-notes', title: '重新整理的阅读札记' }] })
    expect(wrapper.findAll('li')).toHaveLength(1)
    expect(wrapper.get('a').attributes('href')).toBe('/articles/revised-notes')
    expect(wrapper.get('a').text()).toContain('重新整理的阅读札记')
    expect(wrapper.text()).not.toContain(previous.title)
    expect(wrapper.text()).not.toContain(next.title)

    await wrapper.setProps({ posts: [] })
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(wrapper.findAll('a')).toHaveLength(0)
  })
})

describe('文章粘性顶栏', () => {
  it('呈现文章标题与全部元信息，并随文章切换更新', async () => {
    const wrapper = await mountHeader()

    expect(wrapper.get('h1').text()).toBe(metadata.title)
    expect(wrapper.findAll('.article-sticky-header__meta-item').map((item) => item.text())).toEqual([
      metadata.date,
      metadata.category,
      metadata.readTime,
    ])

    await wrapper.setProps({ title: '新的观察', date: '2026-10-18', category: '生活', readTime: '3 分钟' })
    expect(wrapper.get('h1').text()).toBe('新的观察')
    expect(wrapper.findAll('.article-sticky-header__meta-item').map((item) => item.text())).toEqual([
      '2026-10-18',
      '生活',
      '3 分钟',
    ])
    expect(wrapper.text()).not.toContain(metadata.title)
  })

  it('标题和元信息为空时保持返回入口，不展示缺省示例或 undefined', async () => {
    const wrapper = await mountHeader({ title: '', date: '', category: '', readTime: '' })

    expect(wrapper.get('h1').text()).toBe('')
    expect(wrapper.get('.article-sticky-header__meta').text()).toBe('')
    expect(wrapper.text()).toBe('返回上一页')
  })

  it('返回使用有文字名称的原生按钮，不提交所在表单，并可取得焦点', async () => {
    const wrapper = await mountHeader()
    const button = wrapper.get<HTMLButtonElement>('button')

    expect(button.element).toBeInstanceOf(HTMLButtonElement)
    expect(button.attributes('type')).toBe('button')
    expect(button.text()).toBe('返回上一页')
    expect(button.element.disabled).toBe(false)
    expect(button.element.tabIndex).toBe(0)
    button.element.focus()
    expect(document.activeElement).toBe(button.element)
  })

  it('有 SPA 上一页记录时只回退一次，不改写为首页', async () => {
    const wrapper = await mountHeader()
    const back = vi.spyOn(wrapper.vm.$router, 'back').mockImplementation(() => {})
    const push = vi.spyOn(wrapper.vm.$router, 'push').mockResolvedValue(undefined)
    vi.spyOn(window.history, 'state', 'get').mockReturnValue({ back: '/posts/archive?page=2' })

    await wrapper.get('button').trigger('click')

    expect(back).toHaveBeenCalledOnce()
    expect(push).not.toHaveBeenCalled()
  })

  it.each([null, {}, { back: null }])('没有可回退的 SPA 记录时跳转首页：%j', async (state) => {
    const wrapper = await mountHeader()
    const back = vi.spyOn(wrapper.vm.$router, 'back').mockImplementation(() => {})
    const push = vi.spyOn(wrapper.vm.$router, 'push').mockResolvedValue(undefined)
    vi.spyOn(window.history, 'state', 'get').mockReturnValue(state)

    await wrapper.get('button').trigger('click')

    expect(push).toHaveBeenCalledExactlyOnceWith('/')
    expect(back).not.toHaveBeenCalled()
  })
})
