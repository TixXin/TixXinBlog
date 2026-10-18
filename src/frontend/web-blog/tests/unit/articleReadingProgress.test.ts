/**
 * @file articleReadingProgress.test.ts
 * @description 阅读进度回归：正文范围、滚动容器、边界与观察器清理，装饰进度遵循减少动态效果
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileStyle, parse } from 'vue/compiler-sfc'
import { mount } from '@vue/test-utils'
import { Window } from 'happy-dom'
import ReadingProgress from '../../app/components/common/ReadingProgress.vue'
import { useReadingProgress } from '../../app/composables/useReadingProgress'

const wrappers: { unmount(): void }[] = []
const fixtures: HTMLElement[] = []
const frames = new Map<number, FrameRequestCallback>()
const observers: ResizeObserverMock[] = []
let frameId = 0

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }
}

beforeEach(() => {
  frames.clear()
  observers.length = 0
  frameId = 0
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(612)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  fixtures.splice(0).forEach((fixture) => fixture.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function flushFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(performance.now()))
  await nextTick()
}

function articleFixture(top = 12, height = 1800) {
  const page = document.createElement('main')
  page.className = 'article-page'
  const article = document.createElement('article')
  page.append(article)
  document.body.append(page)
  fixtures.push(page)
  const bounds = { top, height }
  vi.spyOn(article, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, bounds.top, 800, bounds.height))
  return { page, article, bounds }
}

function mountProgress(content: HTMLElement | null, root: HTMLElement | null = null) {
  const contentRef = ref(content)
  let state!: ReturnType<typeof useReadingProgress>
  const wrapper = mount(
    defineComponent({
      setup() {
        // 空文章编号只计算进度，不读写阅读位置存储，保持各用例互不影响。
        state = useReadingProgress(ref(root), contentRef, '')
        return () => h(ReadingProgress, { progress: state.progress.value })
      },
    }),
  )
  wrappers.push(wrapper)
  return { wrapper, state, contentRef }
}

describe('ReadingProgress', () => {
  it.each([
    [-15, 'scaleX(0)'],
    [0, 'scaleX(0)'],
    [42.5, 'scaleX(0.425)'],
    [100, 'scaleX(1)'],
    [135, 'scaleX(1)'],
  ])('进度 %s 限定在可见边界内', (progress, transform) => {
    const wrapper = mount(ReadingProgress, { props: { progress } })
    wrappers.push(wrapper)
    expect(wrapper.get('.reading-progress__bar').attributes('style')).toContain(`transform: ${transform}`)
  })

  it('响应进度变化，装饰条不成为读屏或键盘的重复入口', async () => {
    const wrapper = mount(ReadingProgress, { props: { progress: 0 } })
    wrappers.push(wrapper)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect((wrapper.element as HTMLElement).tabIndex).toBe(-1)
    expect(wrapper.find('a, button, input, [tabindex], [role="progressbar"]').exists()).toBe(false)

    await wrapper.setProps({ progress: 75 })
    expect(wrapper.get('.reading-progress__bar').attributes('style')).toContain('transform: scaleX(0.75)')
  })

  it.each(['no-preference', 'reduce'])('系统 %s 时计算组件实际样式，减动效只关闭插值', async (motion) => {
    // Vitest 默认不加载组件 CSS；编译原组件的样式，在独立 DOM 中核对媒体查询的实际结果。
    const source = readFileSync(resolve(import.meta.dirname, '../../app/components/common/ReadingProgress.vue'), 'utf8')
    const { descriptor } = parse(source)
    const style = descriptor.styles[0]!
    const compiled = compileStyle({
      filename: 'ReadingProgress.vue',
      source: style.content,
      id: 'reading-progress-test',
      preprocessLang: 'scss',
    })
    expect(compiled.errors).toEqual([])

    const wrapper = mount(ReadingProgress, { props: { progress: 40 } })
    wrappers.push(wrapper)
    const browser = new Window({ settings: { device: { prefersReducedMotion: motion } } })
    try {
      const sheet = browser.document.createElement('style')
      sheet.textContent = compiled.code
      browser.document.head.append(sheet)
      browser.document.body.innerHTML = wrapper.html()
      const bar = browser.document.querySelector('.reading-progress__bar')!
      const computed = browser.getComputedStyle(bar)
      expect(computed.transform).toBe('scaleX(0.4)')
      expect(computed.transition).toBe(motion === 'reduce' ? 'none' : 'transform 0.08s linear')
    } finally {
      await browser.happyDOM.close()
    }
  })
})

describe('useReadingProgress 与进度条', () => {
  it('正文未就绪时保持零，正文出现后可由滚动事件更新', async () => {
    const { wrapper, state, contentRef } = mountProgress(null)
    await flushFrame()
    expect(state.progress.value).toBe(0)
    expect(wrapper.get('.reading-progress__bar').attributes('style')).toContain('scaleX(0)')
    expect(observers[0]!.observe).not.toHaveBeenCalled()

    const { article } = articleFixture(-588)
    contentRef.value = article
    document.dispatchEvent(new Event('scroll'))
    await flushFrame()
    expect(state.progress.value).toBe(50)
    expect(wrapper.get('.reading-progress__bar').attributes('style')).toContain('scaleX(0.5)')
  })

  it('以正文而非评论区长度计算文档滚动进度，并限制首尾越界', async () => {
    const { page, article, bounds } = articleFixture()
    const comments = document.createElement('section')
    vi.spyOn(comments, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 1812, 800, 5000))
    page.append(comments)
    const { state } = mountProgress(article)
    await flushFrame()
    expect(state.progress.value).toBe(0)

    for (const [top, progress] of [
      [212, 0],
      [-588, 50],
      [-1188, 100],
      [-1988, 100],
    ]) {
      bounds.top = top!
      document.dispatchEvent(new Event('scroll'))
      await flushFrame()
      expect(state.progress.value).toBe(progress)
    }
    expect(comments.getBoundingClientRect).not.toHaveBeenCalled()
  })

  it('内部滚动使用容器视口与吸顶标题高度，非冒泡滚动仍能更新', async () => {
    const { page, article, bounds } = articleFixture(156, 1744)
    page.style.overflowY = 'auto'
    Object.defineProperties(page, { scrollHeight: { value: 3000 }, clientHeight: { value: 600 } })
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 800, 600))
    const header = document.createElement('header')
    header.className = 'article-sticky-header'
    header.style.position = 'sticky'
    vi.spyOn(header, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 800, 44))
    page.prepend(header)
    const { state } = mountProgress(article, page)
    await flushFrame()
    expect(state.progress.value).toBe(0)

    bounds.top = -444
    page.dispatchEvent(new Event('scroll', { bubbles: false }))
    await flushFrame()
    expect(state.progress.value).toBe(50)
    bounds.top = -1044
    page.dispatchEvent(new Event('scroll', { bubbles: false }))
    await flushFrame()
    expect(state.progress.value).toBe(100)
  })

  it.each([
    [400, 300, 0],
    [312, 300, 100],
    [12, 600, 100],
    // 正文尚未撑开（高度为 0）时无法测量，不判为读完，避免误清已保存的阅读位置。
    [12, 0, 0],
  ])('短正文或空正文 top=%s height=%s 以末尾是否可见判断完成', async (top, height, progress) => {
    const { article } = articleFixture(top, height)
    const { state } = mountProgress(article)
    await flushFrame()
    expect(state.progress.value).toBe(progress)
    expect(Number.isFinite(state.progress.value)).toBe(true)
  })

  it('合并连续滚动帧，窗口和正文尺寸变化都会重新计算', async () => {
    const { article, bounds } = articleFixture()
    const { state } = mountProgress(article)
    await flushFrame()
    expect(observers[0]!.observe).toHaveBeenCalledWith(article)

    bounds.top = -288
    document.dispatchEvent(new Event('scroll'))
    bounds.top = -588
    document.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(1)
    expect(state.progress.value).toBe(0)
    await flushFrame()
    expect(state.progress.value).toBe(50)

    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(912)
    window.dispatchEvent(new Event('resize'))
    await flushFrame()
    expect(state.progress.value).toBe(67)

    bounds.height = 2700
    observers[0]!.callback([], observers[0] as unknown as ResizeObserver)
    await flushFrame()
    expect(state.progress.value).toBe(33)
  })

  it('卸载时取消待执行帧，移除原监听并断开正文尺寸观察', async () => {
    const documentAdd = vi.spyOn(document, 'addEventListener')
    const documentRemove = vi.spyOn(document, 'removeEventListener')
    const windowAdd = vi.spyOn(window, 'addEventListener')
    const windowRemove = vi.spyOn(window, 'removeEventListener')
    const { article, bounds } = articleFixture()
    const { wrapper, state } = mountProgress(article)
    await flushFrame()
    const onScroll = documentAdd.mock.calls.find(([event]) => event === 'scroll')![1]
    const onResize = windowAdd.mock.calls.find(([event]) => event === 'resize')![1]
    expect(documentAdd).toHaveBeenCalledWith('scroll', onScroll, { capture: true, passive: true })
    expect(windowAdd).toHaveBeenCalledWith('resize', onResize, { passive: true })

    bounds.top = -588
    document.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(1)
    // 观察目标变化时会先断开旧观察，这里只核验卸载额外断开一次。
    const disconnects = observers[0]!.disconnect.mock.calls.length
    wrapper.unmount()
    expect(frames.size).toBe(0)
    expect(state.progress.value).toBe(50)
    expect(observers[0]!.disconnect).toHaveBeenCalledTimes(disconnects + 1)
    expect(documentRemove).toHaveBeenCalledWith('scroll', onScroll, true)
    expect(windowRemove).toHaveBeenCalledWith('resize', onResize)

    document.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(0)
    await flushFrame()
    // 卸载前同步结算最后一次滚动（用于保存阅读位置），之后的事件不再更新进度。
    expect(state.progress.value).toBe(50)
  })
})
