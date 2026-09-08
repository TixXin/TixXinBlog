/**
 * @file usePostPageMotion.ts
 * @description 数据真正替换后播放一次分页入场，保留稳定列表节点并清理被打断的过渡
 */
import type { PostItem } from '~/features/post/types'
import { playElementEntrance } from '~/utils/elementMotion'

export function usePostPageMotion(
  element: Ref<HTMLElement | null>,
  posts: Ref<PostItem[]>,
  displayMode: Ref<'waterfall' | 'pagination'>,
) {
  const { contentTransitionName, contentTransitionDuration } = useAppearanceSettings()
  let stop: (() => void) | undefined
  function cancel() {
    stop?.()
    stop = undefined
  }
  // 请求页码和当前内容分开：等待、失败或同页刷新都不让旧文章提前退场。
  const contentKey = computed(() => `${displayMode.value}:${posts.value.map((post) => post.id).join(',')}`)
  watch(
    contentKey,
    (_next, previous) => {
      cancel()
      if (!previous.startsWith('pagination:') || displayMode.value !== 'pagination' || !posts.value.length) return
      const target = element.value
      const duration = contentTransitionDuration.value
      if (!target || !duration || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      stop = playElementEntrance(
        target,
        () => {
          stop = undefined
        },
        {
          duration,
          distance:
            contentTransitionName.value === 'content-fade'
              ? 0
              : contentTransitionName.value === 'content-soft'
                ? -6
                : -8,
        },
      )
    },
    { flush: 'post' },
  )
  watch([contentTransitionName, contentTransitionDuration], cancel, { flush: 'sync' })
  onBeforeUnmount(cancel)
}
