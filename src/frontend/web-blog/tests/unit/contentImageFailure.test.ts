/** @file contentImageFailure.test.ts @description 两种图片管线的失败占位、尺寸、重试焦点与原生属性回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContentImage from '../../app/components/common/ContentImage.vue'

const managed = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const wrappers: { unmount(): void }[] = []
// Nuxt Image 的转换仍由已有集成覆盖，这里保留组件 ref 与 img 的真实 DOM 边界。
const NuxtImg = defineComponent({
  inheritAttrs: false,
  props: ['src', 'alt'],
  setup(props, { attrs }) {
    return () => h('img', { ...attrs, src: props.src, alt: props.alt, 'data-nuxt-img': '' })
  },
})
beforeEach(() => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})
async function mountImage(src: string, attrs = {}) {
  const wrapper = await mountSuspended(ContentImage, {
    props: { src, alt: '湖边日落' },
    attrs: { width: 400, height: 240, loading: 'lazy', ...attrs },
    attachTo: document.body,
    global: { stubs: { NuxtImg, Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}
function ready(node: HTMLImageElement) {
  Object.defineProperties(node, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 800 },
    naturalHeight: { configurable: true, value: 480 },
  })
  node.decode = () => Promise.resolve()
}

describe('ContentImage 统一失败处理', () => {
  it.each([managed, 'https://example.com/photo.webp'])('保留 %s 的盒尺寸，重试同一地址并归还键盘焦点', async (src) => {
    const wrapper = await mountImage(src)
    const first = wrapper.get('img')
    expect(first.attributes('loading')).toBe('lazy')
    vi.spyOn(first.element, 'getBoundingClientRect').mockReturnValue({ width: 320, height: 192 } as DOMRect)
    await first.trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    expect(wrapper.get('.content-image-failure').attributes('style')).toContain('width: 320px')
    expect(wrapper.get('.content-image-failure').attributes('style')).toContain('height: 192px')
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toContain('湖边日落')
    ;(button.element as HTMLButtonElement).focus()
    // 原生 Enter/空格会生成 click；DOM 单测显式派发同一激活事件。
    await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('click', { detail: 0 })
    await flushPromises()
    const retried = wrapper.get('img')
    expect(retried.element).not.toBe(first.element)
    expect(retried.attributes('src')).toBe(src)
    expect(retried.attributes('loading')).toBe('eager')
    expect(retried.attributes('style')).toContain('height: 192px')
    expect(document.activeElement).toBe(retried.element)
    ready(retried.element)
    await retried.trigger('load')
    await flushPromises()
    expect(wrapper.find('.content-image-failure').exists()).toBe(false)
    expect(wrapper.emitted('state')?.at(-1)).toEqual(['ready'])
    expect(wrapper.get('img').attributes('style') || '').not.toContain('192px')
  })

  it('首次失败保持声明尺寸，换地址清除错误与旧尺寸', async () => {
    const wrapper = await mountImage(managed, { class: 'cover', width: 44, height: 44 })
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('.cover').attributes('style')).toContain('width: 44px')
    expect(wrapper.get('button').attributes('aria-label')).toContain('图片加载失败')
    await wrapper.setProps({ src: '/api/v1/media/other.webp' })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.get('img').attributes('src')).toBe('/api/v1/media/other.webp')
    expect(wrapper.get('img').attributes('loading')).toBe('lazy')
  })

  it('重试再次失败时恢复按钮焦点，旧节点事件不能污染新图片', async () => {
    const wrapper = await mountImage(managed)
    const old = wrapper.get('img')
    await old.trigger('error')
    await wrapper.get('button').trigger('click')
    const current = wrapper.get('img')
    await old.trigger('error')
    expect(wrapper.get('img').element).toBe(current.element)
    await current.trigger('error')
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('button').element)
  })

  it('成功图片后续失败沿用已记录盒，未知正文图片从请求开始预留尺寸', async () => {
    const wrapper = await mountImage(managed)
    const image = wrapper.get('img')
    const measure = vi.spyOn(image.element, 'getBoundingClientRect')
    measure.mockReturnValue({ width: 320, height: 192 } as DOMRect)
    ready(image.element)
    await image.trigger('load')
    await flushPromises()
    measure.mockReturnValue({ width: 16, height: 16 } as DOMRect)
    await image.trigger('error')
    expect(wrapper.get('.content-image-failure').attributes('style')).toContain('height: 192px')
    const unknown = await mountSuspended(ContentImage, {
      props: { src: '/missing.webp', alt: '', native: true },
    })
    wrappers.push(unknown)
    expect(unknown.get('img').attributes('style')).toContain('width: 240px')
    expect(unknown.get('img').attributes('style')).toContain('aspect-ratio: 3 / 2')
  })

  it('挂载前缓存失败仍显示反馈，原生正文保留 srcset、sizes 和 decoding', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const cached = await mountImage(managed)
    expect(cached.text()).toContain('图片加载失败')
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
    const native = await mountImage('https://example.com/native.webp', {
      srcset: 'https://example.com/native-small.webp 400w',
      sizes: '400px',
      decoding: 'async',
    })
    await native.setProps({ native: true })
    expect(native.get('img').attributes('data-nuxt-img')).toBeUndefined()
    expect(native.get('img').attributes('srcset')).toBe('https://example.com/native-small.webp 400w')
    expect(native.get('img').attributes('decoding')).toBe('async')
  })
})
