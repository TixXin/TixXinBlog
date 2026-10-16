/** @file archive.ts @description 文章归档的 URL 归一与单页时间线映射，年份数量保持全局语义 */
import type { PostArchivePage, PostArchiveQuery } from './types'
import type { ArchiveYear } from '~/features/article/types'
import { articlePath } from '~/utils/articlePath'

export function postArchiveQuery(query: Record<string, unknown>): PostArchiveQuery {
  const page = Number(query.page)
  const year = typeof query.year === 'string' && /^\d{1,4}$/.test(query.year) ? Number(query.year) : 0
  return {
    year: year >= 1 && year <= 9999 ? year : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 1000000 ? page : 1,
    pageSize: 50,
  }
}

export function postArchiveYears(page: PostArchivePage | null): ArchiveYear[] {
  const groups = new Map<number, ArchiveYear>()
  for (const post of page?.items ?? []) {
    const year = Number(post.date.slice(0, 4))
    const group = groups.get(year) ?? {
      year,
      shortYear: String(year).slice(-2),
      count: page!.years.find((item) => item.year === year)?.count ?? 0,
      posts: [],
    }
    group.posts.push({
      title: post.title,
      date: post.date.slice(0, 10),
      category: post.folder,
      categoryColor: 'sky',
      href: articlePath(post),
    })
    groups.set(year, group)
  }
  return [...groups.values()]
}
