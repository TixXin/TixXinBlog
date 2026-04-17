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

// 单实例复用，避免列表中每条闪念重建 MarkdownIt 实例
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
}).use(taskLists, { enabled: false, label: false })

// 外链统一加 target=_blank + noopener
const defaultLinkRender =
  md.renderer.rules.link_open ??
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (!token) return defaultLinkRender(tokens, idx, options, env, self)
  const href = token.attrGet('href') ?? ''
  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkRender(tokens, idx, options, env, self)
}

/**
 * 将闪念内容 Markdown 转为安全 HTML。
 * - 完整 CommonMark（段落/标题/列表/引用/代码/链接）
 * - GFM 待办清单（- [x] / - [ ] 渲染为 disabled checkbox）
 * - linkify 自动识别裸链为 <a>
 * - 输出经 DOMPurify 净化，防止 XSS
 */
export function renderFlashMarkdown(raw: string): string {
  if (!raw) return ''
  const html = md.render(raw)
  return DOMPurify.sanitize(html, {
    // 允许外链属性 + 任务清单 checkbox 的 type/checked/disabled
    ADD_ATTR: ['target', 'rel', 'type', 'checked', 'disabled'],
  })
}
