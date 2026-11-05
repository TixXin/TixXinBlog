/** @file rssSubscription.test.ts @description 订阅卡作为全站唯一 RSS 入口：单个原生订阅按钮、弹窗提示与邮件订阅说明的 DOM 回归。 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SubscribeCard from '../../app/components/blog/SubscribeCard.vue'

const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('RSS 订阅卡', () => {
  it('只放一个订阅按钮，保留原生订阅地址与类型，并声明会打开弹窗', async () => {
    const wrapper = await mountSuspended(SubscribeCard)
    wrappers.push(wrapper)
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    const link = links[0]!
    expect(link.attributes('href')).toBe('/rss.xml')
    expect(link.attributes('type')).toBe('application/rss+xml')
    expect(link.attributes('aria-haspopup')).toBe('dialog')
    expect(link.text()).toBe('订阅 RSS')
    expect(link.element.tabIndex).toBe(0)
    expect(link.get('[class~="i-lucide:rss"]').attributes('aria-hidden')).toBe('true')
  })

  it('说明三个订阅源并明确邮件订阅尚未开放', async () => {
    const wrapper = await mountSuspended(SubscribeCard)
    wrappers.push(wrapper)
    expect(wrapper.get('.subscribe-card__desc').text()).toContain('文章、闪念和朋友圈')
    expect(wrapper.get('.subscribe-card__desc').text()).toContain('邮件订阅尚未开放')
  })

  it('抽屉形态保留订阅按钮，并标记为不受宽屏断点隐藏', async () => {
    const wrapper = await mountSuspended(SubscribeCard, { props: { embedded: true } })
    wrappers.push(wrapper)
    expect(wrapper.get('section').classes()).toContain('subscribe-card--embedded')
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual(['/rss.xml'])
  })

  it('侧栏形态不带抽屉标记，保持只在宽屏侧栏出现', async () => {
    const wrapper = await mountSuspended(SubscribeCard)
    wrappers.push(wrapper)
    expect(wrapper.get('section').classes()).not.toContain('subscribe-card--embedded')
  })
})
