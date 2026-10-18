/**
 * @file articleMarkdown.ts
 * @description 文章 Markdown 安全渲染，目录 ID 与后端解析顺序一致；正文开头与标题相同的一级标题不再重复展示；
 *              页面已有文章标题 h1，正文标题整体降一级输出（# → h2 … h6 封顶），目录层级仍按 Markdown 原级别；
 *              代码块输出带语言标签与复制按钮挂载位的静态结构，高亮器由调用方预先加载后同步传入，
 *              服务端与客户端水合得到同一份 HTML；正文图片懒加载（受管媒体附带宽度变体 srcset）并包裹为放大触发按钮
 */
import MarkdownIt from 'markdown-it'
import DOMPurify from 'isomorphic-dompurify'
import type { TocItem } from '~/features/post/types'
import { codeLanguageLabel, resolveCodeLanguage, type CodeHighlighter } from '~/utils/highlightCode'
import { managedImageSrcset } from '~/utils/managedImage'
import { markdownLinks, type MarkdownLinkEnvironment, type MarkdownLinkOptions } from '~/utils/markdownLinks'

interface RenderEnvironment extends MarkdownLinkEnvironment {
  headingIndex: number
  title?: string
  highlighter?: CodeHighlighter | null
}
export interface ArticleMarkdownOptions extends MarkdownLinkOptions {
  /** 已加载所需语言的高亮器；缺省时代码块按纯文本输出 */
  highlighter?: CodeHighlighter | null
}
const parser = new MarkdownIt({ html: false, linkify: true }).use(markdownLinks)
type Token = ReturnType<MarkdownIt['parse']>[number]
const escapeHtml = parser.utils.escapeHtml
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

/**
 * 代码块：外层容器 + 标题栏（语言标签、复制按钮挂载位）+ 代码。
 * 复制按钮由客户端挂载到 .article-code__actions，SSR 只输出静态结构；未知语言回退纯文本 pre。
 */
parser.renderer.rules.fence = (tokens, index, _options, environment: RenderEnvironment) => {
  const token = tokens[index]!
  const language = token.info.trim().split(/\s+/)[0] ?? ''
  // 去掉围栏内容末尾换行，避免高亮输出空行、复制结果多一行
  const code = token.content.replace(/\r?\n$/, '')
  const resolved = resolveCodeLanguage(language)
  const highlighted = resolved ? environment.highlighter?.highlight(code, resolved) : null
  const body = highlighted ?? `<pre class="article-code__plain" tabindex="0"><code>${escapeHtml(code)}</code></pre>`
  const label = codeLanguageLabel(language) || '代码'
  return (
    `<div class="article-code" data-language="${escapeHtml(resolved ?? 'text')}">` +
    `<div class="article-code__header"><span class="article-code__lang">${escapeHtml(label)}</span>` +
    `<span class="article-code__actions"></span></div>${body}</div>\n`
  )
}

/** 图片位于链接内时不再包裹按钮，避免交互元素嵌套 */
function insideLink(tokens: Token[], index: number) {
  let depth = 0
  for (let cursor = 0; cursor < index; cursor++) {
    if (tokens[cursor]?.type === 'link_open') depth++
    else if (tokens[cursor]?.type === 'link_close') depth--
  }
  return depth > 0
}
const defaultImage = parser.renderer.rules.image!
parser.renderer.rules.image = (tokens, index, options, environment, renderer) => {
  const token = tokens[index]!
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  // 受管媒体提供白名单宽度变体；正文栏最宽约 800px，窄屏按视口宽度选择
  const srcset = managedImageSrcset(token.attrGet('src'))
  if (srcset) {
    token.attrSet('srcset', srcset)
    token.attrSet('sizes', '(max-width: 768px) 100vw, 800px')
  }
  const image = defaultImage(tokens, index, options, environment, renderer)
  if (insideLink(tokens, index)) return image
  const alt = normalize(renderer.renderInlineAsText(token.children ?? [], options, environment))
  const label = alt ? `查看大图：${alt}` : '查看大图'
  return `<button type="button" class="article-image" data-article-image aria-label="${escapeHtml(label)}">${image}</button>`
}

/** style 只放行 Shiki 主题变量与表格对齐，其余内联样式一律剥离 */
const allowedStyle =
  /^\s*(?:(?:--shiki-[a-z-]+\s*:\s*[#\w.%-]+|text-align\s*:\s*(?:left|right|center))\s*(?:;\s*|$))+$/i
function filterStyle(_node: unknown, data: { attrName: string; attrValue: string; keepAttr: boolean }) {
  if (data.attrName === 'style' && !allowedStyle.test(data.attrValue)) data.keepAttr = false
}

export function renderArticleMarkdown(raw: string, title?: string, options: ArticleMarkdownOptions = {}): string {
  const html = parser.render(raw, {
    headingIndex: 0,
    title,
    highlighter: options.highlighter,
    markdownLinks: options,
  } satisfies RenderEnvironment)
  DOMPurify.addHook('uponSanitizeAttribute', filterStyle)
  try {
    return DOMPurify.sanitize(html, { ADD_ATTR: ['loading', 'decoding', 'target', 'rel'] })
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', filterStyle)
  }
}
/** 目录与正文保持一致：第一项是与标题相同的一级标题时去掉 */
export function articleTocItems(items: TocItem[], title: string): TocItem[] {
  const [first, ...rest] = items
  return first && first.level === 1 && normalize(first.text) === normalize(title) ? rest : items
}
