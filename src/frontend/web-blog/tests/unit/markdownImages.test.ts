/** @file markdownImages.test.ts @description 文章、朋友圈和闪念正文的安全图片恢复、链接拆分及换代清理回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ArticleMarkdown from '../../app/components/article/Markdown.vue'
import ImageLightbox from '../../app/components/article/ImageLightbox.vue'
import MomentCard from '../../app/components/moment/MomentCard.vue'
import MomentCommentSection from '../../app/components/moment/MomentCommentSection.vue'
import FlashNoteCard from '../../app/components/flash/FlashNoteCard.vue'
import MarkdownImages from '../../app/components/common/MarkdownImages.vue'
import { renderFlashMarkdown } from '../../app/utils/flashMarkdown'

mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {} }))

const wrappers: { unmount(): void }[] = []
const source = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const global = {
  stubs: {
    Icon: true,
    CommonTooltip: { template: '<span><slot /></span>' },
    MomentUserPopover: { template: '<div><slot /></div>' },
    MomentLightBox: true,
  },
}

beforeEach(() => {
  // 图片下载不属于单元 DOM 环境；用例显式驱动失败与加载完成。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function mountBody(kind: 'article' | 'moment' | 'flash', content: string) {
  const wrapper =
    kind === 'article'
      ? await mountSuspended(ArticleMarkdown, { props: { content }, global })
      : kind === 'moment'
        ? await mountSuspended(MomentCard, {
            props: {
              moment: { id: 'body', content, date: '2026-10-18', likes: 0, isLiked: false },
              ownerProfile: { name: '作者', avatar: '/avatar.svg' },
            },
            global,
          })
        : await mountSuspended(FlashNoteCard, {
            props: {
              note: {
                id: 'body',
                userId: 'owner',
                content,
                tags: [],
                images: [],
                type: 'memo',
                createdAt: '2026-10-18T00:00:00Z',
                updatedAt: '2026-10-18T00:00:00Z',
                likes: 0,
                comments: [],
              },
              readOnly: true,
            },
            global,
          })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('正文图片失败与恢复', () => {
  it.each(['article', 'moment', 'flash'] as const)('%s 正文统一反馈，键盘重试不打开灯箱', async (kind) => {
    // 从挂载阶段记录实际盒子；失败后不应再用破图的尺寸覆盖已有测量。
    vi.spyOn(HTMLImageElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 480,
      height: 320,
    } as DOMRect)
    const wrapper = await mountBody(kind, `![山间日出](${source})`)
    const host = wrapper.get('.markdown-image')
    const image = host.get('img')
    expect(image.attributes('src')).toBe(source)
    if (kind === 'article') {
      expect(image.attributes('srcset')).toContain(`${source}?w=320 320w`)
      expect(host.get('[data-article-image]').attributes('type')).toBe('button')
      expect(host.find('[data-article-image] img').exists()).toBe(false)
    }
    await image.trigger('error')
    expect(host.text()).toContain('图片加载失败')
    expect(host.get('.content-image-failure').attributes('style')).toContain('width: 480px')
    expect(host.get('.content-image-failure').attributes('style')).toContain('height: 320px')
    expect(host.find('[data-article-image]').exists()).toBe(false)
    const retry = host.get('button')
    expect(retry.attributes('type')).toBe('button')
    expect(retry.attributes('aria-label')).toContain('山间日出')
    expect(retry.element.parentElement?.closest('a, button')).toBeNull()
    await retry.trigger('keydown', { key: 'Enter' })
    await retry.trigger('click', { detail: 0 })
    expect(host.get('img').element).not.toBe(image.element)
    expect(host.get('img').attributes('src')).toBe(source)
    expect(host.find('[data-article-image]').exists()).toBe(false)
    expect(document.body.querySelector('.article-lightbox')).toBeNull()
    Object.defineProperties(host.get('img').element, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 900 },
      naturalHeight: { configurable: true, value: 600 },
      decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
    })
    await host.get('img').trigger('load')
    await flushPromises()
    expect(host.find('.content-image-failure').exists()).toBe(false)
    if (kind === 'article') {
      await host.get('[data-article-image]').trigger('click', { detail: 0 })
      await flushPromises()
      const lightbox = document.body.querySelector('.article-lightbox')
      expect(lightbox).not.toBeNull()
      expect(lightbox?.querySelector('img')?.getAttribute('src')).toBe(new URL(source, window.location.href).href)
    }
  })

  it.each(['article', 'moment', 'flash'] as const)(
    '%s 链接中的图片失败后可单独重试，链接文字保持有效',
    async (kind) => {
      const wrapper = await mountBody(
        kind,
        '[前文 **![山间](/one.webp) 中间 ![海边](/two.webp)** 后文](https://example.com)',
      )
      const hosts = wrapper.findAll('.markdown-image')
      expect(hosts).toHaveLength(2)
      expect(wrapper.find('a .markdown-image').exists()).toBe(false)
      expect(wrapper.find('button button, a button').exists()).toBe(false)
      expect(hosts[0]!.get('a').attributes('href')).toBe('https://example.com')
      // 三类正文共用外链规则：站外链接新窗口打开，拆分后的每段链接保持相同属性。
      expect(hosts[0]!.get('a').attributes('target')).toBe('_blank')
      expect(hosts[0]!.get('a').attributes('rel')).toBe('noopener noreferrer')
      const texts = wrapper.findAll('a').map((link) => link.text())
      expect(texts).toContain('前文')
      expect(texts).toContain('中间')
      // 新窗口提示附在原链接末尾一段，读屏仍能得知打开方式。
      expect(texts).toContain('后文（在新窗口打开）')
      const navigation = vi.fn()
      hosts[0]!.get('a').element.addEventListener('click', navigation)
      await hosts[0]!.get('img').trigger('error')
      expect(hosts[0]!.find('a').exists()).toBe(false)
      await hosts[0]!.get('button').trigger('click', { detail: 0 })
      expect(navigation).not.toHaveBeenCalled()
      expect(wrapper.find('button button, a button').exists()).toBe(false)
      expect(hosts[1]!.get('img').attributes('src')).toBe('/two.webp')
    },
  )

  it('朋友圈评论只增强各自正文，链接图片失败可重试且评论换代清理旧反馈', async () => {
    const first = {
      id: 'first',
      author: '读者',
      avatar: '/reader.svg',
      content: '[来源 ![山间日出](/comment.webp)](https://example.com)',
      time: '2026-10-18T00:00:00Z',
    }
    const wrapper = await mountSuspended(MomentCommentSection, {
      props: {
        comments: [first, { ...first, id: 'second', content: '![海边](/sea.webp)' }],
        draft: '',
      },
      global,
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.findAll('.moment-comments__text .markdown-image')).toHaveLength(2)
    expect(wrapper.findAll('.moment-comments__avatar img')).toHaveLength(2)
    expect(wrapper.find('.moment-comments__avatar .markdown-image').exists()).toBe(false)
    const host = wrapper.get('.moment-comments__text .markdown-image')
    expect(host.get('a').attributes('href')).toBe('https://example.com')
    const navigation = vi.fn()
    host.get('a').element.addEventListener('click', navigation)
    await host.get('img').trigger('error')
    expect(host.text()).toContain('图片加载失败')
    expect(host.find('a').exists()).toBe(false)
    const retry = host.get('button')
    expect(retry.element.parentElement?.closest('a, button')).toBeNull()
    await retry.trigger('click', { detail: 0 })
    expect(navigation).not.toHaveBeenCalled()
    expect(host.get('img').attributes('src')).toBe('/comment.webp')
    await wrapper.setProps({ comments: [{ ...first, content: '![更新后的图片](/updated.webp)' }] })
    await flushPromises()
    expect(wrapper.findAll('.moment-comments__text .markdown-image')).toHaveLength(1)
    expect(wrapper.get('.moment-comments__text .markdown-image img').attributes('src')).toBe('/updated.webp')
    expect(wrapper.find('.moment-comments__text .content-image-failure').exists()).toBe(false)
    expect(wrapper.find('button button, a button').exists()).toBe(false)
    expect(wrapper.findAll('.moment-comments__avatar img')).toHaveLength(1)
    await wrapper.setProps({ comments: [] })
    await flushPromises()
    expect(wrapper.find('.markdown-image').exists()).toBe(false)
  })

  it('换代后清理旧挂载位和失败反馈，保留净化边界与代码块中的图片文字', async () => {
    const content = ref('![旧图](/old.webp)')
    const Harness = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null)
        return () => {
          const html = renderFlashMarkdown(content.value)
          return h('section', [h('div', { ref: root, innerHTML: html }), h(MarkdownImages, { root: root.value, html })])
        }
      },
    })
    const wrapper = await mountSuspended(Harness, { global })
    wrappers.push(wrapper)
    await flushPromises()
    const old = wrapper.get('.markdown-image img')
    await old.trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    content.value =
      '![新图](/new.webp)\n\n```html\n<img src="/code.webp">\n```\n\n<img src=x onerror=alert(1)> [坏链接](javascript:alert(1))'
    await flushPromises()
    expect(wrapper.findAll('.markdown-image')).toHaveLength(1)
    expect(wrapper.get('.markdown-image img').attributes('src')).toBe('/new.webp')
    expect(wrapper.find('.content-image-failure').exists()).toBe(false)
    expect(wrapper.find('[onerror], script, a[href^="javascript:"]').exists()).toBe(false)
    expect(wrapper.get('pre').text()).toContain('<img src="/code.webp">')
    content.value = '没有图片的正文'
    await flushPromises()
    expect(wrapper.find('.markdown-image').exists()).toBe(false)
    expect(wrapper.text()).toBe('没有图片的正文')
  })

  it('文章灯箱使用同一失败占位，重试保留灯箱并可以关闭', async () => {
    const wrapper = await mountSuspended(ImageLightbox, {
      props: { images: [{ src: source, alt: '山间日出' }], index: 0 },
      global: { stubs: { Teleport: true, Icon: true } },
    })
    wrappers.push(wrapper)
    await wrapper.get('.image-frame img').trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    const retry = wrapper.get('.image-failure__retry')
    await retry.trigger('click', { detail: 0 })
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    await wrapper.get('[aria-label="关闭大图"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
