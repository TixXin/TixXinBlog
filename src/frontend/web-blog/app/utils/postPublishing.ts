/**
 * @file postPublishing.ts
 * @description 文章发布摘要与阅读时间估算，供编辑器明确展示并由用户采用。
 */
export function suggestedReadTime(content: string): number {
  const chinese = content.match(/\p{Script=Han}/gu)?.length ?? 0
  const words = content.match(/[a-zA-Z0-9]+/g)?.length ?? 0
  return Math.max(1, Math.min(300, Math.ceil(chinese / 350 + words / 220)))
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
