/**
 * @file flashMarkdown.test.ts
 * @description renderFlashMarkdown 单元测试：Markdown 渲染、外链处理与 XSS 净化
 * @author TixXin
 * @since 2026-07-20
 */

import { describe, it, expect } from 'vitest'
import { renderFlashMarkdown } from '../../app/utils/flashMarkdown'

describe('renderFlashMarkdown', () => {
  it('空内容返回空字符串', () => {
    expect(renderFlashMarkdown('')).toBe('')
  })

  it('渲染基础 Markdown（加粗与行内代码）', () => {
    const html = renderFlashMarkdown('这是 **重点** 和 `code`')
    expect(html).toContain('<strong>重点</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('GFM 待办清单渲染为 checkbox', () => {
    const html = renderFlashMarkdown('- [x] 已完成\n- [ ] 未完成')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('linkify 自动识别裸链并为外链加 target=_blank', () => {
    const html = renderFlashMarkdown('看看 https://example.com 这个站')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('站内相对链接不加 target=_blank', () => {
    const html = renderFlashMarkdown('[详情](/flash/abc)')
    expect(html).toContain('href="/flash/abc"')
    expect(html).not.toContain('target="_blank"')
  })

  it('脚本注入被净化，不输出可执行内容', () => {
    const html = renderFlashMarkdown('<script>alert(1)</script> 正常文字')
    expect(html).not.toContain('<script')
    expect(html).toContain('正常文字')
  })

  it('javascript: 协议链接不会渲染为可点击的 href', () => {
    // markdown-it 的 validateLink 会拒绝该链接语法，只输出纯文本
    const html = renderFlashMarkdown('[点我](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:')
  })
})
