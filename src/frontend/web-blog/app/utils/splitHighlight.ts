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
  const needle = keyword?.trim().toLocaleLowerCase()
  if (!needle) return [{ text, match: false }]
  const haystack = text.toLocaleLowerCase()
  const parts: HighlightPart[] = []
  let cursor = 0
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, cursor)) {
    if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false })
    parts.push({ text: text.slice(index, index + needle.length), match: true })
    cursor = index + needle.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts.length ? parts : [{ text, match: false }]
}
