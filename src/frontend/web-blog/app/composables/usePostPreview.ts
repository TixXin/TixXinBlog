/** @file usePostPreview.ts @description 页面独占的草稿预览读取；切换凭据和失败时立即撤回旧正文 */
import { fetchPostPreview } from '~/features/post/api'
import { postPreviewToken } from '~/features/post/preview'

export async function usePostPreview(value: MaybeRefOrGetter<unknown>) {
  const config = useRuntimeConfig()
  const scope = usePageRequestScope()
  const token = computed(() => postPreviewToken(toValue(value)))
  // 每个页面实例独占临时水合数据，不向文章快照、公开 LRU 或浏览器持久存储写入草稿。
  const result = useAsyncData(
    `post-preview-${useId()}`,
    async (_app, { signal }) => {
      const requested = token.value
      const article = await fetchPostPreview(
        config.public.apiBaseUrl,
        requested,
        AbortSignal.any([signal, scope.signal]),
      )
      return { token: requested, article }
    },
    {
      deep: false,
      getCachedData: (key, app) => (app.isHydrating ? app.payload.data[key] : undefined),
    },
  )
  function refresh() {
    result.clear()
    return result.refresh()
  }
  watch(token, () => void refresh(), { flush: 'sync' })
  onScopeDispose(() => result.clear())
  await result
  scope.assertActive()
  if (result.data.value && result.data.value.token !== token.value) await refresh()
  scope.assertActive()
  return {
    article: computed(() => (result.data.value?.token === token.value ? result.data.value.article : null)),
    pending: result.pending,
    error: result.error,
    refresh,
  }
}
