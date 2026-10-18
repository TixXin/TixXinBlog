/** @file articleImageLightbox.test.ts @description 文章图片灯箱的空态、键盘边界、真实模态焦点与背景恢复回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ImageLightbox, { type ArticleLightboxImage } from '../../app/components/article/ImageLightbox.vue'

const images: ArticleLightboxImage[] = [
  { src: '/article-images/river.webp', alt: '河岸边的树影' },
  { src: '/article-images/bridge.webp', alt: '' },
  { src: '/article-images/night.webp', alt: '入夜后的街道' },
]
const wrappers: { unmount(): void }[] = []
const fixtures: HTMLElement[] = []
let originalOverflow = ''

beforeEach(() => {
  originalOverflow = document.body.style.overflow
  // happy-dom 不解码图片，未加载节点会被视作已完成的失败图并出现重试按钮；这里保持真实的加载中状态。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
  const originalRects = HTMLElement.prototype.getClientRects
  const rectangle = new DOMRect(0, 0, 44, 44)
  const rectangles = Object.assign([rectangle], { item: (index: number) => (index === 0 ? rectangle : null) })
  // happy-dom 不计算布局；仅为本测试节点补可见矩形，焦点、禁用与模态逻辑仍使用真实实现。
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return this.closest('[data-lightbox-fixture], .article-lightbox') ? rectangles : originalRects.call(this)
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  fixtures.splice(0).forEach((fixture) => fixture.remove())
  document.body.style.overflow = originalOverflow
  vi.restoreAllMocks()
})

function createFixture(tag = 'section') {
  const fixture = document.createElement(tag)
  fixture.dataset.lightboxFixture = ''
  document.body.append(fixture)
  fixtures.push(fixture)
  return fixture
}

function createOrigin() {
  const background = createFixture()
  const origin = document.createElement('button')
  origin.type = 'button'
  origin.textContent = '查看河岸图片'
  background.append(origin)
  origin.focus()
  return { background, origin }
}

async function setup(props: { images: ArticleLightboxImage[]; index: number } = { images, index: 0 }) {
  const wrapper = mount(ImageLightbox, {
    props,
    attachTo: createFixture('div'),
    // 灯箱不依赖 Nuxt 上下文；只替换装饰图标，保留真实 Teleport 与模态焦点逻辑。
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  await nextTick()
  return wrapper
}

function getDialog() {
  const element = document.querySelector<HTMLElement>('.article-lightbox')
  expect(element).not.toBeNull()
  return new DOMWrapper(element!)
}

function keydown(target: HTMLElement, key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('文章图片灯箱数据与语义', () => {
  it.each([
    { name: '空图片列表', images: [], index: 0 },
    { name: '负数索引', images, index: -1 },
    { name: '超出最后一张', images, index: images.length },
  ])('$name 不渲染空对话框、不锁定背景，也不移动入口焦点', async ({ images: source, index }) => {
    const { origin, background } = createOrigin()
    const wrapper = await setup({ images: source, index })

    expect(document.querySelector('.article-lightbox')).toBeNull()
    expect(background.inert).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe(originalOverflow)
    expect(document.activeElement).toBe(origin)
    expect(wrapper.emitted()).toEqual({})
  })

  it('单图使用有名称的模态对话框，说明通过 ID 关联且没有多图操作', async () => {
    await setup({ images: [images[0]!], index: 0 })
    const dialog = getDialog()
    const caption = dialog.get('figcaption')

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('正文图片')
    expect(dialog.attributes('aria-describedby')).toBe(caption.attributes('id'))
    expect(caption.attributes('id')).toBeTruthy()
    expect(caption.attributes('aria-live')).toBe('polite')
    expect(caption.text()).toBe('河岸边的树影')
    expect(dialog.get('img').attributes('src')).toBe(images[0]!.src)
    expect(dialog.get('img').attributes('alt')).toBe(images[0]!.alt)
    expect(dialog.find('nav').exists()).toBe(false)
    expect(dialog.find('.article-lightbox__count').exists()).toBe(false)
  })

  it('切图同步图片、位置和描述，缺失 alt 时显示真实缺省说明', async () => {
    const wrapper = await setup()
    const dialog = getDialog()
    const captionId = dialog.get('figcaption').attributes('id')

    expect(dialog.attributes('aria-label')).toBe('正文图片 1 / 3')
    expect(dialog.get('nav').attributes('aria-label')).toBe('切换正文图片')
    await wrapper.setProps({ index: 1 })

    expect(dialog.attributes('aria-label')).toBe('正文图片 2 / 3')
    expect(dialog.get('img').attributes('src')).toBe(images[1]!.src)
    expect(dialog.get('img').attributes('alt')).toBe('')
    expect(dialog.get('figcaption').text()).toContain('图片未提供说明')
    expect(dialog.get('.article-lightbox__count').text()).toBe('2 / 3')
    expect(dialog.attributes('aria-describedby')).toBe(captionId)
    expect(dialog.get('figcaption').attributes('id')).toBe(captionId)
    expect(dialog.text()).not.toContain(images[0]!.alt)
  })

  it('空数据补齐时打开，列表缩短使索引无效后关闭并释放焦点和背景', async () => {
    const { origin, background } = createOrigin()
    const wrapper = await setup({ images: [], index: 1 })

    await wrapper.setProps({ images })
    expect(getDialog().get('img').attributes('src')).toBe(images[1]!.src)
    expect(background.inert).toBe(true)

    await wrapper.setProps({ images: [images[0]!] })
    expect(document.querySelector('.article-lightbox')).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(background.inert).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe(originalOverflow)
    expect(wrapper.emitted('update:index')).toBeUndefined()
  })
})

describe('文章图片灯箱键盘与关闭', () => {
  it('左右方向键按最新索引切图，首尾边界不循环也不发出越界值', async () => {
    const wrapper = await setup()
    const dialog = getDialog()

    expect(dialog.get<HTMLButtonElement>('[aria-label="上一张"]').element.disabled).toBe(true)
    expect(dialog.get<HTMLButtonElement>('[aria-label="下一张"]').element.disabled).toBe(false)
    expect(keydown(dialog.element, 'ArrowLeft').defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:index')).toBeUndefined()
    expect(keydown(dialog.element, 'ArrowRight').defaultPrevented).toBe(true)
    expect(wrapper.emitted('update:index')).toEqual([[1]])

    await wrapper.setProps({ index: 1 })
    keydown(dialog.element, 'ArrowLeft')
    keydown(dialog.element, 'ArrowRight')
    expect(wrapper.emitted('update:index')).toEqual([[1], [0], [2]])

    await wrapper.setProps({ index: 2 })
    expect(dialog.get<HTMLButtonElement>('[aria-label="上一张"]').element.disabled).toBe(false)
    expect(dialog.get<HTMLButtonElement>('[aria-label="下一张"]').element.disabled).toBe(true)
    keydown(dialog.element, 'ArrowRight')
    expect(wrapper.emitted('update:index')).toEqual([[1], [0], [2]])
    keydown(dialog.element, 'ArrowLeft')
    expect(wrapper.emitted('update:index')).toEqual([[1], [0], [2], [1]])
  })

  it('上一张和下一张按钮只发出受控更新，禁用的边界按钮不发事件', async () => {
    const wrapper = await setup()
    const dialog = getDialog()

    dialog.get<HTMLButtonElement>('[aria-label="上一张"]').element.click()
    expect(wrapper.emitted('update:index')).toBeUndefined()
    dialog.get<HTMLButtonElement>('[aria-label="下一张"]').element.click()
    expect(wrapper.emitted('update:index')).toEqual([[1]])
    expect(dialog.get('img').attributes('src')).toBe(images[0]!.src)

    await wrapper.setProps({ index: 2 })
    dialog.get<HTMLButtonElement>('[aria-label="下一张"]').element.click()
    expect(wrapper.emitted('update:index')).toEqual([[1]])
    dialog.get<HTMLButtonElement>('[aria-label="上一张"]').element.click()
    expect(wrapper.emitted('update:index')).toEqual([[1], [1]])
  })

  it('Escape 从实际焦点按钮触发关闭，父级关闭后归还入口且移除键盘监听', async () => {
    const { origin } = createOrigin()
    const wrapper = await setup()
    const close = getDialog().get<HTMLButtonElement>('[aria-label="关闭大图"]')

    expect(document.activeElement).toBe(close.element)
    expect(keydown(close.element, 'Escape').defaultPrevented).toBe(true)
    expect(wrapper.emitted('close')).toEqual([[]])

    await wrapper.setProps({ index: -1 })
    expect(document.activeElement).toBe(origin)
    expect(keydown(origin, 'Escape').defaultPrevented).toBe(false)
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('点击图片与说明不关闭，关闭按钮和遮罩空白才发出关闭请求', async () => {
    const wrapper = await setup()
    const dialog = getDialog()

    await dialog.get('img').trigger('click')
    await dialog.get('figcaption').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    await dialog.get('[aria-label="关闭大图"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    await dialog.trigger('click')
    expect(wrapper.emitted('close')).toEqual([[], []])
    await dialog.get('figure').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[], [], []])
  })
})

describe('文章图片灯箱真实模态焦点', () => {
  it('Tab 与 Shift+Tab 在首尾可用按钮间循环，跳过禁用的图片切换按钮', async () => {
    const wrapper = await setup()
    const dialog = getDialog()
    const close = dialog.get<HTMLButtonElement>('[aria-label="关闭大图"]')
    const next = dialog.get<HTMLButtonElement>('[aria-label="下一张"]')

    expect(document.activeElement).toBe(close.element)
    expect(keydown(close.element, 'Tab', true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(next.element)
    expect(keydown(next.element, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close.element)

    await wrapper.setProps({ index: 2 })
    const previous = dialog.get<HTMLButtonElement>('[aria-label="上一张"]')
    expect(keydown(close.element, 'Tab', true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(previous.element)
    expect(keydown(previous.element, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close.element)
  })

  it('单图只有关闭按钮时，两个 Tab 方向均保持在该按钮', async () => {
    await setup({ images: [images[0]!], index: 0 })
    const close = getDialog().get<HTMLButtonElement>('[aria-label="关闭大图"]')

    expect(keydown(close.element, 'Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close.element)
    expect(keydown(close.element, 'Tab', true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close.element)
  })

  it('隔离背景但保留实时播报区域，关闭时精确恢复原有 inert、aria-hidden 和滚动设置', async () => {
    document.body.style.overflow = 'scroll'
    const { background, origin } = createOrigin()
    background.setAttribute('aria-hidden', 'false')
    const hidden = createFixture()
    hidden.inert = true
    hidden.setAttribute('aria-hidden', 'true')
    const live = createFixture()
    live.setAttribute('aria-live', 'polite')
    const wrapper = await setup()
    const dialog = getDialog()

    expect(background.inert).toBe(true)
    expect(background.getAttribute('aria-hidden')).toBe('true')
    expect(hidden.inert).toBe(true)
    expect(hidden.getAttribute('aria-hidden')).toBe('true')
    expect(live.inert).toBe(false)
    expect(live.hasAttribute('aria-hidden')).toBe(false)
    expect(dialog.element.inert).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')

    await wrapper.setProps({ index: -1 })
    expect(background.inert).toBe(false)
    expect(background.getAttribute('aria-hidden')).toBe('false')
    expect(hidden.inert).toBe(true)
    expect(hidden.getAttribute('aria-hidden')).toBe('true')
    expect(live.inert).toBe(false)
    expect(live.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.activeElement).toBe(origin)
  })

  it('焦点逃到非隔离的外部节点时收回关闭按钮，卸载后释放约束并归还入口', async () => {
    const { origin, background } = createOrigin()
    const live = createFixture()
    live.setAttribute('aria-live', 'polite')
    const outside = document.createElement('button')
    outside.textContent = '外部状态操作'
    live.append(outside)
    const wrapper = await setup()
    const close = getDialog().get<HTMLButtonElement>('[aria-label="关闭大图"]')

    outside.focus()
    expect(document.activeElement).toBe(close.element)
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    wrapper.unmount()
    expect(document.querySelector('.article-lightbox')).toBeNull()
    expect(document.activeElement).toBe(origin)
    expect(background.inert).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    expect(document.body.style.overflow).toBe(originalOverflow)

    outside.focus()
    expect(document.activeElement).toBe(outside)
    expect(keydown(outside, 'Escape').defaultPrevented).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
