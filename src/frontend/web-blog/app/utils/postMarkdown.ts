/** @file postMarkdown.ts @description 文章 Markdown 纯解析入口，供章节导航与字数统计共享同一份解析结果。 */
import MarkdownIt from 'markdown-it'

const parser = new MarkdownIt({ html: false, linkify: true })

export function parsePostMarkdown(raw: string) {
  return parser.parse(raw, {})
}
