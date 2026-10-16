/**
 * @file usePostMetadata.ts
 * @description 公开文章统计与归档的单一数据源，HTTP 失败不替换为演示数字
 */
import { fetchPostMetadata } from '~/features/post/api'
import { mockPosts } from '~/features/post/mock'
import type { PostSummary } from '~/features/post/types'
import type { CategoryItem, SiteStats, TagItem } from '~/features/stats/types'

const COLORS: Record<string, string> = {
  sky: '#0ea5e9',
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  orange: '#f97316',
  amber: '#f59e0b',
}

export async function usePostMetadata() {
  const config = useRuntimeConfig()
  // 轻量统计复用公开读取缓存；失败保留与写后失效统一由缓存生命周期处理。
  const result = usePublicReadData(
    'post-metadata',
    async (_app, { signal }): Promise<PostSummary> => {
      if (config.public.postUseMockRepo === false) return fetchPostMetadata(config.public.apiBaseUrl, signal)
      const tags = new Map<string, { label: string; slug: string; color: string; count: number }>()
      const categories = new Map<string, number>()
      for (const post of mockPosts) {
        categories.set(post.folder, (categories.get(post.folder) ?? 0) + 1)
        for (const tag of post.tags) {
          const entry = tags.get(tag.label) ?? { label: tag.label, slug: tag.label, color: tag.color, count: 0 }
          entry.count += 1
          tags.set(tag.label, entry)
        }
      }
      return {
        tags: [...tags.values()],
        categories: [...categories].map(([name, count]) => ({ name, count })),
        stats: {
          posts: mockPosts.length,
          views: mockPosts.reduce((sum, post) => sum + post.views, 0),
          comments: mockPosts.reduce((sum, post) => sum + post.comments, 0),
          tags: tags.size,
          uptimeDays: 0,
        },
      }
    },
    { domain: 'post-summary', kind: 'metadata' },
  )
  await result
  const metadata = result.data
  const tags = computed<TagItem[]>(() =>
    (metadata.value?.tags ?? []).map((tag) => ({
      name: tag.label,
      count: tag.count,
      color: COLORS[tag.color] ?? COLORS.sky!,
    })),
  )
  const categories = computed<CategoryItem[]>(() =>
    (metadata.value?.categories ?? []).map((category) => ({
      ...category,
      icon: 'lucide:folder',
      iconColor: '#0ea5e9',
      iconBg: 'rgba(14, 165, 233, 0.1)',
    })),
  )
  const siteStats = computed<SiteStats | null>(() => {
    const stats = metadata.value?.stats
    if (!stats) return null
    return {
      articles: stats.posts,
      views: stats.views >= 10000 ? `${(stats.views / 10000).toFixed(1)}w` : String(stats.views),
      comments: stats.comments,
      tags: stats.tags,
      uptimeDays: stats.uptimeDays,
      activity: metadata.value?.activity,
    }
  })
  const archiveStats = computed(() => [
    { label: '文章', value: String(metadata.value?.stats.posts ?? 0) },
    { label: '分类', value: String(categories.value.length) },
    { label: '标签', value: String(tags.value.length) },
  ])
  const categoryDistribution = computed(() =>
    categories.value.map((item) => ({
      name: item.name,
      count: item.count,
      percent: Math.round((item.count / Math.max(metadata.value?.stats.posts ?? 0, 1)) * 100),
    })),
  )
  return {
    metadata,
    tags,
    categories,
    siteStats,
    archiveStats,
    categoryDistribution,
    error: result.error,
    pending: result.pending,
    refresh: result.refresh,
  }
}
