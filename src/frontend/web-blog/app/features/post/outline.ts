/** @file outline.ts @description Markdown 章节与源码位置，使用解析器行映射排除代码围栏并区分同名标题。 */
import MarkdownIt from 'markdown-it'

export interface PostHeading {
  text: string
  level: number
  line: number
  offset: number
}

const parser = new MarkdownIt({ html: false, linkify: true })

export function postHeadings(raw: string): PostHeading[] {
  const starts = [0]
  for (const match of raw.matchAll(/\r\n|\r|\n/g)) starts.push(match.index + match[0].length)
  const tokens = parser.parse(raw, {})
  return tokens.flatMap((token, index) => {
    if (token.type !== 'heading_open' || !token.map) return []
    const inline = tokens[index + 1]
    const text = (inline?.children ?? [])
      .filter((child) => ['text', 'code_inline', 'image', 'softbreak', 'hardbreak'].includes(child.type))
      .map((child) => (child.type.endsWith('break') ? ' ' : child.content))
      .join('')
      .trim()
    return [{ text, level: Number(token.tag.slice(1)), line: token.map[0] + 1, offset: starts[token.map[0]] ?? 0 }]
  })
}
