/**
 * @file flashMarkdown.ts
 * @description 闪念正文 Markdown 渲染，基于 markdown-it + isomorphic-dompurify
 *              覆盖完整 CommonMark + GFM 待办清单 + linkify，输出经 DOMPurify 净化
 * @author TixXin
 * @since 2026-04-12
 */

import MarkdownIt from 'markdown-it'
// @ts-expect-error -- markdown-it-task-lists 未发布 .d.ts 类型声明
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'isomorphic-dompurify'
import { markdownTaskLabels } from '~/utils/markdownTaskLabels'
import { markdownLinks, type MarkdownLinkEnvironment, type MarkdownLinkOptions } from '~/utils/markdownLinks'

// 单实例复用，避免列表中每条闪念重建 MarkdownIt 实例
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
})
  .use(taskLists, { enabled: false, label: false })
  .use(markdownTaskLabels)
  .use(markdownLinks)
// linkify-it 6 默认关闭无协议链接识别；保留 www.example.com、example.com 等裸域名自动链接，避免已发布内容丢失链接
md.linkify.set({ fuzzyLink: true })

/**
 * 将闪念内容 Markdown 转为安全 HTML。
 * - 完整 CommonMark（段落/标题/列表/引用/代码/链接）
 * - GFM 待办清单（- [x] / - [ ] 渲染为 disabled checkbox）
 * - linkify 自动识别裸链为 <a>
 * - 输出经 DOMPurify 净化，防止 XSS
 */
export function renderFlashMarkdown(raw: string, options: MarkdownLinkOptions = {}): string {
  if (!raw) return ''
  const html = md.render(raw, { markdownLinks: options } satisfies MarkdownLinkEnvironment)
  return DOMPurify.sanitize(html, {
    // 允许外链属性 + 任务清单 checkbox 的 type/checked/disabled
    ADD_ATTR: ['target', 'rel', 'type', 'checked', 'disabled', 'aria-label'],
  })
}
