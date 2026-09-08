/**
 * @file post-markdown.ts
 * @description Markdown 原文解析：保存结构化正文和与前端一致的目录锚点
 */
import MarkdownIt from 'markdown-it'
import type { PostContentSection } from '../../entities/post.entity'

const parser = new MarkdownIt({ html: false, linkify: true })

export function parsePostMarkdown(raw: string): PostContentSection[] {
  const tokens = parser.parse(raw, {})
  const sections: PostContentSection[] = []
  let headingIndex = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (token.type === 'heading_open') {
      sections.push({
        type: 'heading',
        level: Number(token.tag.slice(1)),
        text: tokens[index + 1]?.content ?? '',
        id: `heading-${++headingIndex}`,
      })
    } else if (token.type === 'fence' || token.type === 'code_block') {
      sections.push({ type: 'code', text: token.content, language: token.info.trim().split(/\s+/)[0] || 'text' })
    } else if (token.type === 'paragraph_open' && tokens[index + 1]?.type === 'inline') {
      sections.push({ type: 'paragraph', text: tokens[index + 1]!.content })
    }
  }
  return sections
}
