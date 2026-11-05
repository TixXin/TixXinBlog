/** @file rssSubscribeModal.test.ts @description RSS 入口打开订阅弹窗、切换订阅源、复制地址与关闭的 DOM 回归。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import RssLink from '../../app/components/blog/RssLink.vue'
import RssSubscribeModal from '../../app/components/blog/RssSubscribeModal.vue'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
mockNuxtImport('useToast', () => () => toast)

// 页面上的入口与根组件挂载的弹窗共用同一份状态
const Host = defineComponent({
  setup: () => () =>
    h('div', [
      h(RssLink, { href: '/rss.xml', label: '文章' }),
      h(RssLink, { href: '/flash.xml', label: '闪念', compact: true }),
      h(RssSubscribeModal),
    ]),
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
  it('普通点击不跳转 XML，打开弹窗并选中被点击的订阅源', async () => {
    const wrapper = await mountHost()
    const link = wrapper.get('a[href="/flash.xml"]')
    expect(link.attributes('aria-haspopup')).toBe('dialog')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.element.dispatchEvent(event)
    await nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(dialog()?.getAttribute('aria-modal')).toBe('true')
    expect(document.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('闪念')
    expect(urlInput().value).toMatch(/^https?:\/\/[^/]+\/flash\.xml$/)
  })

  it.each(['metaKey', 'ctrlKey', 'shiftKey'] as const)('按住 %s 点击保留原生链接行为', async (key) => {
    const wrapper = await mountHost()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [key]: true })
    wrapper.get('a[href="/rss.xml"]').element.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    expect(dialog()).toBeNull()
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
