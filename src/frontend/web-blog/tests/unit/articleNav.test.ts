/** @file articleNav.test.ts @description 相邻文章的专栏标注、真实地址与读屏错误反馈 */
import { afterEach, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ArticleNav from '../../app/components/article/ArticleNav.vue'
import type { RelatedPost } from '../../app/features/post/types'

const previous: RelatedPost = {
  id: '10',
  slug: 'frontend-notes',
  title: '前端札记',
  category: '前端开发',
  date: '2026-10-01',
}
const next: RelatedPost = { id: '8', title: '构建过程', category: '前端开发', date: '2026-09-01' }
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

async function setup(props: InstanceType<typeof ArticleNav>['$props']) {
  const wrapper = await mountSuspended(ArticleNav, {
    props,
    attachTo: document.body,
    global: { stubs: { Icon: { template: '<span />' } } },
  })
  wrappers.push(wrapper)
  return wrapper
}

it('同专栏标注对视觉与读屏均可见，保留可聚焦的真实文章地址', async () => {
  const wrapper = await setup({ prev: previous, next, folder: '前端开发' })
  expect(wrapper.get('nav').attributes('aria-label')).toBe('前端开发专栏的相邻文章')
  expect(wrapper.get('.article-nav__folder').text()).toBe('同专栏 · 前端开发')
  const links = wrapper.findAll('a')
  expect(links.map((link) => link.attributes('href'))).toEqual(['/articles/frontend-notes', '/articles/8'])
  expect(links[0]?.text()).toContain('上一篇')
  expect(links[1]?.text()).toContain('下一篇')
  links[0]?.element.focus()
  expect(document.activeElement).toBe(links[0]?.element)
  expect(wrapper.findAll('.article-nav__icon').every((icon) => icon.attributes('aria-hidden') === 'true')).toBe(true)
})

it('回退全站不标注专栏，缺失的一侧不渲染链接', async () => {
  const wrapper = await setup({ prev: null, next, folder: null })
  expect(wrapper.get('nav').attributes('aria-label')).toBe('相邻文章')
  expect(wrapper.find('.article-nav__folder').exists()).toBe(false)
  expect(wrapper.find('.article-nav__card--prev').exists()).toBe(false)
  expect(wrapper.findAll('a')).toHaveLength(1)
  expect(wrapper.get('.article-nav__card--next').attributes('href')).toBe('/articles/8')
})

it('导航失败提供读屏状态，不伪造可点击的空文章', async () => {
  const wrapper = await setup({ prev: null, next: null, error: true })
  expect(wrapper.get('[role="status"]').text()).toBe('相邻文章暂时无法加载')
  expect(wrapper.findAll('a')).toHaveLength(0)
  expect(wrapper.find('.article-nav__folder').exists()).toBe(false)
})
