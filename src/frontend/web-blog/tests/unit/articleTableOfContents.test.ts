/** @file articleTableOfContents.test.ts @description 文章目录覆盖空状态、章节跟随、原生链接导航、焦点和减少动态效果 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import TableOfContents from '../../app/components/article/TableOfContents.vue'
import { useTableOfContents } from '../../app/composables/useTableOfContents'
import { finishRootScrolls } from '../../app/utils/scrollRoot'
import type { TocItem } from '../../app/features/post/types'

const mocks = vi.hoisted(() => ({
  enabled: false,
  router: {} as {
    currentRoute: { value: { path: string } }
    replace: ReturnType<typeof vi.fn>
  },
}))
mockNuxtImport('useRouter', async () => {
  const actual = await vi.importActual<typeof import('#app/composables/router')>('#app/composables/router')
  return () => (mocks.enabled ? mocks.router : actual.useRouter())
})

const items: TocItem[] = [
  { id: 'toc-intro', text: '开始之前', level: 2 },
  { id: 'toc-details', text: '细节与取舍', level: 3 },
  { id: 'toc-summary', text: '回顾', level: 2 },
]
const wrappers: { unmount(): void }[] = []
const nodes: HTMLElement[] = []
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let reducedMotion: boolean

beforeEach(() => {
  mocks.enabled = true
  mocks.router = {
    currentRoute: ref({ path: '/articles/49' }),
    replace: vi.fn().mockResolvedValue(undefined),
  }
  reducedMotion = true
  frames = new Map()
  nextFrame = 1
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrame++
    frames.set(id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  finishRootScrolls()
  nodes.splice(0).forEach((node) => node.remove())
  mocks.enabled = false
  vi.restoreAllMocks()
})

async function flushFrames() {
  await nextTick()
  await flushPromises()
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(0))
  await nextTick()
}

function setup(props: { items?: TocItem[]; activeId?: string; progress?: number } = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  nodes.push(host)
  const wrapper = mount(TableOfContents, {
    attachTo: host,
    props: { items, activeId: '', ...props },
    global: { stubs: { Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

function rect(top: number, height: number) {
  return new DOMRect(0, top, 600, height)
}

/** 仅提供浏览器布局数据；目录跟随与滚动位置继续由真实组合函数和滚动工具计算。 */
function articleFixture(nested = true) {
  const root = document.createElement('div')
  root.className = 'article-page'
  root.style.overflowY = nested ? 'auto' : 'visible'
  root.innerHTML = `
    <header class="article-sticky-header" style="position: sticky">文章标题</header>
    <article class="article-reading-content">
      <h2 id="toc-intro">开始之前</h2>
      <h3 id="toc-details">细节与取舍</h3>
      <h2 id="toc-summary">回顾</h2>
    </article>
  `
  document.body.append(root)
  nodes.push(root)
  Object.defineProperties(root, {
    clientHeight: { configurable: true, value: 500 },
    scrollHeight: { configurable: true, value: 1800 },
  })
  root.scrollTop = 120
  const positions = { headingTops: [140, 340, 640], bodyBottom: 1500 }
  const headings = items.map((item) => root.querySelector<HTMLElement>(`#${item.id}`)!)
  vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => rect(100, 500))
  vi.spyOn(root.querySelector('header')!, 'getBoundingClientRect').mockImplementation(() => rect(100, 64))
  vi.spyOn(root.querySelector('article')!, 'getBoundingClientRect').mockImplementation(() =>
    rect(140, positions.bodyBottom - 140),
  )
  headings.forEach((heading, index) => {
    vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => rect(positions.headingTops[index]!, 32))
  })
  const scrollTo = vi.spyOn(root, 'scrollTo').mockImplementation(() => {})
  return { root, headings, positions, scrollTo }
}

function followingContents(initialItems = items) {
  const tocItems = ref(initialItems)
  const wrapper = mount(
    defineComponent({
      setup() {
        const { activeId } = useTableOfContents(tocItems)
        return () => h(TableOfContents, { items: tocItems.value, activeId: activeId.value })
      },
    }),
    { global: { stubs: { Icon: true } } },
  )
  wrappers.push(wrapper)
  return { wrapper, tocItems }
}

