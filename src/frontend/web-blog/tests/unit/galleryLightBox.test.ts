/** @file galleryLightBox.test.ts @description 画廊灯箱的键盘切换、模态焦点、媒体渲染及加载失败恢复 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import LightBox from '../../app/components/gallery/LightBox.vue'
import type { PhotoItem } from '../../app/features/gallery/types'

const managedSrc = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const externalSrc = 'https://images.example.com/harbour-original.webp'
const photo: PhotoItem = {
  id: 21,
  source: 'media',
  title: '海港晨光',
  description: '清晨的海面与停泊的小船',
  src: '/thumbnails/harbour.webp',
  srcLarge: managedSrc,
  width: 1000,
  height: 750,
  category: '风景',
  date: '2026-10-01',
  location: '海港',
  device: '随身相机',
}
const wrappers: { unmount(): void }[] = []
const nodes: HTMLElement[] = []
let originalOverflow = ''

beforeEach(() => {
  originalOverflow = document.body.style.overflow
  // happy-dom 不计算布局；只补可见矩形，焦点进入、约束和归还仍运行真实 useModalFocus。
  const rect = new DOMRect(0, 0, 120, 44)
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
    Object.assign([rect], { item: (index: number) => (index === 0 ? rect : null) }),
  )
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})

afterEach(() => {
  wrappers
    .splice(0)
    .reverse()
    .forEach((wrapper) => wrapper.unmount())
  nodes.splice(0).forEach((node) => node.remove())
  document.body.style.overflow = originalOverflow
  vi.restoreAllMocks()
})

async function setup(props: Partial<InstanceType<typeof LightBox>['$props']> = {}) {
  const entry = document.createElement('button')
  entry.textContent = '查看照片：海港晨光'
  const host = document.createElement('div')
  document.body.append(entry, host)
  nodes.push(entry, host)
  const wrapper = await mountSuspended(LightBox, {
    // 组件无路由依赖，避免挂载时导航首页并加载无关页面模块。
    route: '',
    attachTo: host,
    props: { photo: { ...photo }, visible: false, canPrevious: true, canNext: true, ...props },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  entry.focus()
  await wrapper.setProps({ visible: true })
  await flushPromises()
  const dialog = new DOMWrapper(document.body.querySelector<HTMLElement>('.lightbox')!)
  return { wrapper, entry, dialog }
}

describe('画廊灯箱键盘与焦点', () => {
  it('左右键从内部控件冒泡时各发出一次切换，阻止默认滚动且不关闭', async () => {
    const { wrapper, dialog } = await setup()
    const close = dialog.get<HTMLButtonElement>('button[aria-label="关闭"]')
    expect(document.activeElement).toBe(close.element)
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      close.element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    }
    expect(wrapper.emitted('previous')).toEqual([[]])
    expect(wrapper.emitted('next')).toEqual([[]])
    expect(wrapper.emitted('close')).toBeUndefined()

    await dialog.get('nav button:first-child').trigger('click')
    await dialog.get('nav button:last-child').trigger('click')
    expect(wrapper.emitted('previous')).toHaveLength(2)
    expect(wrapper.emitted('next')).toHaveLength(2)
  })

  it.each([
    { canPrevious: false, canNext: true, pending: false, previous: 0, next: 1 },
    { canPrevious: true, canNext: false, pending: false, previous: 1, next: 0 },
    { canPrevious: false, canNext: false, pending: false, previous: 0, next: 0 },
    { canPrevious: true, canNext: true, pending: true, previous: 0, next: 0 },
  ])('边界和读取中限制导航：$canPrevious / $canNext / $pending', async ({ previous, next, ...props }) => {
    const { wrapper, dialog } = await setup(props)
    await dialog.trigger('keydown', { key: 'ArrowLeft' })
    await dialog.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('previous')?.length ?? 0).toBe(previous)
    expect(wrapper.emitted('next')?.length ?? 0).toBe(next)
    expect(dialog.get<HTMLButtonElement>('nav button:first-child').element.disabled).toBe(previous === 0)
    expect(dialog.get<HTMLButtonElement>('nav button:last-child').element.disabled).toBe(next === 0)
  })

  it('Escape 只关闭一次，父页面收起灯箱后归还入口焦点、背景状态和滚动', async () => {
    document.body.style.overflow = 'auto'
    const { wrapper, entry, dialog } = await setup()
    expect(dialog.attributes()).toMatchObject({ role: 'dialog', 'aria-modal': 'true', 'aria-label': photo.title })
    expect(entry.inert).toBe(true)
    expect(entry.getAttribute('aria-hidden')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    dialog.get('button[aria-label="关闭"]').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('close')).toEqual([[]])
    await wrapper.setProps({ visible: false })
    expect(document.body.querySelector('.lightbox')).toBeNull()
    expect(document.activeElement).toBe(entry)
    expect(entry.inert).toBe(false)
    expect(entry.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe('auto')

    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('next')).toBeUndefined()
  })

  it('Tab 和 Shift+Tab 约束在灯箱内，卸载时也归还焦点且不再响应 Escape', async () => {
    // VTU 卸载后会清空 emitted，使用父层监听验证卸载后没有迟到的关闭事件。
    const closeListener = vi.fn()
    const { wrapper, entry, dialog } = await setup({ onClose: closeListener })
    const close = dialog.get<HTMLButtonElement>('button[aria-label="关闭"]')
    const next = dialog.get<HTMLButtonElement>('nav button:last-child')
    await close.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(next.element)
    await next.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(close.element)

    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(document.activeElement).toBe(entry)
    expect(entry.inert).toBe(false)
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closeListener).not.toHaveBeenCalled()
  })

  it('图片与说明点击不关闭，遮罩和关闭按钮各发出一次关闭', async () => {
    const { wrapper, dialog } = await setup()
    await dialog.get('img').trigger('click')
    await dialog.get('.lightbox__caption').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await dialog.trigger('click')
    await dialog.get('button[aria-label="关闭"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[], []])
  })
})

describe('画廊灯箱媒体与失败反馈', () => {
  it.each([
    { source: 'media' as const, srcLarge: managedSrc },
    { source: 'external' as const, srcLarge: externalSrc },
  ])('$source 使用大图地址立即加载，正确呈现替代文本和作品信息', async ({ source, srcLarge }) => {
    const { dialog } = await setup({ photo: { ...photo, source, srcLarge } })
    const image = dialog.get('img')
    expect(image.attributes()).toMatchObject({
      src: srcLarge,
      alt: photo.title,
      loading: 'eager',
      width: '1000',
      height: '750',
      referrerpolicy: 'no-referrer',
    })
    if (source === 'media') {
      expect(image.attributes('srcset')).toBe(
        `${srcLarge}?w=320 320w, ${srcLarge}?w=640 640w, ${srcLarge}?w=960 960w, ${srcLarge} 1000w`,
      )
      expect(image.attributes('sizes')).toBe('100vw')
    } else {
      expect(image.attributes('srcset')).toBeUndefined()
      expect(image.attributes('sizes')).toBeUndefined()
    }
    expect(dialog.get('h2').text()).toBe(photo.title)
    expect(dialog.get('.lightbox__caption').attributes('aria-live')).toBe('polite')
    expect(dialog.text()).toContain(photo.description)
    expect(dialog.text()).toContain('拍摄于 2026-10-01 · 海港 · 随身相机')
  })

  it('无尺寸外链保留原图和日期空缺反馈', async () => {
    const { dialog } = await setup({
      photo: { ...photo, source: 'external', srcLarge: externalSrc, width: undefined, height: undefined, date: '' },
    })
    expect(dialog.get('img').attributes('width')).toBeUndefined()
    expect(dialog.get('img').attributes('height')).toBeUndefined()
    expect(dialog.get('img').attributes('src')).toBe(externalSrc)
    expect(dialog.text()).toContain('拍摄日期未填写')
  })

  it.each([managedSrc, externalSrc])('大图 %s 失败后可重试，切换作品清除旧占位', async (srcLarge) => {
    const { wrapper, dialog } = await setup({ photo: { ...photo, srcLarge } })
    const firstImage = dialog.get('img').element
    const frame = dialog.get('.image-frame')
    expect(frame.attributes('aria-busy')).toBe('true')
    await dialog.get('img').trigger('error')
    expect(frame.classes()).toContain('image-frame--error')
    expect(frame.text()).toContain('图片加载失败')
    expect(frame.attributes('aria-busy')).toBe('false')
    expect(dialog.get('h2').text()).toBe(photo.title)

    await dialog.get('button[aria-label="重新加载图片：海港晨光"]').trigger('click')
    expect(dialog.get('img').element).not.toBe(firstImage)
    expect(dialog.get('img').attributes('src')).toBe(srcLarge)
    expect(frame.attributes('aria-busy')).toBe('true')
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()

    await dialog.get('img').trigger('error')
    await wrapper.setProps({
      photo: { ...photo, id: 22, title: '山间云海', srcLarge: 'https://images.example.com/cloud.webp' },
    })
    expect(dialog.attributes('aria-label')).toBe('山间云海')
    expect(dialog.get('img').attributes('src')).toBe('https://images.example.com/cloud.webp')
    expect(frame.classes()).toContain('image-frame--loading')
    expect(frame.text()).not.toContain('图片加载失败')
  })

  it('作品详情读取中和失败状态使用读屏反馈，重新读取只触发详情重试', async () => {
    const { wrapper, dialog } = await setup({ photo: null, pending: true })
    expect(dialog.attributes('aria-label')).toBe('照片预览')
    expect(dialog.get('[role="status"]').text()).toBe('正在加载…')
    expect(dialog.get('.request-feedback button').attributes('aria-disabled')).toBe('true')
    expect(dialog.find('img').exists()).toBe(false)

    await wrapper.setProps({ pending: false, error: '作品暂时无法读取' })
    expect(dialog.find('[role="status"]').exists()).toBe(false)
    expect(dialog.get('[role="alert"]').text()).toBe('照片加载失败作品暂时无法读取')
    await dialog.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.setProps({ pending: true })
    // 重试期间按钮保持可聚焦但标记忙碌，重复点击不再发出重试
    expect(dialog.get('.request-feedback button').attributes('aria-disabled')).toBe('true')
    expect(dialog.get('.request-feedback button').attributes('aria-busy')).toBe('true')
    await dialog.get('.request-feedback button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
