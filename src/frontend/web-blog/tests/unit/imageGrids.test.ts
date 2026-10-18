/**
 * @file imageGrids.test.ts
 * @description 朋友圈与闪念图片失败可重试，预览及关联链接不包裹重试按钮
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import FlashImageGrid from '../../app/components/flash/FlashImageGrid.vue'
import MomentCard from '../../app/components/moment/MomentCard.vue'
import MomentArticleCard from '../../app/components/moment/MomentArticleCard.vue'
import MomentLinkCard from '../../app/components/moment/MomentLinkCard.vue'

const source = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const wrappers: { unmount(): void }[] = []
const lightboxStub = defineComponent({
  props: { visible: Boolean },
  template: '<div data-lightbox :data-visible="visible" />',
})
const global = {
  stubs: {
    Icon: true,
    CommonContentImage: true,
    CommonTooltip: { template: '<span><slot /></span>' },
    MomentUserPopover: { template: '<div><slot /></div>' },
    ClientOnly: { template: '<div><slot /></div>' },
    MomentLightBox: lightboxStub,
    FlashImageLightBox: lightboxStub,
  },
}

beforeEach(() => {
  // DOM 环境不解码远端图片，加载与失败由用例显式派发，避免挂载时被视作已完成的破图。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('图片网格的失败恢复', () => {
  it.each(['flash', 'moment'] as const)('%s 网格保留图片宽度描述，重试不会打开预览', async (kind) => {
    const wrapper =
      kind === 'flash'
        ? await mountSuspended(FlashImageGrid, {
            props: { images: [source], descriptions: ['山间日出'] },
            global,
          })
        : await mountSuspended(MomentCard, {
            props: {
              moment: {
                id: 'moment-image',
                content: '山间日出',
                date: '2026-10-18T00:00:00Z',
                images: [source],
                imageAlts: ['山间日出'],
                likes: 0,
                isLiked: false,
              },
              ownerProfile: { name: '作者', avatar: '/avatar.svg' },
            },
            global,
          })
    wrappers.push(wrapper)
    const previewSelector = kind === 'flash' ? '.flash-grid__preview' : '.moment-card__image-preview'
    const image = wrapper.get('.image-frame img')
    expect(image.attributes('sizes')).toBe('240px')
    expect(image.attributes('srcset')).toContain(`${source}?w=320 320w`)
    expect(wrapper.get(previewSelector).attributes('type')).toBe('button')
    expect(wrapper.get('[data-lightbox]').attributes('data-visible')).toBe('false')

    await image.trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    expect(wrapper.find(previewSelector).exists()).toBe(false)
    const retry = wrapper.get('button[aria-label="重新加载图片：山间日出"]')
    expect(retry.exists()).toBe(true)
    expect(retry.attributes('type')).toBe('button')
    expect(retry.element.parentElement?.closest('button, a')).toBeNull()

    // 原生按钮的键盘激活会派发 detail 为 0 的 click，重试不应冒泡到预览入口。
    await retry.trigger('keydown', { key: 'Enter' })
    await retry.trigger('click', { detail: 0 })
    expect(wrapper.get('[data-lightbox]').attributes('data-visible')).toBe('false')
    expect(wrapper.get('.image-frame img').element).not.toBe(image.element)
    expect(wrapper.find(previewSelector).exists()).toBe(false)

    const recoveredImage = wrapper.get('.image-frame img')
    Object.defineProperties(recoveredImage.element, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 900 },
      naturalHeight: { configurable: true, value: 600 },
      decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
    })
    await recoveredImage.trigger('load')
    await flushPromises()
    expect(wrapper.get(previewSelector).attributes('type')).toBe('button')

    await wrapper.get(previewSelector).trigger('click', { detail: 0 })
    expect(wrapper.get('[data-lightbox]').attributes('data-visible')).toBe('true')
  })
})

describe('关联封面独立于链接恢复', () => {
  it.each(['article', 'external'] as const)('%s 封面重试不嵌在链接内', async (kind) => {
    const wrapper =
      kind === 'article'
        ? await mountSuspended(MomentArticleCard, {
            props: {
              article: { id: 'article', title: '山间日出', summary: '一次清晨散步', cover: source, url: '/articles/1' },
            },
            global,
          })
        : await mountSuspended(MomentLinkCard, {
            props: { link: { url: 'https://example.com', title: '山间日出', image: source } },
            global,
          })
    wrappers.push(wrapper)
    const cardClass = kind === 'article' ? '.moment-article-card' : '.moment-link-card'
    const destination = kind === 'article' ? '/articles/1' : 'https://example.com'
    const linkClick = vi.fn()
    wrapper.get(`${cardClass}__body`).element.addEventListener('click', linkClick)
    const coverLink = wrapper.get(`${cardClass}__cover-link`)
    expect(coverLink.attributes('href')).toBe(destination)
    expect(coverLink.attributes('aria-label')).toBe(kind === 'article' ? '阅读文章：山间日出' : '打开链接：山间日出')
    if (kind === 'external') {
      expect(coverLink.attributes('target')).toBe('_blank')
      expect(coverLink.attributes('rel')).toBe('noopener noreferrer')
    }
    const coverClick = vi.fn((event: Event) => event.preventDefault())
    coverLink.element.addEventListener('click', coverClick, { capture: true })
    await coverLink.trigger('click')
    expect(coverClick).toHaveBeenCalledOnce()
    coverClick.mockClear()
    const image = wrapper.get('.image-frame img')
    expect(image.attributes('sizes')).toBe('80px')
    await image.trigger('error')
    expect(wrapper.find(`${cardClass}__cover-link`).exists()).toBe(false)
    const retry = wrapper.get('button[aria-label="重新加载图片：山间日出"]')
    expect(retry.element.parentElement?.closest('button, a')).toBeNull()
    await retry.trigger('click', { detail: 0 })
    expect(linkClick).not.toHaveBeenCalled()
    expect(coverClick).not.toHaveBeenCalled()
    expect(wrapper.get('.image-frame img').element).not.toBe(image.element)
    expect(wrapper.find(`${cardClass}__cover-link`).exists()).toBe(false)
    expect(wrapper.get(`${cardClass}__body`).attributes('href')).toBe(destination)

    const recoveredImage = wrapper.get('.image-frame img')
    Object.defineProperties(recoveredImage.element, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 900 },
      naturalHeight: { configurable: true, value: 600 },
      decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
    })
    await recoveredImage.trigger('load')
    await flushPromises()
    expect(wrapper.get(`${cardClass}__cover-link`).attributes('href')).toBe(destination)
  })
})