describe('文章目录的展示与可访问导航', () => {
  it('空目录保留导航名称，没有虚构条目或阅读进度', () => {
    const wrapper = setup({ items: [] })
    expect(wrapper.get('nav').attributes('aria-label')).toBe('文章目录')
    expect(wrapper.get('h2').text()).toBe('文章目录')
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.find('.toc__progress').exists()).toBe(false)
  })

  it('层级以缩进区分，activeId 变化只标记当前章节并显示取整进度', async () => {
    const wrapper = setup({ activeId: 'toc-intro', progress: 41.6 })
    const links = wrapper.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual(['#toc-intro', '#toc-details', '#toc-summary'])
    expect(links.map((link) => link.text())).toEqual(['开始之前', '细节与取舍', '回顾'])
    expect((links[0]!.element as HTMLElement).style.paddingLeft).toBe('0.75rem')
    expect((links[1]!.element as HTMLElement).style.paddingLeft).toBe('1.5rem')
    expect(links[1]!.classes()).toContain('toc__link--sub')
    expect(wrapper.get('.toc__progress').text()).toBe('42%')
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-intro')

    await wrapper.setProps({ activeId: 'toc-details', progress: 0 })
    expect(wrapper.findAll('[aria-current="location"]')).toHaveLength(1)
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-details')
    expect(links[0]!.classes()).not.toContain('toc__link--active')
    expect(wrapper.get('.toc__progress').text()).toBe('0%')

    await wrapper.setProps({ activeId: 'missing-heading' })
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
  })

  it('链接在原生 Tab 顺序中，键盘激活后替换 hash 并把焦点交给正文标题', async () => {
    const { headings, scrollTo } = articleFixture()
    const wrapper = setup()
    const link = wrapper.get<HTMLAnchorElement>('a[href="#toc-details"]').element
    expect(link.tabIndex).toBe(0)
    link.focus()
    expect(document.activeElement).toBe(link)
    // DOM 单测不会生成 Enter 的浏览器默认动作，直接派发原生键盘激活所产生的 detail=0 点击。
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 })
    link.dispatchEvent(activation)
    expect(activation.defaultPrevented).toBe(true)
    expect(wrapper.emitted('navigate')).toEqual([[]])
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith({ hash: '#toc-details' })
    expect(document.activeElement).toBe(link)

    await flushFrames()
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 284, behavior: 'instant' })
    expect(headings[1]!.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(headings[1])
  })

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const)('带 %s 的链接点击保留浏览器默认操作', (key) => {
    const wrapper = setup()
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true, [key]: true })
    wrapper.get('a').element.dispatchEvent(activation)
    expect(activation.defaultPrevented).toBe(false)
    expect(mocks.router.replace).not.toHaveBeenCalled()
    expect(wrapper.emitted('navigate')).toBeUndefined()
    expect(frames.size).toBe(0)
  })

  it.each([1, 2])('第 %i 号鼠标键不触发目录的滚动与路由处理', (button) => {
    const wrapper = setup()
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true, button })
    wrapper.get('a').element.dispatchEvent(activation)
    expect(activation.defaultPrevented).toBe(false)
    expect(mocks.router.replace).not.toHaveBeenCalled()
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('已被外层取消的点击不会再次发起导航', () => {
    const wrapper = setup()
    const activation = new MouseEvent('click', { bubbles: true, cancelable: true })
    activation.preventDefault()
    wrapper.get('a').element.dispatchEvent(activation)
    expect(mocks.router.replace).not.toHaveBeenCalled()
    expect(wrapper.emitted('navigate')).toBeUndefined()
  })

  it('路由替换尚未完成时不移动焦点，等待期间离开文章则取消定位', async () => {
    const { headings, scrollTo } = articleFixture()
    let resolveNavigation!: () => void
    mocks.router.replace.mockImplementation(() => new Promise<void>((resolve) => (resolveNavigation = resolve)))
    const wrapper = setup()
    const link = wrapper.get<HTMLAnchorElement>('a').element
    link.focus()
    link.click()
    await flushFrames()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(link)

    mocks.router.currentRoute.value = { path: '/articles/50' }
    resolveNavigation()
    await flushFrames()
    expect(scrollTo).not.toHaveBeenCalled()
    expect(headings[0]!.hasAttribute('tabindex')).toBe(false)
    expect(document.activeElement).toBe(link)
  })

  it('目标标题已被正文更新移除时安全结束，不抢走当前焦点', async () => {
    const wrapper = setup()
    const link = wrapper.get<HTMLAnchorElement>('a').element
    link.focus()
    link.click()
    await flushFrames()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(link)
  })

  it.each([
    { reduced: true, behavior: 'instant' },
    { reduced: false, behavior: 'smooth' },
  ])('减少动态效果为 $reduced 时，真实滚动工具使用 $behavior', async ({ reduced, behavior }) => {
    reducedMotion = reduced
    const { headings, scrollTo } = articleFixture()
    const wrapper = setup()
    await wrapper.get('a[href="#toc-details"]').trigger('click')
    await flushFrames()
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 284, behavior })
    expect(document.activeElement).toBe(headings[1])
  })
})

describe('文章目录跟随真实滚动容器', () => {
  it('没有目录或所有标题尚未渲染时均无激活项', async () => {
    const { wrapper, tocItems } = followingContents([])
    await flushFrames()
    expect(wrapper.findAll('a')).toHaveLength(0)
    await nextTick()
    tocItems.value = items
    await flushFrames()
    expect(wrapper.findAll('a')).toHaveLength(3)
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
  })

  it('嵌套滚动按粘性标题下缘切换当前章节，滚至文末时选中最后一节', async () => {
    const { root, positions } = articleFixture()
    const { wrapper } = followingContents()
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-intro')

    positions.headingTops = [0, 178, 420]
    root.dispatchEvent(new Event('scroll'))
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-details')

    positions.bodyBottom = 588
    root.dispatchEvent(new Event('scroll'))
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-summary')
  })

  it('文档滚动和窗口尺寸变化也会重新判定章节，不依赖内部滚动容器', async () => {
    const { positions } = articleFixture(false)
    const { wrapper } = followingContents()
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-intro')

    positions.headingTops = [-150, 78, 400]
    window.dispatchEvent(new Event('resize'))
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-details')

    positions.headingTops = [-500, -200, 70]
    document.dispatchEvent(new Event('scroll'))
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-summary')
  })

  it('目录更新时跳过已经移除的标题，清空目录后不保留过期激活项', async () => {
    const { headings } = articleFixture()
    const { wrapper, tocItems } = followingContents()
    await flushFrames()
    headings[0]!.remove()
    tocItems.value = [...items]
    await flushFrames()
    expect(wrapper.get('[aria-current="location"]').attributes('href')).toBe('#toc-details')

    tocItems.value = []
    await flushFrames()
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.findAll('[aria-current]')).toHaveLength(0)
  })

  it('滚动事件合并为一帧，卸载取消待处理帧并移除滚动和 resize 监听', async () => {
    const { root } = articleFixture()
    const { wrapper } = followingContents()
    await flushFrames()
    root.dispatchEvent(new Event('scroll'))
    root.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(1)
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(frames.size).toBe(0)

    root.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(0)
  })
})
