/**
 * @file usePostMetadata.ts
 * @description 公开文章统计与归档的单一数据源，HTTP 失败不替换为演示数字
 */
import { fetchPostMetadata } from '~/features/post/api'
import { mockPosts } from '~/features/post/mock'
import type { PostMetadata } from '~/features/post/types'
import type { ArchiveYear } from '~/features/article/types'
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
  // useState 与监听在首次 await 前注册，保持 SSR 的 Nuxt 上下文与组件清理作用域。
  const retained = useState<PostMetadata | undefined>('post-metadata-retained', () => undefined)
  const result = useAsyncData('post-metadata', async (): Promise<PostMetadata> => {
    if (config.public.postUseMockRepo === false) return fetchPostMetadata(config.public.apiBaseUrl)
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
      archive: mockPosts.map((post) => ({ id: post.id, title: post.title, folder: post.folder, date: post.date })),
    }
  })
  // 刷新失败时 Nuxt 会清空当前 data；保留最后成功结果，不能将故障解释为零篇文章。
  watch(
    result.data,
    (value) => {
      if (value) retained.value = value
    },
    { immediate: true },
  )
  await result
  if (result.data.value) retained.value = result.data.value
  const metadata = computed(() => result.data.value ?? retained.value)
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
  const archiveYears = computed<ArchiveYear[]>(() => {
    const years = new Map<number, ArchiveYear>()
    for (const post of metadata.value?.archive ?? []) {
      const year = Number(post.date.slice(0, 4))
      const group = years.get(year) ?? { year, shortYear: String(year).slice(-2), count: 0, posts: [] }
      group.posts.push({
        title: post.title,
        date: post.date.slice(0, 10),
        category: post.folder,
        categoryColor: 'sky',
        href: articlePath(post),
      })
      group.count += 1
      years.set(year, group)
    }
    return [...years.values()].sort((a, b) => b.year - a.year)
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
    archiveYears,
    archiveStats,
    categoryDistribution,
    error: result.error,
    pending: result.pending,
    refresh: result.refresh,
  }
}
