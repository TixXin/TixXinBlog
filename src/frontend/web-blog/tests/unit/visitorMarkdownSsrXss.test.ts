/** @file visitorMarkdownSsrXss.test.ts @description Node SSR 环境实际执行朋友圈评论 Markdown 与服务端 DOMPurify。 */
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import cases from '../../../../../tests/fixtures/visitor-text-xss.json'
import { renderMomentMarkdown } from '../../app/composables/useMomentMarkdown'
import { expectSafeVisitorDom } from '../helpers/visitorTextXss'

describe('朋友圈评论服务端 Markdown 净化', () => {
  it.each([...cases.attacks, cases.normal])('$name：Node 渲染输出也不产生执行入口', ({ input }) => {
    expect(typeof window).toBe('undefined')
    const html = renderMomentMarkdown(input, { inline: true, mentions: true })
    // 仅在渲染完成后解析输出，不注入全局 window，保证净化器走真实的服务端实现。
    const parser = new Window({ settings: { enableJavaScriptEvaluation: false } })
    try {
      parser.document.body.innerHTML = html
      expectSafeVisitorDom(parser.document.body as unknown as HTMLElement)
    } finally {
      parser.close()
    }
  })
})
