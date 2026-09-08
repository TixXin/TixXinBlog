/**
 * @file useArticleInteraction.ts
 * @description 文章互动以服务端为准：挂载后计数、恢复点赞状态、失败反馈与请求互斥
 */
import { fetchPostInteraction, recordPostView, togglePostLike } from '~/features/post/api'

export function useArticleInteraction(id: string, initial: { likes: number; views: number }) {
  const config = useRuntimeConfig()
  const useMock = config.public.postUseMockRepo !== false
  const likes = ref(initial.likes)
  const views = ref(initial.views)
  const liked = ref(false)
  const pending = ref(false)
  const loaded = ref(useMock)
  const error = ref('')

  async function load() {
    if (useMock || pending.value) return
    pending.value = true
    error.value = ''
    let viewFailed = false
    try {
      await recordPostView(config.public.apiBaseUrl, id).catch(() => {
        viewFailed = true
      })
      const result = await fetchPostInteraction(config.public.apiBaseUrl, id)
      likes.value = result.likes
      views.value = result.views
      liked.value = result.liked
      loaded.value = true
      if (viewFailed) error.value = '浏览计数暂未同步，可以重试'
      else void refreshNuxtData('post-metadata')
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
        clearNuxtData('post-list')
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
