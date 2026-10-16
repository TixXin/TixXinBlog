/** @file useMomentOverview.ts @description 朋友圈真实聚合与站点资料，失败保留最后成功结果 */
import type { MomentOverview } from '~/features/moment/types'
import { MOMENT_TOPIC_DEFINITIONS } from '~/features/moment/topics'
export async function useMomentOverview(options: { immediate?: boolean } = {}) {
  const repo = useMomentRepository()
  const { ownerCard } = useSiteInfo()
  const retained = useState<MomentOverview | null>('moment-overview-retained', () => null)
  // 预取插件、布局与页面都订阅同一键：进行中的请求复用，SSR 内已完成的结果也直接取 payload，
  // 不再每个订阅方各发一次；浏览器端沿用 Nuxt 默认（水合取 payload，其余取内存缓存）
  const result = useAsyncData('moment-overview', (_app, { signal }) => repo.overview(signal), {
    immediate: options.immediate ?? true,
    dedupe: 'defer',
    getCachedData: (key, app, { cause }) => {
      if (import.meta.server || app.isHydrating) return app.payload.data[key] as MomentOverview | undefined
      if (cause !== 'refresh:manual' && cause !== 'refresh:hook')
        return app.static.data[key] as MomentOverview | undefined
      return undefined
    },
  })
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
  const authorStats = computed(() => ({
    totalMoments: metadata.value?.stats.totalMoments ?? null,
    totalLikes: metadata.value?.stats.totalLikes ?? null,
    totalComments: metadata.value?.stats.totalComments ?? null,
    currentMood: result.error.value ? '统计暂时不可用' : '公开动态统计',
    moodUpdatedAt: '',
    socialLinks: ownerCard.value.socials.map((link) => ({ icon: link.icon, url: link.href, label: link.label })),
  }))
  const ownerProfile = computed(() => ({
    name: ownerCard.value.name,
    avatar: ownerCard.value.avatar || '/avatar.svg',
    bio: ownerCard.value.title,
    link: '/about',
  }))
  const momentTopics = computed(() =>
    (metadata.value?.topics ?? []).map((topic) => ({
      ...(MOMENT_TOPIC_DEFINITIONS.find((item) => item.name === topic.name) ?? {
        name: topic.name,
        icon: 'lucide:hash',
        color: '#5b7cfa',
        description: '',
      }),
      ...topic,
    })),
  )
  const momentDateCounts = computed(() =>
    Object.fromEntries((metadata.value?.dates ?? []).map((item) => [item.date, item.count])),
  )
  const momentDates = computed(() => Object.keys(momentDateCounts.value))
  const moments = computed(() => metadata.value?.recollections ?? [])
  const photoWallImages = computed(() => metadata.value?.photos ?? [])
  return {
    metadata,
    moments,
    authorStats,
    ownerCard,
    ownerProfile,
    momentTopics,
    momentDates,
    momentDateCounts,
    photoWallImages,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
