/**
 * @file articleMarkdown.ts
 * @description 文章 Markdown 安全渲染，目录 ID 与后端解析顺序一致；正文开头与标题相同的一级标题不再重复展示；
 *              页面已有文章标题 h1，正文标题整体降一级输出（# → h2 … h6 封顶），目录层级仍按 Markdown 原级别
 */
import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'
import type { TocItem } from '~/features/post/types'

interface RenderEnvironment {
  headingIndex: number
  title?: string
}
const parser = new MarkdownIt({ html: false, linkify: true })
type Token = ReturnType<MarkdownIt['parse']>[number]
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
/** 正文第一个块是与文章标题相同的一级标题时视为重复标题，页面已在头部展示 */
function isDuplicateTitle(tokens: Token[], index: number, title?: string) {
  if (!title || index !== 0 || tokens[index]?.tag !== 'h1') return false
  return normalize(tokens[index + 1]?.content ?? '') === normalize(title)
}
/** Markdown 标题级别加一，h6 封顶 */
function demotedHeadingTag(tag: string) {
  const level = Number(tag.slice(1)) || 1
  return `h${Math.min(level + 1, 6)}`
}
parser.renderer.rules.heading_open = (tokens, index, options, environment: RenderEnvironment, renderer) => {
  tokens[index]?.attrSet('id', `heading-${++environment.headingIndex}`)
  if (isDuplicateTitle(tokens, index, environment.title)) {
    // 仍占用 heading-1 编号，保证后续锚点与后端目录一致；标题文本与闭合标签一并隐藏
    tokens[index + 1]!.children = []
    tokens[index + 2]!.hidden = true
    return ''
  }
  // 正文标题降一级，保证页面只有文章标题一个 h1；开闭标签同步改写
  const tag = demotedHeadingTag(tokens[index]!.tag)
  tokens[index]!.tag = tag
  if (tokens[index + 2]?.type === 'heading_close') tokens[index + 2]!.tag = tag
  return renderer.renderToken(tokens, index, options)
}
parser.renderer.rules.heading_close = (tokens, index, options, _environment, renderer) =>
  tokens[index]?.hidden ? '' : renderer.renderToken(tokens, index, options)

export function renderArticleMarkdown(raw: string, title?: string): string {
  return DOMPurify.sanitize(parser.render(raw, { headingIndex: 0, title } satisfies RenderEnvironment))
}
/** 目录与正文保持一致：第一项是与标题相同的一级标题时去掉 */
export function articleTocItems(items: TocItem[], title: string): TocItem[] {
  const [first, ...rest] = items
  return first && first.level === 1 && normalize(first.text) === normalize(title) ? rest : items
}
