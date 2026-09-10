/** @file query.ts @description 项目 URL 查询规范化，项目进展、标签与分页共享同一状态 */
import type { ProjectProgress, ProjectQuery } from './types'
export function projectQuery(query: Record<string, unknown>): ProjectQuery {
  const page = Number(query.page)
  return {
    q: typeof query.q === 'string' ? query.q.slice(0, 200).trim() || undefined : undefined,
    progress: ['active', 'dev', 'archived'].includes(String(query.progress))
      ? (String(query.progress) as ProjectProgress)
      : undefined,
    tag: typeof query.tag === 'string' ? query.tag.slice(0, 40).trim() || undefined : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: 12,
  }
}
