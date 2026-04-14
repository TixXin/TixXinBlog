/**
 * @file mock.ts
 * @description 统计模块 mock 数据，提供站点统计、标签列表和分类列表
 * @author TixXin
 * @since 2025-03-17
 */

import type { SiteStats, TagItem, CategoryItem } from './types'
import { mockPosts } from '~/features/post/mock'

// 总浏览量按 mockPosts 累加，并做万 / 千格式化展示
function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const totalViews = mockPosts.reduce((sum, p) => sum + p.views, 0)
const totalComments = mockPosts.reduce((sum, p) => sum + p.comments, 0)
const uniqueTags = new Set<string>(mockPosts.flatMap((p) => p.tags.map((t) => t.label)))

export const mockSiteStats: SiteStats = {
  articles: mockPosts.length,
  views: formatViews(totalViews),
  comments: totalComments,
  tags: uniqueTags.size,
  uptimeDays: 1888,
}

export const mockTags: TagItem[] = [
  { name: 'Vue3', count: 12, color: '#10b981' },
  { name: 'TypeScript', count: 9, color: '#3b82f6' },
  { name: 'React', count: 7, color: '#06b6d4' },
  { name: 'Tailwind', count: 6, color: '#8b5cf6' },
  { name: 'Node.js', count: 8, color: '#22c55e' },
  { name: 'UI设计', count: 5, color: '#f43f5e' },
  { name: '生活日常', count: 24, color: '#f59e0b' },
  { name: '摄影', count: 4, color: '#ec4899' },
  { name: '算法', count: 6, color: '#0ea5e9' },
  { name: 'Docker', count: 3, color: '#6366f1' },
  { name: 'CSS', count: 10, color: '#14b8a6' },
  { name: 'Git', count: 5, color: '#ef4444' },
  { name: 'Linux', count: 4, color: '#a855f7' },
  { name: '性能优化', count: 7, color: '#f97316' },
  { name: 'DevOps', count: 3, color: '#64748b' },
  { name: 'Webpack', count: 4, color: '#8b5cf6' },
  { name: 'Python', count: 6, color: '#3b82f6' },
  { name: 'Rust', count: 2, color: '#ef4444' },
  { name: '数据库', count: 5, color: '#06b6d4' },
  { name: 'GraphQL', count: 3, color: '#ec4899' },
]

export const mockCategories: CategoryItem[] = [
  { name: '前端开发', count: 20, icon: 'lucide:code', iconColor: '#3b82f6', iconBg: 'rgba(59, 130, 246, 0.1)' },
  { name: '随笔日记', count: 17, icon: 'lucide:flame', iconColor: '#f97316', iconBg: 'rgba(249, 115, 22, 0.1)' },
  { name: 'DevOps', count: 9, icon: 'lucide:terminal', iconColor: '#06b6d4', iconBg: 'rgba(6, 182, 212, 0.1)' },
  { name: '后端技术', count: 7, icon: 'lucide:server', iconColor: '#10b981', iconBg: 'rgba(16, 185, 129, 0.1)' },
  { name: '工作复盘', count: 2, icon: 'lucide:briefcase', iconColor: '#64748b', iconBg: 'rgba(100, 116, 139, 0.1)' },
]
