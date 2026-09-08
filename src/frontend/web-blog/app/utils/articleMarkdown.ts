/**
 * @file articleMarkdown.ts
 * @description 文章 Markdown 安全渲染，目录 ID 与后端解析顺序一致
 */
import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'

const parser = new MarkdownIt({ html: false, linkify: true })
parser.renderer.rules.heading_open = (tokens, index, options, environment: { headingIndex: number }, renderer) => {
  tokens[index]?.attrSet('id', `heading-${++environment.headingIndex}`)
  return renderer.renderToken(tokens, index, options)
}

export function renderArticleMarkdown(raw: string): string {
  return DOMPurify.sanitize(parser.render(raw, { headingIndex: 0 }))
}
