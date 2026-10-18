/**
 * @file postPublishing.ts
 * @description 文章发布摘要、正文字数与阅读时间估算，供编辑器实时展示并由用户采用。
 */
import { parsePostMarkdown } from '~/utils/postMarkdown'

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
