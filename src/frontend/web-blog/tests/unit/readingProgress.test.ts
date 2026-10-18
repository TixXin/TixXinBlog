/** @file readingProgress.test.ts @description 文章位置的容量、恢复、正文边界与生命周期回归 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { mount } from '@vue/test-utils'
import { useReadingProgress } from '../../app/composables/useReadingProgress'
import { useReadingHistory } from '../../app/composables/useReadingHistory'
import { mountSuspended } from '@nuxt/test-utils/runtime'

const key = 'blog-reading-positions'
const wrappers: { unmount(): void }[] = []
let frames: Map<number, FrameRequestCallback>
let resize: () => void
let disconnect: ReturnType<typeof vi.fn>
let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((name: string) => storage.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => storage.set(name, value)),
    removeItem: vi.fn((name: string) => storage.delete(name)),
  })
  frames = new Map()
  let frameId = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    },
  )
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function frame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(0))
}
function seed(id = '42', position = 0.4, updatedAt = 1) {
  storage.set(key, JSON.stringify([{ id, position, updatedAt }]))
}
function entries(): { id: string; position: number; updatedAt: number }[] {
  return JSON.parse(storage.get(key) ?? '[]')
}

async function setup(documentScroll = false) {
  const id = ref('42')
  const root = ref<HTMLElement | null>(null)
  const content = ref<HTMLElement | null>(null)
  let state!: ReturnType<typeof useReadingProgress>
  let height = 2000
  let start = 400
  let scrollTop = 0
  const rootTop = documentScroll ? 0 : 100
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useReadingProgress(root, content, id)
        return () =>
          h('div', { class: 'article-page', ref: root, style: { overflowY: documentScroll ? 'visible' : 'auto' } }, [
            h('header', { class: 'article-sticky-header', style: { position: 'sticky' } }),
            h('div', { ref: content }, [h('p', '第一段'), h('p', '中间段落')]),
          ])
      },
    }),
    { attachTo: document.body },
  )
  wrappers.push(wrapper)
  const element = root.value!
  const body = content.value!
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, get: () => 4000 },
    clientHeight: { configurable: true, get: () => 800 },
    scrollTop: { configurable: true, get: () => scrollTop, set: (value: number) => (scrollTop = value) },
  })
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollTop)
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, rootTop, 600, 800))
  vi.spyOn(element.querySelector('header')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, rootTop, 600, 100))
  vi.spyOn(body, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, rootTop + start - scrollTop, 600, height),
  )
  body.querySelectorAll('p').forEach((paragraph, index) => {
    vi.spyOn(paragraph, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, rootTop + start - scrollTop + index * 600, 600, 100),
    )
  })
  const scroll = vi.spyOn(documentScroll ? window : element, 'scrollTo').mockImplementation(() => {})
  await nextTick()
  frame()
  return {
    state,
    id,
    element,
    body,
    wrapper,
    scroll,
    setHeight: (value: number) => (height = value),
    setStart: (value: number) => (start = value),
    move(position: number, runFrame = true) {
      scrollTop = start - 112 + position * (height - 800 + 112)
      const target = documentScroll ? document : element
      target.dispatchEvent(new Event('scroll'))
      if (runFrame) frame()
    },
  }
}

describe('阅读位置保存与恢复', () => {
  it('服务端渲染不访问浏览器存储，也不渲染恢复提示', async () => {
    seed()
    const html = await renderToString(
      createSSRApp(
        defineComponent({
          setup() {
            const state = useReadingProgress(ref(null), ref(null), '42')
            return () => h('div', state.resumeProgress.value === null ? '正文' : '继续上次阅读')
          },
        }),
      ),
    )
    expect(html).toBe('<div>正文</div>')
    expect(localStorage.getItem).not.toHaveBeenCalled()
  })

  it('localStorage 属性访问被禁止时仍可挂载、滚动和卸载', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('access denied')
      },
    })
    const { move } = await setup()
    expect(() => {
      move(0.5)
      vi.advanceTimersByTime(300)
      move(1)
    }).not.toThrow()
  })

  it.each(['load', 'error'])('正文图片 %s 且高度未变时仍重新判断读完', async (event) => {
    seed()
    const { body, setHeight, state } = await setup()
    const image = document.createElement('img')
    const complete = vi.spyOn(image, 'complete', 'get').mockReturnValue(false)
    body.append(image)
    setHeight(100)
    resize()
    frame()
    expect(entries()).toHaveLength(1)
    complete.mockReturnValue(true)
    image.dispatchEvent(new Event(event))
    frame()
    expect(state.progress.value).toBe(100)
    expect(entries()).toEqual([])
  })

  it('初次测量和缩放只显示提示，不覆盖旧位置或自动跳转', async () => {
    seed()
    const { state, scroll } = await setup()
    expect(state.resumeProgress.value).toBe(40)
    expect(state.progress.value).toBe(0)
    resize()
    window.dispatchEvent(new Event('resize'))
    frame()
    vi.advanceTimersByTime(500)
    expect(scroll).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(entries()[0]?.position).toBe(0.4)
  })

  it('定期合并最新记录，保留最近 50 篇并按真实文章 ID 去重', async () => {
    storage.set(
      key,
      JSON.stringify(
        Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}`, position: 0.3, updatedAt: index })),
      ),
    )
    const { move } = await setup()
    move(0.5)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    storage.set(key, JSON.stringify([...entries(), { id: 'other-tab', position: 0.6, updatedAt: 100 }]))
    vi.advanceTimersByTime(300)
    expect(entries()).toHaveLength(50)
    expect(entries()[0]).toMatchObject({ id: '42', position: 0.5 })
    expect(entries().some((item) => item.id === 'old-0')).toBe(false)
    expect(entries().some((item) => item.id === 'old-1')).toBe(false)
    expect(entries().some((item) => item.id === 'other-tab')).toBe(true)
    move(0.6)
    vi.advanceTimersByTime(300)
    expect(entries().filter((item) => item.id === '42')).toHaveLength(1)
    expect(entries()[0]?.position).toBeCloseTo(0.6)
  })

  it('重新打开恢复上次提示，其他文章互不串位', async () => {
    const first = await setup()
    first.move(0.25)
    first.wrapper.unmount()
    wrappers.pop()
    const second = await setup()
    expect(second.state.resumeProgress.value).toBe(25)
    second.id.value = 'different-id'
    await nextTick()
    expect(second.state.resumeProgress.value).toBeNull()
    expect(entries()[0]?.id).toBe('42')
  })

  it('点击后等待提示收起再计算位置，减少动态效果时即时滚动并转移焦点', async () => {
    seed('42', 0.5)
    const { state, setStart, scroll, body } = await setup()
    const restoring = state.resumeReading()
    setStart(300)
    await restoring
    expect(state.resumeProgress.value).toBeNull()
    expect(scroll).toHaveBeenCalledWith({ top: 844, behavior: 'instant' })
    expect(document.activeElement).toBe(body.querySelectorAll('p')[1])
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
  })

  it('文档滚动复用可中断的普通平滑动效', async () => {
    seed('42', 0.5)
    vi.mocked(matchMedia).mockReturnValue({ matches: false } as MediaQueryList)
    const { state, scroll } = await setup(true)
    await state.resumeReading()
    expect(scroll).toHaveBeenCalledWith({ top: 944, behavior: 'smooth' })
    document.dispatchEvent(new Event('wheel'))
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
  })

  it('文档滚动也能保存，其他区域滚动不触发写入', async () => {
    const { move, body } = await setup(true)
    move(0.4)
    vi.advanceTimersByTime(300)
    expect(entries()[0]?.position).toBeCloseTo(0.4)
    vi.mocked(localStorage.setItem).mockClear()
    body.querySelector('p')!.dispatchEvent(new Event('scroll'))
    frame()
    vi.advanceTimersByTime(300)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('内部滚动根忽略非正文滚动，异步空正文不会清掉旧记录', async () => {
    seed()
    const { body, setHeight, state } = await setup()
    setHeight(0)
    resize()
    frame()
    expect(state.resumeProgress.value).toBe(40)
    setHeight(2000)
    body.dispatchEvent(new Event('scroll'))
    frame()
    vi.advanceTimersByTime(500)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(entries()[0]?.position).toBe(0.4)
  })

  it('正文图片尚未加载不能误判读完，图片撑高后继续保存', async () => {
    seed()
    const { body, setHeight, move, state } = await setup()
    const image = document.createElement('img')
    vi.spyOn(image, 'complete', 'get').mockReturnValue(false)
    body.append(image)
    setHeight(100)
    resize()
    frame()
    expect(state.resumeProgress.value).toBe(40)
    expect(entries()).toHaveLength(1)
    setHeight(2000)
    vi.spyOn(image, 'complete', 'get').mockReturnValue(true)
    move(0.6)
    vi.advanceTimersByTime(300)
    expect(entries()[0]?.position).toBeCloseTo(0.6)
  })

  it('实际正文末尾进入视口才清除，评论区和向上回看不重建记录', async () => {
    seed()
    const { move, state } = await setup()
    move(0.996)
    vi.advanceTimersByTime(300)
    expect(state.progress.value).toBe(99)
    expect(entries()).toHaveLength(1)
    move(1)
    expect(state.progress.value).toBe(100)
    expect(state.resumeProgress.value).toBeNull()
    expect(entries()).toEqual([])
    move(1.2)
    move(0.6)
    window.dispatchEvent(new Event('pagehide'))
    expect(entries()).toEqual([])
  })

  it('初次只在封面区域滚动仍保留上次阅读入口', async () => {
    seed()
    const { move, state } = await setup()
    move(0)
    vi.advanceTimersByTime(300)
    expect(state.resumeProgress.value).toBe(40)
    expect(entries()[0]?.position).toBe(0.4)
  })

  it('未加载图片使当前正文已到底时仍保存可恢复位置', async () => {
    const first = await setup()
    const image = document.createElement('img')
    vi.spyOn(image, 'complete', 'get').mockReturnValue(false)
    first.body.append(image)
    first.move(1)
    vi.advanceTimersByTime(300)
    expect(entries()[0]?.position).toBeLessThan(1)
    first.wrapper.unmount()
    wrappers.pop()
    const second = await setup()
    expect(second.state.resumeProgress.value).toBe(99)
  })

  it('主动回顶取消未落盘的位置，继续往下阅读仍能保存', async () => {
    seed()
    const { move } = await setup()
    move(0.5)
    move(0)
    vi.advanceTimersByTime(300)
    expect(entries()).toEqual([])
    move(0.2)
    vi.advanceTimersByTime(300)
    expect(entries()[0]?.position).toBeCloseTo(0.2)
  })

  it('一屏能看完的正文只清掉该篇记录', async () => {
    seed()
    storage.set(key, JSON.stringify([...entries(), { id: 'other', position: 0.2, updatedAt: 2 }]))
    const { setHeight, state } = await setup()
    setHeight(100)
    resize()
    frame()
    expect(state.progress.value).toBe(100)
    expect(entries().map((item) => item.id)).toEqual(['other'])
  })

  it.each(['pagehide', 'visibilitychange', 'unmount'])('%s 保存尚未执行的滚动帧', async (event) => {
    const { move, wrapper } = await setup()
    move(0.3, false)
    if (event === 'unmount') {
      wrapper.unmount()
      wrappers.pop()
    } else if (event === 'visibilitychange') {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event(event))
    } else window.dispatchEvent(new Event(event))
    expect(entries()[0]?.position).toBeCloseTo(0.3)
    expect(frames.size).toBe(0)
  })

  it('卸载取消恢复任务、观察器和帧，之后事件不再写入', async () => {
    seed()
    const { state, wrapper, element, scroll } = await setup()
    const restoring = state.resumeReading()
    wrapper.unmount()
    wrappers.pop()
    await restoring
    expect(scroll).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalled()
    element.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('pagehide'))
    vi.advanceTimersByTime(500)
    expect(frames.size).toBe(0)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it.each(['{', '{}', 'null', '[null,0,{"id":"42","position":1,"updatedAt":1}]'])(
    '损坏或无效记录 %s 不影响阅读',
    async (raw) => {
      storage.set(key, raw)
      const { state, move } = await setup()
      expect(state.resumeProgress.value).toBeNull()
      move(0.2)
      vi.advanceTimersByTime(300)
      expect(entries()[0]?.position).toBeCloseTo(0.2)
    },
  )

  it('重复 ID 只采用最新有效记录', async () => {
    storage.set(
      key,
      JSON.stringify([
        { id: '42', position: 0.4, updatedAt: 1 },
        { id: '42', position: 0.7, updatedAt: 2 },
        { id: '42', position: '0.9', updatedAt: 3 },
        { id: '42', position: -0.1, updatedAt: 4 },
        { id: '42', position: 0.9, updatedAt: 'yesterday' },
      ]),
    )
    const { state, move } = await setup()
    expect(state.resumeProgress.value).toBe(70)
    move(0.8)
    vi.advanceTimersByTime(300)
    expect(entries()).toHaveLength(1)
  })

  it.each(['getItem', 'setItem', 'removeItem'] as const)('存储 %s 抛错仍可阅读和离开', async (method) => {
    vi.mocked(localStorage[method]).mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { move, state } = await setup()
    expect(() => {
      move(0.5)
      vi.advanceTimersByTime(300)
      move(1)
      window.dispatchEvent(new Event('pagehide'))
    }).not.toThrow()
    expect(state.progress.value).toBe(100)
  })

  it('同页阅读历史的写入或清除失败不会使文章挂载失败', async () => {
    vi.useRealTimers()
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('quota')
    })
    vi.mocked(localStorage.removeItem).mockImplementation(() => {
      throw new Error('denied')
    })
    let history!: ReturnType<typeof useReadingHistory>
    wrappers.push(
      await mountSuspended(
        defineComponent({
          setup() {
            history = useReadingHistory()
            return () => h('div')
          },
        }),
      ),
    )
    expect(() => history.addToHistory({ id: '42', title: '文章', date: '2026-10-18' })).not.toThrow()
    expect(() => history.clearHistory()).not.toThrow()
  })
})
