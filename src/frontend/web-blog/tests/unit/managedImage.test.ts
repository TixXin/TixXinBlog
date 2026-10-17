/** @file managedImage.test.ts @description 受管媒体 srcset 只对站内媒体生成白名单宽度，外链与首屏优先级行为保持预期 */
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { isManagedImage, managedImageSrcset, MANAGED_IMAGE_WIDTHS } from '../../app/utils/managedImage'
import ContentImage from '../../app/components/common/ContentImage.vue'
import ImageFrame from '../../app/components/common/ImageFrame.vue'

const src = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const wrappers: { unmount(): void }[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('受管图片 srcset', () => {
  it('只识别站内受管媒体地址', () => {
    expect(isManagedImage(src)).toBe(true)
    expect(isManagedImage(`https://blog.example.com${src}`)).toBe(true)
    expect(isManagedImage(`${src}?w=320`)).toBe(false)
    expect(isManagedImage('https://images.unsplash.com/photo.webp')).toBe(false)
    expect(isManagedImage('/avatar-photo.webp')).toBe(false)
    expect(managedImageSrcset('https://example.com/api/v1/media/evil.webp')).toBeUndefined()
  })
  it('未知原图宽度列出全部白名单，已知时只列更小变体并补原图', () => {
    expect(managedImageSrcset(src)).toBe(MANAGED_IMAGE_WIDTHS.map((width) => `${src}?w=${width} ${width}w`).join(', '))
    expect(managedImageSrcset(src, 1000)).toBe(`${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=960 960w, ${src} 1000w`)
    expect(managedImageSrcset(src, 200)).toBe(`${src} 200w`)
  })
  it('ContentImage 仅在调用方给出 sizes 时输出 srcset，priority 改为立即加载', async () => {
    const plain = await mountSuspended(ContentImage, { props: { src, alt: '封面' }, attrs: { loading: 'lazy' } })
    wrappers.push(plain)
    expect(plain.find('img').attributes('srcset')).toBeUndefined()
    expect(plain.find('img').attributes('loading')).toBe('lazy')
    const sized = await mountSuspended(ContentImage, {
      props: { src, alt: '封面', priority: true },
      attrs: { loading: 'lazy', sizes: '320px', format: 'webp' },
    })
    wrappers.push(sized)
    const image = sized.find('img')
    expect(image.attributes('srcset')).toContain(`${src}?w=320 320w`)
    expect(image.attributes('sizes')).toBe('320px')
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('fetchpriority')).toBe('high')
    expect(image.attributes('format')).toBeUndefined()
  })
  it('ImageFrame 对外链不生成 srcset，对受管图按原图宽度与 sizes 输出', async () => {
    const external = await mountSuspended(ImageFrame, {
      props: { src: 'https://images.unsplash.com/photo.webp', alt: '外链', width: 1200, height: 800, sizes: '300px' },
    })
    wrappers.push(external)
    expect(external.find('img').attributes('srcset')).toBeUndefined()
    expect(external.find('img').attributes('loading')).toBe('lazy')
    const managed = await mountSuspended(ImageFrame, {
      props: { src, alt: '作品', width: 1536, height: 1024, sizes: '330px', priority: true },
    })
    wrappers.push(managed)
    const image = managed.find('img')
    expect(image.attributes('srcset')).toContain(`${src} 1536w`)
    expect(image.attributes('sizes')).toBe('330px')
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('fetchpriority')).toBe('high')
    // 原图宽度和 sizes 都未知（灯箱）时保留原图，不限制在最大变体
    const lightbox = await mountSuspended(ImageFrame, { props: { src, alt: '预览', loading: 'eager' } })
    wrappers.push(lightbox)
    expect(lightbox.find('img').attributes('srcset')).toBeUndefined()
  })
})
