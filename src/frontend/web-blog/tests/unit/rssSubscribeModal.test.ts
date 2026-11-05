/** @file rssSubscribeModal.test.ts @description 订阅卡、页脚与资料卡等本站订阅链接打开订阅弹窗，切换订阅源、复制地址与关闭的 DOM 回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import SubscribeCard from '../../app/components/blog/SubscribeCard.vue'
import RssSubscribeModal from '../../app/components/blog/RssSubscribeModal.vue'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)

// 订阅卡、页脚链接（相对地址、新标签页）、资料卡社交链接（站点完整地址）与站外同名文件，和根组件挂载的弹窗共用同一份状态
const Host = defineComponent({
  setup() {
    const siteUrl = useSiteUrl()
    return () =>
      h('div', [
        h(SubscribeCard, { embedded: true }),
        h('footer', [
          h('a', { href: '/moments.xml', target: '_blank', rel: 'noopener', class: 'footer-rss' }, 'RSS 订阅'),
        ]),
        h('nav', [h('a', { href: `${siteUrl}/flash.xml`, target: '_blank', class: 'social-rss' }, 'RSS')]),
        h('a', { href: 'https://example.com/rss.xml', class: 'foreign-rss' }, '站外订阅'),
        h(RssSubscribeModal),
      ])
  },
})
const wrappers: { unmount(): void }[] = []
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const urlInput = () => document.querySelector<HTMLInputElement>('#rss-modal-url')!

async function mountHost() {
  const wrapper = await mountSuspended(Host, { attachTo: document.body })
  wrappers.push(wrapper)
  useRssSubscribe().close()
  await nextTick()
  return wrapper
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('RSS 订阅弹窗', () => {
  // 记录全站接管插件处理后的结果，再阻止测试环境里的真实跳转与新窗口
  function click(selector: string, init: MouseEventInit = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
    let handled = false
    const settle = (settled: Event) => {
      handled = settled.defaultPrevented
      settled.preventDefault()
    }
    document.addEventListener('click', settle, { once: true })
    document.querySelector(selector)!.dispatchEvent(event)
    return { defaultPrevented: handled }
  }
  const activeFeed = () => document.querySelector('.rss-modal__feed--active')?.textContent?.trim()

  it.each([
    { name: '订阅卡按钮', selector: '.subscribe-card__button', feed: '文章', path: '/rss.xml' },
    { name: '页脚相对地址链接', selector: '.footer-rss', feed: '朋友圈', path: '/moments.xml' },
    { name: '资料卡站点完整地址链接', selector: '.social-rss', feed: '闪念', path: '/flash.xml' },
  ])('$name 普通点击不跳转 XML，打开弹窗并选中对应订阅源', async ({ selector, feed, path }) => {
    await mountHost()
    const event = click(selector)
    await nextTick()
    expect(event.defaultPrevented).toBe(true)
    expect(dialog()?.getAttribute('aria-modal')).toBe('true')
    expect(activeFeed()).toBe(feed)
    expect(urlInput().value).toMatch(new RegExp(`^https?://[^/]+${path.replace('.', '\\.')}$`))
  })

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)('按住 %s 点击保留原生链接行为', async (key) => {
    await mountHost()
    const event = click('.subscribe-card__button', { [key]: true })
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    expect(dialog()).toBeNull()
  })

  it('站外同名订阅文件与中键点击不接管', async () => {
    await mountHost()
    const foreign = click('.foreign-rss')
    const middle = click('.footer-rss', { button: 1 })
    await nextTick()
    expect(foreign.defaultPrevented).toBe(false)
    expect(middle.defaultPrevented).toBe(false)
    expect(dialog()).toBeNull()
  })

  it('弹窗里的查看源文件链接保持原生跳转，不再次接管', async () => {
    await mountHost()
    useRssSubscribe().openFeed('posts')
    await nextTick()
    const event = click('.rss-links__raw')
    expect(event.defaultPrevented).toBe(false)
    expect(activeFeed()).toBe('文章')
  })

  it('切换订阅源后地址、阅读器链接与源文件链接随之变化，文章源列出其他格式', async () => {
    await mountHost()
    useRssSubscribe().openFeed('posts')
    await nextTick()
    expect(urlInput().value).toMatch(/\/rss\.xml$/)
    expect(document.querySelector('a[href="/atom.xml"]')).not.toBeNull()
    expect(document.querySelector('a[href="/feed.json"]')).not.toBeNull()

    const moments = [...document.querySelectorAll<HTMLButtonElement>('.rss-modal__feed')].find(
      (button) => button.textContent?.trim() === '朋友圈',
    )!
    moments.click()
    await nextTick()
    expect(urlInput().value).toMatch(/\/moments\.xml$/)
    const inoreader = document.querySelector<HTMLAnchorElement>('a[href^="https://www.inoreader.com/"]')!
    expect(inoreader.getAttribute('href')).toBe(
      `https://www.inoreader.com/?add_feed=${encodeURIComponent(urlInput().value)}`,
    )
    expect(inoreader.getAttribute('rel')).toBe('noopener noreferrer')
    const raw = document.querySelector<HTMLAnchorElement>('.rss-links__raw')!
    expect(raw.getAttribute('href')).toBe('/moments.xml')
    expect(raw.getAttribute('target')).toBe('_blank')
    expect(document.querySelector('a[href="/atom.xml"]')).toBeNull()
  })

  it('复制按钮写入完整订阅地址并提示已复制', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
    await mountHost()
    useRssSubscribe().openFeed('flash')
    await nextTick()
    const copy = document.querySelector<HTMLButtonElement>('.rss-modal__copy')!
    copy.click()
    await vi.waitFor(() => expect(copy.textContent).toContain('已复制'))
    expect(writeText).toHaveBeenCalledWith(urlInput().value)
    expect(toast.success).toHaveBeenCalledWith('订阅地址已复制')
  })

  it('剪贴板不可用时提示失败并选中地址便于手动复制', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
    await mountHost()
    useRssSubscribe().openFeed('posts')
    await nextTick()
    const select = vi.spyOn(urlInput(), 'select')
    document.querySelector<HTMLButtonElement>('.rss-modal__copy')!.click()
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('复制失败，请手动复制地址'))
    expect(select).toHaveBeenCalled()
  })

  it('Escape 与关闭按钮都能关闭弹窗', async () => {
    await mountHost()
    useRssSubscribe().openFeed('posts')
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await vi.waitFor(() => expect(useRssSubscribe().visible.value).toBe(false))

    useRssSubscribe().openFeed('posts')
    await nextTick()
    document.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!.click()
    await nextTick()
    expect(useRssSubscribe().visible.value).toBe(false)
  })
})
