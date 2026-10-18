/** @file archive.ts @description 文章归档的年月 URL、分享元信息与单页时间线映射，年份数量保持全局语义 */
import type { PostArchivePage, PostArchiveQuery } from './types'
import type { ArchiveYear } from '~/features/article/types'
import { articlePath } from '~/utils/articlePath'

export function postArchiveQuery(query: Record<string, unknown>): PostArchiveQuery {
  const page = Number(query.page)
  const year = typeof query.year === 'string' && /^\d{1,4}$/.test(query.year) ? Number(query.year) : 0
  const month = typeof query.month === 'string' && /^\d{1,2}$/.test(query.month) ? Number(query.month) : 0
  return {
    year: year >= 1 && year <= 9999 ? year : undefined,
    ...(year >= 1 && year <= 9999 && month >= 1 && month <= 12 ? { month } : {}),
    page: Number.isInteger(page) && page >= 1 && page <= 1000000 ? page : 1,
    pageSize: 50,
  }
}

/** 页面和失败保留提示共用时间段名称，避免把上次成功的月份标成当前筛选。 */
export function postArchivePeriod(query: Pick<PostArchiveQuery, 'year' | 'month'>): string {
  return query.year ? `${query.year} 年${query.month ? ` ${query.month} 月` : ''}` : '全部年份'
}

export function postArchiveSeo(query: PostArchiveQuery) {
  const period = postArchivePeriod(query)
  const params = new URLSearchParams()
  if (query.year) params.set('year', String(query.year))
  if (query.year && query.month) params.set('month', String(query.month))
  if (query.page > 1) params.set('page', String(query.page))
  const search = params.toString()
  return {
    title: `${query.year ? `${period}文章归档` : '归档'}${query.page > 1 ? ` · 第 ${query.page} 页` : ''}`,
    description: query.year
      ? `按时间线回顾 ${period}发布的文章，浏览技术沉淀与生活随笔`
      : '按时间线回顾全部文章，浏览历年技术沉淀与生活随笔',
    canonical: `/archive${search ? `?${search}` : ''}`,
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
