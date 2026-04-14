/**
 * @file mock.ts
 * @description 文章归档模块 mock 数据
 * @author TixXin
 * @since 2025-03-17
 */

import type { ArchiveStat, ArchiveYear, CategoryDistribution } from './types'
import { mockPosts } from '~/features/post/mock'

// 按 folder（中文分类）映射到统一色板，未匹配走兜底
const FOLDER_COLOR_MAP: Record<string, string> = {
  前端开发: 'sky',
  后端技术: 'emerald',
  随笔日记: 'rose',
  DevOps: 'blue',
  工作复盘: 'amber',
}

// 由 mockPosts 派生归档年份分组，确保归档与文章列表数据完全一致
export const derivedArchiveYears: ArchiveYear[] = (() => {
  const grouped = new Map<number, typeof mockPosts>()
  for (const post of mockPosts) {
    const year = new Date(post.date).getFullYear()
    if (!grouped.has(year)) grouped.set(year, [])
    grouped.get(year)!.push(post)
  }
  return Array.from(grouped.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, posts]) => ({
      year,
      shortYear: String(year).slice(-2),
      count: posts.length,
      posts: posts
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((p) => ({
          date: p.date,
          title: p.title,
          category: p.folder,
          categoryColor: FOLDER_COLOR_MAP[p.folder] ?? 'slate',
          href: `/articles/${p.id}`,
        })),
    }))
})()

// 对外导出的归档年份用派生版本，确保 2025/2026 的文章也能进入归档
export const mockArchiveYears: ArchiveYear[] = derivedArchiveYears

// 文章/分类/标签数量都由 mockPosts 派生，与首页统计保持一致
const folderSet = new Set<string>(mockPosts.map((p) => p.folder))
const tagSet = new Set<string>(mockPosts.flatMap((p) => p.tags.map((t) => t.label)))

export const mockArchiveStats: ArchiveStat[] = [
  { label: '文章', value: String(mockPosts.length) },
  { label: '分类', value: String(folderSet.size) },
  { label: '标签', value: String(tagSet.size) },
]

// 分类分布由 mockPosts.folder 累加，并按文章数降序，仅展示前 4 个
export const mockCategoryDistribution: CategoryDistribution[] = (() => {
  const counts = new Map<string, number>()
  for (const post of mockPosts) {
    counts.set(post.folder, (counts.get(post.folder) ?? 0) + 1)
  }
  const total = mockPosts.length || 1
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
    }))
})()

