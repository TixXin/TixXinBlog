/**
 * @file useMomentMarkdown.ts
 * @description 朋友圈正文/评论 Markdown 渲染，含 DOMPurify 防 XSS
 * @author TixXin
 * @since 2026-04-17
 */

import MarkdownIt from 'markdown-it'
// markdown-it-task-lists 无 TS 类型声明，但运行时为合法插件
// @ts-expect-error 缺少类型声明
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'isomorphic-dompurify'

// 单实例复用，避免列表中每条动态重建 MarkdownIt 实例
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
}).use(taskLists, { enabled: false, label: false })

// 外链统一加 target=_blank + noopener（闪念里贴的 URL 大多是外部资源）
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

export interface MomentMarkdownOptions {
  /** 是否使用 inline 渲染（不产生 <p> 包裹，用于评论等短文本） */
  inline?: boolean
  /** 渲染后额外把 @提及 转为高亮 span（仅 inline 模式使用） */
  mentions?: boolean
}

/**
 * 渲染 Markdown 为安全 HTML。
 * - 正文：段落/标题/列表/粗体/斜体/链接/代码均支持
 * - 评论：建议 inline:true，避免短文本被 <p> 包裹撑高行距
 */
export function renderMomentMarkdown(text: string, options: MomentMarkdownOptions = {}): string {
  if (!text) return ''

  let html = options.inline ? md.renderInline(text) : md.render(text)

  if (options.mentions) {
    html = html.replace(/@([^\s<@]+)/g, '<span class="mention">@$1</span>')
  }

  return DOMPurify.sanitize(html, {
    // 允许外链属性 + 任务清单 checkbox 的 type/checked/disabled
    ADD_ATTR: ['target', 'rel', 'type', 'checked', 'disabled'],
  })
}

export function useMomentMarkdown() {
  return { renderMomentMarkdown }
}
