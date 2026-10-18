/**
 * @file splitHighlight.ts
 * @description 按关键词把文本切成命中与未命中片段（忽略大小写），供模板以文本节点渲染高亮
 * @author TixXin
 * @since 2026-10-18
 */

export interface HighlightPart {
  text: string
  match: boolean
}

export function splitHighlight(text: string, keyword?: string | null): HighlightPart[] {
  const needle = keyword?.trim()
  if (!needle) return [{ text, match: false }]
  // 在原文中匹配，避免 Unicode 转小写改变长度后导致切片错位；关键词按字面量处理。
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const parts: HighlightPart[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false })
    parts.push({ text: match[0], match: true })
    cursor = index + match[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts.length ? parts : [{ text, match: false }]
}
