/**
 * @file useMomentMarkdown.ts
 * @description 朋友圈正文/评论 Markdown 渲染，含 DOMPurify 防 XSS
 * @author TixXin
 * @since 2026-04-17
 */

import MarkdownIt from 'markdown-it'
// markdown-it-task-lists 无 TS 类型声明，运行时是合法 markdown-it 插件
// @ts-expect-error -- markdown-it-task-lists 未发布 .d.ts 类型声明
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'isomorphic-dompurify'
import { markdownTaskLabels } from '~/utils/markdownTaskLabels'
import { markdownLinks, type MarkdownLinkEnvironment, type MarkdownLinkOptions } from '~/utils/markdownLinks'

// 单实例复用，避免列表中每条动态重建 MarkdownIt 实例
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

interface MomentMarkdownEnvironment extends MarkdownLinkEnvironment {
  mentions: boolean
}

// 只在普通文本 token 中高亮提及，避免对 HTML 做正则替换时破坏 href、title 或邮箱链接。
md.core.ruler.push('moment-mentions', (state) => {
  if (!(state.env as MomentMarkdownEnvironment).mentions) return
  for (const block of state.tokens) {
    if (!block.children) continue
    let linkDepth = 0
    const children: typeof block.children = []
    for (const token of block.children) {
      if (token.type === 'link_open') linkDepth++
      if (token.type === 'link_close') linkDepth--
      if (token.type === 'text' && linkDepth === 0 && /@[^\s<@]+/.test(token.content)) {
        const mention = new state.Token('html_inline', '', 0)
        mention.content = md.utils.escapeHtml(token.content).replace(/@([^\s<@]+)/g, '<span class="mention">@$1</span>')
        children.push(mention)
      } else children.push(token)
    }
    block.children = children
  }
})

export interface MomentMarkdownOptions extends MarkdownLinkOptions {
  /** 是否使用 inline 渲染（不产生 <p> 包裹，用于评论等短文本） */
  inline?: boolean
  /** 普通文本中的 @提及 转为高亮 span（仅 inline 模式使用） */
  mentions?: boolean
}

/**
 * 渲染 Markdown 为安全 HTML。
 * - 正文：段落/标题/列表/粗体/斜体/链接/代码均支持
 * - 评论：建议 inline:true，避免短文本被 <p> 包裹撑高行距
 */
export function renderMomentMarkdown(text: string, options: MomentMarkdownOptions = {}): string {
  if (!text) return ''

  const environment = {
    markdownLinks: options,
    mentions: Boolean(options.inline && options.mentions),
  } satisfies MomentMarkdownEnvironment
  const html = options.inline ? md.renderInline(text, environment) : md.render(text, environment)

  return DOMPurify.sanitize(html, {
    // 允许外链属性 + 任务清单 checkbox 的 type/checked/disabled
    ADD_ATTR: ['target', 'rel', 'type', 'checked', 'disabled', 'aria-label'],
  })
}

export function useMomentMarkdown() {
  return { renderMomentMarkdown }
}
