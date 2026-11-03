/**
 * @file contentMatch.ts
 * @description 文章正文命中窗口：在原始 Markdown 中定位关键词，截取首个命中位置附近的原文。
 * 规则与后端 modules/post/post-search-match.ts 一致；静态站在浏览器内按同一规则截取，两种部署形态显示相同的片段。
 * @author TixXin
 * @since 2026-11-03
 */

/** 命中位置之前保留的字符数 */
export const CONTENT_MATCH_BEFORE = 80
/** 命中结束之后保留的字符数 */
export const CONTENT_MATCH_AFTER = 160

/** 不区分大小写的首个命中位置；小写后长度变化的少见字符逐位比较，保证下标对应原文 */
export function indexOfIgnoreCase(text: string, keyword: string): number {
  const needle = keyword.toLowerCase()
  const lower = text.toLowerCase()
  if (lower.length === text.length) return lower.indexOf(needle)
  for (let index = 0; index + keyword.length <= text.length; index++)
    if (text.slice(index, index + keyword.length).toLowerCase() === needle) return index
  return -1
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

export interface MatchRange {
  /** 命中起点 */
  index: number
  /** 命中长度 */
  length: number
  /** 命中之前保留的字符数 */
  before: number
  /** 命中之后保留的字符数 */
  after: number
}

/** 按命中位置截取窗口，起止边界不拆开代理对 */
export function sliceAround(text: string, range: MatchRange) {
  let start = Math.max(0, range.index - range.before)
  let end = Math.min(text.length, range.index + range.length + range.after)
  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) start -= 1
  if (end < text.length && isLowSurrogate(text.charCodeAt(end))) end += 1
  return { start, end, text: text.slice(start, end) }
}

/** 正文命中窗口；关键词为空或正文未命中时返回 undefined。关键词按原样匹配，与后端 ilike 条件一致。 */
export function contentMatchWindow(contentRaw: string | null | undefined, keyword: string): string | undefined {
  if (!contentRaw || !keyword.trim()) return undefined
  const index = indexOfIgnoreCase(contentRaw, keyword)
  if (index < 0) return undefined
  return sliceAround(contentRaw, {
    index,
    length: keyword.length,
    before: CONTENT_MATCH_BEFORE,
    after: CONTENT_MATCH_AFTER,
  }).text
}
