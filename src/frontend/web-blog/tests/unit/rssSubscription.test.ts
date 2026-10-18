/** @file rssSubscription.test.ts @description RSS 原生入口、完整订阅源说明与键盘提示的 DOM 回归。 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RssLink from '../../app/components/blog/RssLink.vue'
import SubscribeCard from '../../app/components/blog/SubscribeCard.vue'

const wrappers: { unmount(): void }[] = []
const feeds = [
  { label: '文章', href: '/rss.xml' },
  { label: '闪念', href: '/flash.xml' },
  { label: '朋友圈', href: '/moments.xml' },
]

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('RSS 订阅入口', () => {
  it.each(feeds)('$label 订阅保留原生地址、类型和可访问名称', async ({ label, href }) => {
    const wrapper = await mountSuspended(RssLink, { props: { label, href } })
    wrappers.push(wrapper)
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe(href)
    expect(link.attributes('type')).toBe('application/rss+xml')
    expect(link.attributes('aria-label')).toBe(`订阅${label} RSS`)
    expect(link.text()).toBe(`${label} RSS`)
    expect(link.element.tabIndex).toBe(0)
    expect(link.get('[class~="i-lucide:rss"]').attributes('aria-hidden')).toBe('true')
  })

  it('紧凑入口仍展示 RSS 文本，并在键盘聚焦后显示可用 Escape 关闭的提示', async () => {
    const wrapper = await mountSuspended(RssLink, {
      props: { label: '闪念', href: '/flash.xml', compact: true },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    const link = wrapper.get('a')
    expect(link.text()).toBe('RSS')
    expect(link.attributes('aria-label')).toBe('订阅闪念 RSS')

    // DOM 环境不计算真实布局与键盘焦点伪类，为 Tooltip 提供浏览器可见的触发器位置。
    vi.spyOn(link.element, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 80, 80, 44))
    const matches = link.element.matches.bind(link.element)
    vi.spyOn(link.element, 'matches').mockImplementation((selector) =>
      selector === ':focus-visible' ? true : matches(selector),
    )
    vi.useFakeTimers()
    link.element.focus()
    await vi.advanceTimersByTimeAsync(200)
    await nextTick()

    const tooltip = document.querySelector('[role="tooltip"]')
    expect(document.activeElement).toBe(link.element)
    expect(tooltip?.textContent).toBe('订阅闪念 RSS')
    expect(link.attributes('aria-describedby')).toBe(tooltip?.id)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    expect(link.attributes('aria-describedby')).toBeUndefined()
    expect(document.activeElement).toBe(link.element)
  })

  it('订阅卡列出全部三个 RSS 源并明确邮件订阅尚未开放', async () => {
    const wrapper = await mountSuspended(SubscribeCard)
    wrappers.push(wrapper)
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(3)
    expect(links.map((link) => link.attributes('href'))).toEqual(feeds.map((feed) => feed.href))
    for (const { href, label } of feeds) {
      const link = wrapper.get(`a[href="${href}"]`)
      expect(link.attributes('aria-label')).toBe(`订阅${label} RSS`)
      expect(link.text()).toBe(`${label} RSS`)
      expect(link.attributes('type')).toBe('application/rss+xml')
    }
    expect(wrapper.get('.subscribe-card__desc').text()).toContain('文章、闪念和朋友圈')
    expect(wrapper.get('.subscribe-card__desc').text()).toContain('邮件订阅尚未开放')
  })
})
