/**
 * @file post-search-match.ts
 * @description 文章搜索的正文命中窗口：在原始 Markdown 中定位关键词，截取首个命中位置附近的原文供前端生成摘录。
 * 规则与前端 app/features/search/contentMatch.ts 一致，静态站在浏览器内按同一规则截取，两种部署形态显示相同的片段。
 * @author TixXin
 * @since 2026-11-03
 */

/** 命中位置之前保留的字符数 */
export const CONTENT_MATCH_BEFORE = 80
/** 命中结束之后保留的字符数 */
export const CONTENT_MATCH_AFTER = 160

/** 不区分大小写的首个命中位置；小写后长度变化的少见字符逐位比较，保证下标对应原文 */
function indexOfIgnoreCase(text: string, keyword: string): number {
  const needle = keyword.toLowerCase()
  const lower = text.toLowerCase()
  if (lower.length === text.length) return lower.indexOf(needle)
  for (let index = 0; index + keyword.length <= text.length; index++)
    if (text.slice(index, index + keyword.length).toLowerCase() === needle) return index
  return -1
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff

/** 正文命中窗口；关键词为空或正文未命中时返回 undefined。关键词按原样匹配，与 ilike 条件一致；窗口边界不拆开代理对。 */
export function contentMatchWindow(contentRaw: string | null | undefined, keyword: string): string | undefined {
  const term = keyword
  if (!contentRaw || !term.trim()) return undefined
  const index = indexOfIgnoreCase(contentRaw, term)
  if (index < 0) return undefined
  let start = Math.max(0, index - CONTENT_MATCH_BEFORE)
  let end = Math.min(contentRaw.length, index + term.length + CONTENT_MATCH_AFTER)
  if (start > 0 && isLowSurrogate(contentRaw.charCodeAt(start))) start -= 1
  if (end < contentRaw.length && isLowSurrogate(contentRaw.charCodeAt(end))) end += 1
  return contentRaw.slice(start, end)
}
