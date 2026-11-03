/**
 * @file excerpt.ts
 * @description 搜索结果的命中摘录：把正文（或后端返回的命中窗口）去掉 Markdown 语法后，截取关键词前后一段并补省略号。
 * 窗口可能从链接、强调等语法中间截断，规则对残缺语法保持容忍；去掉语法后找不到关键词时返回 null，由调用方改用摘要。
 * @author TixXin
 * @since 2026-11-03
 */
import { indexOfIgnoreCase, sliceAround } from './contentMatch'

/** 关键词之前保留的字符数 */
export const EXCERPT_BEFORE = 30
/** 关键词之后保留的字符数 */
export const EXCERPT_AFTER = 70

/** 去掉 Markdown 语法：图片与链接地址丢弃、链接文字保留，代码围栏、标题、引用、列表与强调符号去掉 */
export function markdownToPlain(markdown: string): string {
  return (
    markdown
      .replace(/```[^\n]*/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 窗口起点落在链接地址中间时留下的残段，如 `example.com/a)`、`](https://...)`
      .replace(/\]\([^)\s]*\)/g, '')
      .replace(/^[^\s([]*\)/, '')
      .replace(/<\/?[a-z][^>]*>/gi, ' ')
      .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/gm, '')
      .replace(/(\*\*|__|~~|`)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** 命中摘录；来源为空、关键词为空或去掉语法后找不到关键词时返回 null */
export function buildExcerpt(source: string | null | undefined, keyword: string): string | null {
  const term = keyword.trim()
  if (!source || !term) return null
  const plain = markdownToPlain(source)
  const index = indexOfIgnoreCase(plain, term)
  if (index < 0) return null
  const window = sliceAround(plain, { index, length: term.length, before: EXCERPT_BEFORE, after: EXCERPT_AFTER })
  return (window.start > 0 ? '…' : '') + window.text.trim() + (window.end < plain.length ? '…' : '')
}
