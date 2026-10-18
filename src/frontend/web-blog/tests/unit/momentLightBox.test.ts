/**
 * @file momentLightBox.test.ts
 * @description 朋友圈灯箱的键盘边界、模态焦点与图片加载恢复回归测试
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import MomentLightBox from '../../app/components/moment/MomentLightBox.vue'

const external = 'https://images.example.com/lake.webp'
const managed = '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp'
const images = [external, managed, 'https://images.example.com/mountain.webp']
const cleanup: (() => void)[] = []

beforeEach(() => {
  // happy-dom 不计算布局，仅补足可见尺寸；焦点栈、Teleport 和图片状态均使用真实实现。
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    const rectangles = this.isConnected && !this.hidden ? [new DOMRect(0, 0, 100, 40)] : []
    return Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null })
  })
  // 图片请求不依赖网络；默认保持待加载，由各用例显式派发成功或失败事件。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})

afterEach(async () => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  await flushPromises()
  vi.restoreAllMocks()
})

async function lightbox(overrides: Partial<InstanceType<typeof MomentLightBox>['$props']> = {}) {
  const container = document.createElement('div')
  const opener = document.createElement('button')
  opener.textContent = '查看湖边照片'
  document.body.append(opener, container)
  const originalOverflow = document.body.style.overflow
  cleanup.push(() => {
    container.remove()
    opener.remove()
    document.body.style.overflow = originalOverflow
  })
  const wrapper = await mountSuspended(MomentLightBox, {
    // 组件无路由依赖，避免挂载时导航首页并加载无关页面模块。
    route: '',
    attachTo: container,
    props: { visible: false, currentIndex: 0, images, ...overrides },
    global: { stubs: { Icon: true } },
  })
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    wrapper.unmount()
  }
  cleanup.push(dispose)
  opener.focus()
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return { wrapper, opener, dispose, originalOverflow }
}

function dialog() {
  return new DOMWrapper(document.querySelector<HTMLElement>('.moment-lightbox')!)
}

async function keydown(key: string, target: Element = document.activeElement ?? document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  await nextTick()
  return event
}

async function loadImage(image: HTMLImageElement) {
  // DOM 环境没有图片解码器，由单个图片节点模拟浏览器完成加载，不替换图片状态逻辑。
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 1600 },
    naturalHeight: { configurable: true, value: 1000 },
    decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
  })
  image.dispatchEvent(new Event('load'))
  await flushPromises()
}

describe('朋友圈灯箱键盘与焦点', () => {
  it('左右键切换相邻图片，首尾保持边界并同步导航入口和计数', async () => {
    const { wrapper } = await lightbox({ currentIndex: 1 })
    expect(dialog().get('.moment-lightbox__counter').text()).toBe('2 / 3')
    await keydown('ArrowLeft')
    expect(wrapper.emitted('change')).toEqual([[0]])

    // 父组件接收受控索引后回传，断言下一次键盘动作使用当前图片位置。
    await wrapper.setProps({ currentIndex: 0 })
    expect(dialog().find('[aria-label="上一张"]').exists()).toBe(false)
    expect(dialog().get('[aria-label="下一张"]').exists()).toBe(true)
    expect(dialog().get('.moment-lightbox__counter').text()).toBe('1 / 3')
    await keydown('ArrowLeft')
    expect(wrapper.emitted('change')).toEqual([[0]])
    await keydown('ArrowRight')
    expect(wrapper.emitted('change')).toEqual([[0], [1]])

    await wrapper.setProps({ currentIndex: 2 })
    expect(dialog().find('[aria-label="下一张"]').exists()).toBe(false)
    expect(dialog().get('[aria-label="上一张"]').exists()).toBe(true)
    expect(dialog().get('.moment-lightbox__counter').text()).toBe('3 / 3')
    await keydown('ArrowRight')
    expect(wrapper.emitted('change')).toEqual([[0], [1]])
    await keydown('ArrowLeft')
    expect(wrapper.emitted('change')).toEqual([[0], [1], [1]])
  })

  it('Esc 只发出一次关闭，父组件关闭后释放背景并将焦点还给入口', async () => {
    const { wrapper, opener, originalOverflow } = await lightbox()
    const modal = dialog()
    expect(modal.attributes('role')).toBe('dialog')
    expect(modal.attributes('aria-modal')).toBe('true')
    expect(modal.attributes('aria-label')).toBe('图片预览')
    expect(document.activeElement).toBe(modal.get('[aria-label="关闭"]').element)
    expect(opener.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    const event = await keydown('Escape')
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('close')).toEqual([[]])
    await wrapper.setProps({ visible: false })
    expect(document.querySelector('.moment-lightbox')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(opener.inert).toBe(false)
    expect(opener.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe(originalOverflow)
    await keydown('Escape')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('隐藏时停止响应键盘，重开不重复触发，卸载后移除监听并归还焦点', async () => {
    const addWindow = vi.spyOn(window, 'addEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const addDocument = vi.spyOn(document, 'addEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const onChange = vi.fn()
    const onClose = vi.fn()
    const { wrapper, opener, dispose, originalOverflow } = await lightbox({ onChange, onClose })
    const windowKeydowns = addWindow.mock.calls.filter(([type]) => type === 'keydown')
    const documentKeydowns = addDocument.mock.calls.filter(
      ([type, , options]) => type === 'keydown' && options === true,
    )
    expect(windowKeydowns).toHaveLength(1)
    expect(documentKeydowns).toHaveLength(1)
    const windowKeydown = windowKeydowns[0]![1]
    const documentKeydown = documentKeydowns[0]![1]

    await wrapper.setProps({ visible: false })
    expect(removeDocument).toHaveBeenCalledWith('keydown', documentKeydown, true)
    await keydown('ArrowRight')
    await keydown('Escape')
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.setProps({ visible: true })
    await keydown('ArrowRight')
    expect(wrapper.emitted('change')).toEqual([[1]])
    dispose()
    expect(removeWindow).toHaveBeenCalledWith('keydown', windowKeydown)
    expect(document.querySelector('.moment-lightbox')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe(originalOverflow)
    await keydown('ArrowRight')
    await keydown('Escape')
    // VTU 在卸载时清除 emitted 缓存，父组件监听器仍能验证卸载后的迟到事件。
    expect(onChange).toHaveBeenCalledExactlyOnceWith(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('空图片列表不打开对话框，也不拦截背景键盘或焦点', async () => {
    const { wrapper, opener, originalOverflow } = await lightbox({ images: [] })
    expect(document.querySelector('.moment-lightbox')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe(originalOverflow)
    await keydown('ArrowRight')
    const event = await keydown('Escape')
    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('朋友圈灯箱图片', () => {
  it.each([
    ['外链', external],
    ['受管媒体', managed],
  ])('%s 保留原图地址、替代文本与立即加载策略', async (_source, src) => {
    const { wrapper } = await lightbox({ images: [src] })
    const image = dialog().get('img')
    expect(image.attributes('src')).toBe(src)
    expect(image.attributes('alt')).toBe('预览图片')
    expect(image.attributes('loading')).toBe('eager')
    expect(image.attributes('referrerpolicy')).toBe('no-referrer')
    expect(image.attributes('srcset')).toBeUndefined()
    expect(dialog().find('.moment-lightbox__counter').exists()).toBe(false)
    expect(dialog().find('[aria-label="上一张"]').exists()).toBe(false)
    expect(dialog().find('[aria-label="下一张"]').exists()).toBe(false)
    await keydown('ArrowLeft')
    await keydown('ArrowRight')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it.each([
    ['外链', external, managed],
    ['受管媒体', managed, external],
  ])('%s 加载失败保留占位，可重试且切换图片后恢复', async (_source, src, nextSrc) => {
    const { wrapper } = await lightbox({ images: [src, nextSrc] })
    const frame = dialog().get('.image-frame')
    expect(frame.attributes('aria-busy')).toBe('true')
    await frame.get('img').trigger('error')
    expect(frame.classes()).toContain('image-frame--error')
    expect(frame.attributes('aria-busy')).toBe('false')
    expect(frame.text()).toContain('图片加载失败')
    const failedImage = frame.get('img').element
    await frame.get('[aria-label="重新加载图片：预览图片"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(frame.get('img').element).not.toBe(failedImage)
    expect(frame.get('img').attributes('src')).toBe(src)
    expect(frame.attributes('aria-busy')).toBe('true')
    await frame.get('img').trigger('error')

    await keydown('ArrowRight')
    expect(wrapper.emitted('change')).toEqual([[1]])
    await wrapper.setProps({ currentIndex: 1 })
    expect(frame.get('img').attributes('src')).toBe(nextSrc)
    expect(frame.classes()).toContain('image-frame--loading')
    expect(frame.text()).not.toContain('图片加载失败')
    expect(frame.attributes('aria-busy')).toBe('true')
    await loadImage(frame.get<HTMLImageElement>('img').element)
    expect(frame.classes()).toContain('image-frame--ready')
    expect(frame.attributes('aria-busy')).toBe('false')
    expect(frame.find('.image-frame__status').exists()).toBe(false)
  })
})
