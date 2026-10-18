/** @file galleryComponents.test.ts @description 画廊卡片与网格保留媒体来源、加载反馈及选择事件，失败重试不误开灯箱 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import GalleryItem from '../../app/components/gallery/GalleryItem.vue'
import GalleryGrid from '../../app/components/gallery/GalleryGrid.vue'
import type { PhotoItem } from '../../app/features/gallery/types'

const managedSrc = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const externalSrc = 'https://images.example.com/harbour.webp?size=large'
const sources = [
  { source: 'media' as const, src: managedSrc },
  { source: 'external' as const, src: externalSrc },
]
const photo: PhotoItem = {
  id: 21,
  source: 'media',
  title: '海港晨光',
  description: '清晨的海面与停泊的小船',
  src: managedSrc,
  srcLarge: managedSrc,
  width: 1000,
  height: 750,
  category: '风景',
  date: '2026-10-01',
  location: '海港',
}
const wrappers: { unmount(): void }[] = []
let imageComplete = false
let imageWidth = 0

beforeEach(() => {
  imageComplete = false
  imageWidth = 0
  // 模拟加载完成状态，图片仍由真实 ImageFrame 渲染和处理事件，不请求外部图片。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(() => imageComplete)
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => imageWidth)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function mountItem(item: PhotoItem) {
  const wrapper = await mountSuspended(GalleryItem, {
    // 组件无路由依赖，避免挂载时导航首页并加载无关页面模块。
    route: '',
    props: { photo: item, ready: true },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('画廊图片来源与网格', () => {
  it.each(sources)('$source 卡片保留缩略图地址、替代文本和尺寸，仅受管媒体输出响应式变体', async ({ source, src }) => {
    const wrapper = await mountItem({ ...photo, source, src, srcLarge: 'https://images.example.com/original.webp' })
    const image = wrapper.get('img')

    expect(wrapper.attributes('aria-label')).toBe('查看照片：海港晨光')
    expect(wrapper.attributes('data-focus-key')).toBe('gallery-photo-21')
    expect(image.attributes()).toMatchObject({
      src,
      alt: photo.title,
      width: '1000',
      height: '750',
      loading: 'lazy',
      referrerpolicy: 'no-referrer',
    })
    expect(wrapper.get('.image-frame').attributes('style')).toContain('aspect-ratio: 1000 / 750')
    if (source === 'media') {
      expect(image.attributes('srcset')).toBe(`${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=960 960w, ${src} 1000w`)
      expect(image.attributes('sizes')).toBe('(min-width: 640px) 380px, 50vw')
    } else {
      expect(image.attributes('srcset')).toBeUndefined()
      expect(image.attributes('sizes')).toBeUndefined()
    }
    expect(wrapper.text()).toContain('2026-10-01 · 海港')
  })

  it('未知外链尺寸与拍摄信息保持空缺，不虚构图片宽高或日期地点', async () => {
    const wrapper = await mountItem({
      ...photo,
      source: 'external',
      src: externalSrc,
      width: undefined,
      height: undefined,
      date: '',
      location: '',
    })
    expect(wrapper.get('img').attributes('width')).toBeUndefined()
    expect(wrapper.get('img').attributes('height')).toBeUndefined()
    expect(wrapper.get('.gallery-item__meta').text()).toBe('拍摄信息未填写')
    expect(wrapper.get('.image-frame').attributes('style')).toContain('aspect-ratio: 3 / 2')
  })

  it('网格保持作品顺序、前两张优先加载，并把所选作品交给父页面', async () => {
    const photos = [photo, { ...photo, id: 22, src: externalSrc, source: 'external' as const }, { ...photo, id: 23 }]
    const wrapper = await mountSuspended(GalleryGrid, {
      route: '',
      props: { photos, ready: true },
      global: { stubs: { Icon: true } },
    })
    wrappers.push(wrapper)
    const cards = wrapper.findAll('[role="button"]')
    expect(cards.map((card) => card.attributes('data-focus-key'))).toEqual([
      'gallery-photo-21',
      'gallery-photo-22',
      'gallery-photo-23',
    ])
    expect(wrapper.findAll('img').map((image) => image.attributes('loading'))).toEqual(['eager', 'eager', 'lazy'])
    expect(wrapper.findAll('img').map((image) => image.attributes('fetchpriority'))).toEqual([
      'high',
      'high',
      undefined,
    ])
    await cards[1]!.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toEqual([[photos[1]]])

    await wrapper.setProps({ ready: false })
    await cards[2]!.trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})

describe('画廊加载失败占位', () => {
  it.each(sources)('$source 加载失败保留作品与比例，独立重试后恢复图片', async ({ source, src }) => {
    const wrapper = await mountItem({ ...photo, source, src })
    const frame = wrapper.get('.image-frame')
    const firstImage = wrapper.get('img').element
    expect(frame.attributes('aria-busy')).toBe('true')
    expect(frame.text()).toContain('图片加载中…')

    await wrapper.get('img').trigger('error')
    expect(frame.classes()).toContain('image-frame--error')
    expect(frame.attributes('aria-busy')).toBe('false')
    expect(frame.text()).toContain('图片暂时无法加载')
    expect(frame.attributes('style')).toContain('aspect-ratio: 1000 / 750')
    expect(wrapper.get('.gallery-item__title').text()).toBe(photo.title)

    const retry = wrapper.get('button[aria-label="重新加载图片：海港晨光"]')
    await retry.trigger('keydown', { key: 'Enter' })
    await retry.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.get('img').element).not.toBe(firstImage)
    expect(wrapper.get('img').attributes('src')).toBe(src)
    expect(frame.attributes('aria-busy')).toBe('true')

    imageComplete = true
    imageWidth = 1000
    vi.spyOn(wrapper.get('img').element, 'decode').mockResolvedValue(undefined)
    await wrapper.get('img').trigger('load')
    await flushPromises()
    expect(frame.classes()).toContain('image-frame--ready')
    expect(frame.attributes('aria-busy')).toBe('false')
    expect(frame.find('.image-frame__status').exists()).toBe(false)
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
