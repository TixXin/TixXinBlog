/**
 * @file useArticleInteraction.ts
 * @description 文章互动以服务端为准：挂载后计数并恢复点赞状态（一次请求）、失败反馈与请求互斥
 */
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { fetchPostInteraction, recordPostView, togglePostLike } from '~/features/post/api'
import type { PostSummary } from '~/features/post/types'

export function useArticleInteraction(id: string, initial: { likes: number; views: number }) {
  const app = useNuxtApp()
  const config = useRuntimeConfig()
  const useMock = config.public.postUseMockRepo !== false
  const likes = ref(initial.likes)
  const views = ref(initial.views)
  const liked = ref(false)
  const pending = ref(false)
  const loaded = ref(useMock)
  const error = ref('')
  // 在 setup 同步阶段取得统计数据引用，挂载后的异步回调中仍可安全读写；只在客户端使用，不在 SSR 载荷中占位。
  const siteSummary = import.meta.client ? useNuxtData<PostSummary>('post-metadata').data : undefined

  /** 本次浏览已计入时把侧栏全站浏览数本地加一，不为一个数字重新拉取整份统计。 */
  function bumpSiteViews() {
    const summary = siteSummary?.value
    if (!siteSummary || !summary?.stats) return
    // 统计数据是浅响应式，整体替换才能触发更新。
    siteSummary.value = { ...summary, stats: { ...summary.stats, views: summary.stats.views + 1 } }
  }

  async function load() {
    if (useMock || pending.value) return
    pending.value = true
    let viewSyncFailed = false
    try {
      // 浏览计数接口同时返回当前访客的点赞状态，正常路径只需一次请求。
      const result = await recordPostView(config.public.apiBaseUrl, id).catch(async () => {
        viewSyncFailed = true
        return fetchPostInteraction(config.public.apiBaseUrl, id)
      })
      likes.value = result.likes
      views.value = result.views
      liked.value = result.liked
      loaded.value = true
      error.value = viewSyncFailed ? '浏览计数暂未同步，可以重试' : ''
      if ('counted' in result && result.counted) bumpSiteViews()
    } catch {
      error.value = '文章互动状态加载失败，请重试'
    } finally {
      pending.value = false
    }
  }

  async function toggle() {
    if (pending.value || !loaded.value) return
    pending.value = true
    error.value = ''
    try {
      if (useMock) {
        liked.value = !liked.value
        likes.value += liked.value ? 1 : -1
      } else {
        const result = await togglePostLike(config.public.apiBaseUrl, id)
        liked.value = result.liked
        likes.value = result.likes
        invalidatePublicReads(app, ['posts', 'post-summary'])
      }
    } catch {
      error.value = '点赞操作失败，请重试同步状态'
    } finally {
      pending.value = false
    }
  }

  onMounted(() => {
    void load()
  })
  return { likes, views, liked, pending, loaded, error, toggle, load }
}
