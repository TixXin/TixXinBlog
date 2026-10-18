/**
 * @file HeadingAnchorButton.test.ts
 * @description 标题锚点复制的完整地址、键盘语义、真实提示组件与异步清理；验证 Markdown 标题更新和高亮重绘后的挂载归属
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import HeadingAnchorButton from '../../app/components/article/HeadingAnchorButton.vue'
import ArticleMarkdown from '../../app/components/article/Markdown.vue'
import { loadCodeHighlighter, type CodeHighlighter } from '../../app/utils/highlightCode'

const { success, warning } = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ success, warning, error: vi.fn() }))
vi.mock('../../app/utils/highlightCode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/utils/highlightCode')>()),
  loadCodeHighlighter: vi.fn(),
}))

const write = vi.fn<(text: string) => Promise<void>>()
let clipboard: PropertyDescriptor | undefined
let originalUrl: string
enableAutoUnmount(afterEach)

beforeEach(() => {
  success.mockReset()
  warning.mockReset()
  write.mockReset().mockResolvedValue()
  vi.mocked(loadCodeHighlighter).mockReset()
  clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
  originalUrl = window.location.href
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  window.history.replaceState(null, '', originalUrl)
  document.body.innerHTML = ''
})

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function setArticleUrl(path = '/articles/anchor-example?from=archive&view=full#previous-heading') {
  window.history.replaceState(null, '', path)
  return window.location.href
}

describe('HeadingAnchorButton', () => {
  it('使用可聚焦的原生按钮和标题可访问名，复制保留路径及查询参数的完整地址并替换旧锚点', async () => {
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-3', headingText: '缓存与更新' },
      attachTo: document.body,
    })
    const original = setArticleUrl()
    const button = wrapper.get('button.heading-anchor')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('aria-label')).toBe('复制标题链接：缓存与更新')
    expect(button.attributes('disabled')).toBeUndefined()
    // happy-dom 不合成 Enter/Space 的原生点击；此处核验原生按钮语义与实际焦点，按键激活留给浏览器验收。
    const element = button.element as HTMLButtonElement
    expect(element.tabIndex).toBe(0)
    element.focus()
    expect(document.activeElement).toBe(button.element)
    await button.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledExactlyOnceWith(
      `${window.location.origin}/articles/anchor-example?from=archive&view=full#heading-3`,
    )
    expect(window.location.href).toBe(original)
    expect(button.attributes('aria-label')).toBe('已复制标题链接：缓存与更新')
    expect(button.attributes('aria-busy')).toBeUndefined()
    expect(success).toHaveBeenCalledExactlyOnceWith('标题链接已复制')
    expect(warning).not.toHaveBeenCalled()
  })

  it('无旧锚点时追加新锚点，并在每次点击时读取当前地址', async () => {
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-2', headingText: '' },
    })
    const button = wrapper.get('button.heading-anchor')
    expect(button.attributes('aria-label')).toBe('复制标题链接：heading-2')
    setArticleUrl('/articles/first?tag=Vue%203')
    await button.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenLastCalledWith(`${window.location.origin}/articles/first?tag=Vue%203#heading-2`)
    setArticleUrl('/articles/second?theme=dock#old')
    await button.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenLastCalledWith(`${window.location.origin}/articles/second?theme=dock#heading-2`)
  })

  it.each(['拒绝访问', '接口缺失'] as const)('%s 时提示失败并允许重试，不留下成功或忙碌状态', async (scenario) => {
    if (scenario === '拒绝访问') write.mockRejectedValueOnce(new Error('denied'))
    else Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-1', headingText: '章节' },
    })
    const button = wrapper.get('button.heading-anchor')
    await button.trigger('click')
    await flushPromises()
    expect(warning).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('复制失败'))
    expect(success).not.toHaveBeenCalled()
    expect(button.attributes('aria-label')).toBe('复制标题链接：章节')
    expect(button.attributes('aria-busy')).toBeUndefined()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
    await button.trigger('click')
    await flushPromises()
    expect(success).toHaveBeenCalledExactlyOnceWith('标题链接已复制')
    expect(button.attributes('aria-busy')).toBeUndefined()
  })

  it('复制未完成时标明忙碌并合并重复点击，完成后可以再次复制', async () => {
    const pending = deferred<undefined>()
    write.mockReturnValueOnce(pending.promise)
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-1', headingText: '章节' },
    })
    const button = wrapper.get('button.heading-anchor')
    await button.trigger('click')
    await button.trigger('click')
    expect(write).toHaveBeenCalledTimes(1)
    expect(button.attributes('aria-busy')).toBe('true')
    expect(success).not.toHaveBeenCalled()
    pending.resolve(undefined)
    await flushPromises()
    expect(button.attributes('aria-busy')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledTimes(2)
    expect(success).toHaveBeenCalledTimes(2)
  })

  it('成功状态在两秒后恢复，卸载时移除尚未执行的恢复计时器', async () => {
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-1', headingText: '章节' },
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const button = wrapper.get('button.heading-anchor')
    await button.trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1999)
    expect(button.attributes('aria-label')).toBe('已复制标题链接：章节')
    await vi.advanceTimersByTimeAsync(1)
    expect(button.attributes('aria-label')).toBe('复制标题链接：章节')
    await button.trigger('click')
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['成功', '失败'] as const)('组件卸载后迟到的%s 不再提示或创建恢复计时器', async (result) => {
    const pending = deferred<undefined>()
    write.mockReturnValueOnce(pending.promise)
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-1', headingText: '章节' },
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await wrapper.get('button.heading-anchor').trigger('click')
    wrapper.unmount()
    if (result === '成功') pending.resolve(undefined)
    else pending.reject(new Error('denied'))
    await flushPromises()
    expect(success).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('真实 CommonTooltip 由键盘焦点显示、关联读屏描述，Escape 关闭并在卸载时清理浮层', async () => {
    const wrapper = await mountSuspended(HeadingAnchorButton, {
      props: { headingId: 'heading-1', headingText: '章节' },
      attachTo: document.body,
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const button = wrapper.get('button.heading-anchor').element as HTMLButtonElement
    const matches = button.matches.bind(button)
    // 模拟浏览器对键盘焦点与可见几何的判断，提示组件和关联行为保持真实。
    vi.spyOn(button, 'matches').mockImplementation((selector) => selector === ':focus-visible' || matches(selector))
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 32, 32))
    button.focus()
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    const tooltip = document.querySelector('[role="tooltip"]')!
    expect(tooltip?.textContent).toContain('复制标题链接')
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain(tooltip.id)
    button.click()
    await flushPromises()
    expect(tooltip.textContent).toContain('已复制标题链接')
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    button.blur()
    await wrapper.get('.tooltip-trigger').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
    wrapper.unmount()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('ArticleMarkdown 标题锚点渐进增强', () => {
  it('为 h2–h6 的每个正文标题挂载唯一按钮，重复首标题保留编号但不产生按钮', async () => {
    const wrapper = await mountSuspended(ArticleMarkdown, {
      props: {
        title: '文章标题',
        content: '# 文章标题\n\n# 一\n\n## 二\n\n### 三\n\n#### 四\n\n##### 五\n\n###### 六',
      },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.find('#heading-1').exists()).toBe(false)
    const headings = wrapper.findAll('h2, h3, h4, h5, h6')
    expect(headings.map((heading) => heading.element.tagName)).toEqual(['H2', 'H3', 'H4', 'H5', 'H6', 'H6'])
    expect(document.querySelectorAll('button.heading-anchor')).toHaveLength(6)
    for (const [index, heading] of headings.entries()) {
      expect(heading.attributes('id')).toBe(`heading-${index + 2}`)
      const label = heading.get(`#heading-${index + 2}-text`)
      expect(heading.attributes('aria-labelledby')).toBe(label.attributes('id'))
      expect(label.find('button').exists()).toBe(false)
      expect(heading.findAll('.article-heading__anchor button.heading-anchor')).toHaveLength(1)
      const button = heading.get('button.heading-anchor')
      expect(button.attributes('aria-label')).toBe(`复制标题链接：${label.text()}`)
      await button.trigger('click')
      await flushPromises()
      expect(write).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0]}#heading-${index + 2}`)
    }
    wrapper.unmount()
    expect(document.querySelectorAll('button.heading-anchor')).toHaveLength(0)
  })

  it('内容替换后按钮属于新标题，旧复制结果不会污染新按钮或弹出提示', async () => {
    const pending = deferred<undefined>()
    write.mockReturnValueOnce(pending.promise)
    const wrapper = await mountSuspended(ArticleMarkdown, {
      props: { content: '## 旧标题\n\n### 将删除的标题' },
      attachTo: document.body,
    })
    await flushPromises()
    const oldButton = wrapper.get('#heading-1 button.heading-anchor').element as HTMLButtonElement
    oldButton.click()
    await flushPromises()
    expect(oldButton.getAttribute('aria-busy')).toBe('true')
    await wrapper.setProps({ content: '## 新的 **重点** 与 `接口`' })
    await flushPromises()
    expect(oldButton.isConnected).toBe(false)
    expect(document.querySelectorAll('button.heading-anchor')).toHaveLength(1)
    const currentButton = wrapper.get('#heading-1 button.heading-anchor')
    expect(currentButton.attributes('aria-label')).toBe('复制标题链接：新的 重点 与 接口')
    pending.resolve(undefined)
    await flushPromises()
    expect(success).not.toHaveBeenCalled()
    expect(currentButton.attributes('aria-label')).toBe('复制标题链接：新的 重点 与 接口')
    await currentButton.trigger('click')
    await flushPromises()
    expect(success).toHaveBeenCalledExactlyOnceWith('标题链接已复制')
    await wrapper.setProps({ content: '只有正文，没有标题。' })
    await flushPromises()
    expect(document.querySelectorAll('button.heading-anchor')).toHaveLength(0)
  })

  it('高亮异步完成后重新挂载当前标题，旧按钮被清理且不重复累计', async () => {
    const highlighter = deferred<CodeHighlighter>()
    vi.mocked(loadCodeHighlighter).mockReturnValueOnce(highlighter.promise)
    const wrapper = await mountSuspended(ArticleMarkdown, {
      props: { content: '## 初始标题' },
      attachTo: document.body,
    })
    await wrapper.setProps({ content: '## 高亮章节\n\n```ts\nconst answer = 42\n```\n\n### 下一节' })
    await flushPromises()
    expect(loadCodeHighlighter).toHaveBeenCalledExactlyOnceWith(['typescript'])
    expect(wrapper.find('pre.article-code__plain').exists()).toBe(true)
    const oldButtons = [...document.querySelectorAll('button.heading-anchor')]
    expect(oldButtons).toHaveLength(2)
    highlighter.resolve({ highlight: () => '<pre class="shiki" tabindex="0"><code>const answer = 42</code></pre>' })
    await flushPromises()
    expect(wrapper.find('pre.shiki').exists()).toBe(true)
    expect(oldButtons.every((button) => !button.isConnected)).toBe(true)
    const currentButtons = wrapper.findAll('button.heading-anchor')
    expect(currentButtons).toHaveLength(2)
    expect(currentButtons.map((button) => button.attributes('aria-label'))).toEqual([
      '复制标题链接：高亮章节',
      '复制标题链接：下一节',
    ])
    expect(wrapper.findAll('button.code-copy')).toHaveLength(1)
    await currentButtons[1]!.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenLastCalledWith(`${window.location.href.split('#')[0]}#heading-2`)
    wrapper.unmount()
    expect(document.querySelectorAll('button.heading-anchor, button.code-copy')).toHaveLength(0)
  })
})
