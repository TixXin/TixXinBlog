/** @file imageState.test.ts @description 图片失败、重试、尺寸保留与迟到事件的共享状态回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useImageState } from '../../app/composables/useImageState'
import ImageFrame from '../../app/components/common/ImageFrame.vue'
import ImageFailure from '../../app/components/common/ImageFailure.vue'
import Tooltip from '../../app/components/common/Tooltip.vue'

const wrappers: { unmount(): void }[] = []
beforeEach(() => {
  // 单测显式模拟仍在请求的图片；缓存失败场景单独覆写实例属性。
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

function imageProperties(node: HTMLImageElement, width = 0, height = 0, complete = true) {
  Object.defineProperties(node, {
    complete: { configurable: true, value: complete },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  })
}

function eventFor(node: HTMLImageElement, type: 'load' | 'error') {
  const event = new Event(type)
  Object.defineProperty(event, 'target', { value: node })
  return event
}

async function mountState(initial = '/photo.webp', initialize?: (node: HTMLImageElement) => void) {
  const source = ref(initial)
  let state!: ReturnType<typeof useImageState>
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useImageState(source)
        return () =>
          source.value
            ? h('img', {
                key: state.attempt.value,
                ref: (node) => {
                  if (node) initialize?.(node as HTMLImageElement)
                  state.image.value = node as HTMLImageElement | null
                },
                src: source.value,
                onLoad: state.loaded,
                onError: state.failed,
              })
            : h('span')
      },
    }),
  )
  wrappers.push(wrapper)
  return { state, source, wrapper }
}

describe('图片加载状态', () => {
  it('识别挂载前已经失败的 SSR 图片，空地址不显示失败或发起重试', async () => {
    const { state } = await mountState('/cached.webp', (node) => imageProperties(node))
    expect(state.state.value).toBe('error')
    const empty = await mountState('')
    expect(empty.state.state.value).toBe('empty')
    const previous = empty.state.attempt.value
    empty.state.retry()
    expect(empty.state.attempt.value).toBe(previous)
  })

  it('重试替换图片节点并保留原 URL，旧节点的 load/error 不影响新请求', async () => {
    const { state, wrapper } = await mountState()
    const oldImage = wrapper.get('img').element
    await wrapper.get('img').trigger('error')
    expect(state.state.value).toBe('error')
    state.retry()
    state.failed(eventFor(oldImage, 'error'))
    expect(state.state.value).toBe('loading')
    await nextTick()
    const newImage = wrapper.get('img').element
    expect(newImage).not.toBe(oldImage)
    expect(newImage.getAttribute('src')).toBe('/photo.webp')
    imageProperties(oldImage, 800, 400)
    await state.loaded(eventFor(oldImage, 'load'))
    state.failed(eventFor(oldImage, 'error'))
    expect(state.state.value).toBe('loading')
    imageProperties(newImage, 800, 400)
    await state.loaded(eventFor(newImage, 'load'))
    expect(state.state.value).toBe('ready')
  })

  it('地址变化后忽略旧解码结果，当前 error 也不能被先前解码完成覆盖', async () => {
    const { state, source, wrapper } = await mountState()
    const oldImage = wrapper.get('img').element
    let finish!: () => void
    imageProperties(oldImage, 800, 400)
    oldImage.decode = () => new Promise<void>((resolve) => (finish = resolve))
    const pending = state.loaded(eventFor(oldImage, 'load'))
    source.value = '/new.webp'
    state.failed(eventFor(oldImage, 'error'))
    expect(state.state.value).toBe('loading')
    await nextTick()
    finish()
    await pending
    expect(state.state.value).toBe('loading')
    const newImage = wrapper.get('img').element
    imageProperties(newImage, 400, 800)
    newImage.decode = () => new Promise<void>((resolve) => (finish = resolve))
    const current = state.loaded(eventFor(newImage, 'load'))
    state.failed(eventFor(newImage, 'error'))
    finish()
    await current
    expect(state.state.value).toBe('error')
  })

  it('解码失败进入失败态，卸载后忽略解码和事件', async () => {
    const { state, wrapper } = await mountState()
    const node = wrapper.get('img').element
    imageProperties(node, 800, 400)
    node.decode = () => Promise.reject(new Error('解码失败'))
    await state.loaded(eventFor(node, 'load'))
    expect(state.state.value).toBe('error')
    let finish!: () => void
    node.decode = () => new Promise<void>((resolve) => (finish = resolve))
    const pending = state.loaded(eventFor(node, 'load'))
    wrapper.unmount()
    const previousAttempt = state.attempt.value
    finish()
    await pending
    state.failed(eventFor(node, 'error'))
    await state.loaded(eventFor(node, 'load'))
    state.retry()
    expect(state.state.value).toBe('error')
    expect(state.attempt.value).toBe(previousAttempt)
  })
})

describe('ImageFrame 失败占位', () => {
  it('失败和重试保留已加载的自然比例，地址切换才重置未知比例', async () => {
    const wrapper = await mountSuspended(ImageFrame, { props: { src: '/landscape.webp', alt: '横幅' } })
    wrappers.push(wrapper)
    const image = wrapper.get('img').element
    imageProperties(image, 1200, 400)
    await wrapper.get('img').trigger('load')
    await flushPromises()
    expect(wrapper.attributes('style')).toContain('aspect-ratio: 1200 / 400')
    await wrapper.get('img').trigger('error')
    expect(wrapper.text()).toContain('图片加载失败')
    const retry = wrapper.get('button')
    expect(retry.text()).toContain('重试')
    expect(retry.attributes('aria-label')).toBe('重新加载图片：横幅')
    await retry.trigger('click')
    expect(wrapper.attributes('style')).toContain('aspect-ratio: 1200 / 400')
    expect(wrapper.get('img').element).not.toBe(image)
    expect(wrapper.get('button').element).toBe(retry.element)
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    await wrapper.setProps({ src: '/portrait.webp' })
    expect(wrapper.attributes('style')).toContain('aspect-ratio: 3 / 2')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('显式宽高在首次失败和重试期间保持，空图沿用暂无图片', async () => {
    const wrapper = await mountSuspended(ImageFrame, {
      props: { src: '/known.webp', alt: '照片', width: 640, height: 480 },
    })
    wrappers.push(wrapper)
    await wrapper.get('img').trigger('error')
    expect(wrapper.attributes('style')).toContain('aspect-ratio: 640 / 480')
    await wrapper.get('button').trigger('click')
    expect(wrapper.attributes('style')).toContain('aspect-ratio: 640 / 480')
    await wrapper.setProps({ src: '' })
    expect(wrapper.text()).toContain('暂无图片')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('键盘重试成功后焦点仍留在图片位置，不增加图片的 Tab 停靠点', async () => {
    const wrapper = await mountSuspended(ImageFrame, {
      props: { src: '/focus.webp', alt: '焦点照片' },
      attachTo: document.body,
    })
    wrappers.push(wrapper)
    await wrapper.get('img').trigger('error')
    const retry = wrapper.get('button')
    retry.element.focus()
    await retry.trigger('click', { detail: 0 })
    expect(document.activeElement).toBe(retry.element)
    const image = wrapper.get('img')
    imageProperties(image.element, 600, 400)
    await image.trigger('load')
    await flushPromises()
    expect(document.activeElement).toBe(image.element)
    expect(image.attributes('tabindex')).toBe('-1')
  })
})

describe('共享失败操作', () => {
  it('原生按钮允许键盘激活，Enter/空格不冒泡，Escape 仍可退出预览', async () => {
    const click = vi.fn()
    const keydown = vi.fn()
    const wrapper = await mountSuspended(ImageFailure, {
      props: { alt: '山间云雾' },
      attrs: { onClick: click, onKeydown: keydown },
    })
    wrappers.push(wrapper)
    const button = wrapper.get('button')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('tabindex')).not.toBe('-1')
    await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('keydown', { key: ' ' })
    expect(keydown).not.toHaveBeenCalled()
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(click).not.toHaveBeenCalled()
    await button.trigger('keydown', { key: 'Escape' })
    expect(keydown).toHaveBeenCalledOnce()
    await wrapper.setProps({ retrying: true })
    await button.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('小图按钮提供完整失败和重试说明，使用共享 Tooltip', async () => {
    const wrapper = await mountSuspended(ImageFailure, { props: { alt: '作者头像', compact: true } })
    wrappers.push(wrapper)
    expect(wrapper.classes()).toContain('image-failure--compact')
    expect(wrapper.get('button').attributes('aria-label')).toBe('图片加载失败，重试：作者头像')
    expect(wrapper.findComponent(Tooltip).props('content')).toBe('图片加载失败，重试：作者头像')
  })
})
