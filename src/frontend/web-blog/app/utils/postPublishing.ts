/**
 * @file postPublishing.ts
 * @description 文章发布摘要、正文字数与阅读时间估算、正文图片替代文本检查，供编辑器实时展示并由用户确认。
 */
import MarkdownIt from 'markdown-it'
import type { PostImageAltWarning } from '~/features/post/types'
import { parsePostMarkdown } from '~/utils/postMarkdown'

const parser = new MarkdownIt({ html: false, linkify: true })
type Token = ReturnType<MarkdownIt['parse']>[number]
const imageOffsets = new WeakMap<Token, number>()

// 图片 token 默认没有源码位置；仅扩展此检查器的状态，在解析器生成图片时记录起点。
parser.inline.State = class extends parser.inline.State {
  override push(type: string, tag: string, nesting: -1 | 0 | 1) {
    const token = super.push(type, tag, nesting)
    if (type === 'image') imageOffsets.set(token, this.pos)
    return token
  }
}

/** 与正文渲染使用相同的 Markdown 语义，代码、转义语法与未解析引用不作为图片。 */
export function missingImageAltPositions(content: string): PostImageAltWarning[] {
  const warnings: PostImageAltWarning[] = []
  let imageNumber = 0
  let tableLine = 0
  for (const token of parser.parse(content, {})) {
    // 表格单元格的 inline token 没有 map，沿用所属表格行的源码映射。
    if (token.type === 'tr_open') tableLine = token.map?.[0] ?? 0
    if (token.type === 'tr_close') tableLine = 0
    if (token.type !== 'inline') continue
    let line = (token.map?.[0] ?? tableLine) + 1
    let cursor = 0
    for (const child of token.children ?? []) {
      if (child.type !== 'image') continue
      imageNumber++
      const offset = imageOffsets.get(child) ?? cursor
      line += token.content.slice(cursor, offset).match(/\n/g)?.length ?? 0
      cursor = offset
      const alt = parser.renderer.renderInlineAsText(child.children ?? [], parser.options, {})
      if (!alt.trim()) warnings.push({ line, imageNumber })
    }
  }
  return warnings
}

/** 只统计可阅读的行内正文；代码块、图片与链接目标不参与，行内代码保留。 */
export function postReadingStats(content: string, tokens = parsePostMarkdown(content)) {
  const text = tokens
    .filter((token) => token.type === 'inline')
    .map((token) =>
      (token.children ?? [])
        .map((child) => {
          if (child.type === 'text' || child.type === 'code_inline') return child.content
          // 图片和换行是分隔边界；强调与链接标记不拆开同一个词。
          return ['image', 'softbreak', 'hardbreak'].includes(child.type) ? ' ' : ''
        })
        .join(''),
    )
    .join('\n')
  const chineseCharacters = text.match(/\p{Script=Han}/gu)?.length ?? 0
  // 连续西文字母或数字记一词，保留重音字符、词内撇号和连字符。
  const words =
    text.match(
      /[\p{Script=Latin}\p{N}][\p{Script=Latin}\p{M}\p{N}]*(?:['’-][\p{Script=Latin}\p{N}][\p{Script=Latin}\p{M}\p{N}]*)*/gu,
    )?.length ?? 0
  return {
    chineseCharacters,
    words,
    wordCount: chineseCharacters + words,
    minutes: Math.max(1, Math.min(300, Math.ceil(chineseCharacters / 350 + words / 220))),
  }
}

export function suggestedReadTime(content: string): number {
  return postReadingStats(content).minutes
}
export function suggestedSummary(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}
