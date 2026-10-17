/**
 * @file CodeBlock.test.ts
 * @description 代码块组件回归：共用精简高亮器输出双主题变量、未知语言文本兜底、语言标签与复制按钮；
 *              文章 Markdown 组件挂载复制按钮并能打开正文图片灯箱
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import CodeBlock from '../../app/components/common/CodeBlock.vue'
import ArticleMarkdown from '../../app/components/article/Markdown.vue'

const warning = vi.fn()
mockNuxtImport('useToast', () => () => ({ success: () => {}, error: () => {}, warning }))

const write = vi.fn<(text: string) => Promise<void>>()
let clipboard: PropertyDescriptor | undefined
beforeEach(() => {
  write.mockReset().mockResolvedValue()
  clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
})
afterEach(() => {
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  document.body.innerHTML = ''
})

describe('CodeBlock', () => {
  it('已注册语言输出 Shiki 双主题变量，显示语言标签并可复制原始代码', async () => {
    const code = 'const total: number = 1'
    const wrapper = await mountSuspended(CodeBlock, { props: { code, language: 'ts' } })
    expect(wrapper.get('.article-content__code-lang').text()).toBe('TypeScript')
    const pre = wrapper.get('pre.shiki')
    expect(pre.get('code').text()).toBe(code)
    expect(pre.find('span[style*="--shiki-dark"]').exists()).toBe(true)
    const button = wrapper.get('button[aria-label="复制代码"]')
    expect(button.attributes('type')).toBe('button')
    await button.trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledWith(code)
    expect(wrapper.get('button.code-copy').attributes('aria-label')).toBe('已复制代码')
    expect(wrapper.get('[role="status"]').text()).toBe('代码已复制到剪贴板')
    wrapper.unmount()
  })

  it('未知语言以文本节点兜底，不解析其中的 HTML', async () => {
    const code = '<img src=x onerror="alert(1)">'
    const wrapper = await mountSuspended(CodeBlock, { props: { code, language: 'not-a-real-language' } })
    expect(wrapper.find('.shiki').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('pre code').text()).toBe(code)
    expect(wrapper.get('.article-content__code-lang').text()).toBe('not-a-real-language')
    wrapper.unmount()
  })

  it('剪贴板失败时提示手动复制', async () => {
    write.mockRejectedValueOnce(new Error('denied'))
    const wrapper = await mountSuspended(CodeBlock, { props: { code: 'x', language: 'text' } })
    await wrapper.get('button.code-copy').trigger('click')
    await flushPromises()
    expect(warning).toHaveBeenCalledWith('复制失败，请手动选择代码复制。')
    wrapper.unmount()
  })
})

describe('ArticleMarkdown 渐进增强', () => {
  it('客户端为每个代码块挂载复制按钮，复制内容与正文一致', async () => {
    const wrapper = await mountSuspended(ArticleMarkdown, {
      props: { content: '```ts\nconst a = 1\n```\n\n```astro\n<div />\n```' },
      attachTo: document.body,
    })
    await flushPromises()
    const blocks = wrapper.findAll('.article-code')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.find('pre.shiki').exists()).toBe(true)
    expect(blocks[1]!.find('pre.article-code__plain').exists()).toBe(true)
    const buttons = document.querySelectorAll<HTMLButtonElement>('.article-code__actions button.code-copy')
    expect(buttons).toHaveLength(2)
    buttons[1]!.click()
    await flushPromises()
    expect(write).toHaveBeenCalledWith('<div />')
    wrapper.unmount()
  })

  it('点击正文图片打开灯箱，可在同一篇文章内切换并关闭', async () => {
    const wrapper = await mountSuspended(ArticleMarkdown, {
      props: { content: '![第一张](/a.webp)\n\n文字\n\n![](/b.webp)' },
      attachTo: document.body,
    })
    const triggers = document.querySelectorAll<HTMLButtonElement>('[data-article-image]')
    expect(triggers).toHaveLength(2)
    triggers[0]!.click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull())
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.querySelector('figcaption')?.textContent).toContain('第一张')
    expect(dialog.querySelector('figcaption')?.textContent).toContain('1 / 2')
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain('/b.webp')
    expect(dialog.querySelector('figcaption')?.textContent).toContain('图片未提供说明')
    dialog.querySelector<HTMLButtonElement>('button[aria-label="关闭大图"]')!.click()
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })
})
