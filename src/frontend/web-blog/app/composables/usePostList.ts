/**
 * @file usePostList.ts
 * @description 文章列表数据源:useMockRepo 开关在 mock 与后端 API 之间切换(development.md §10.2 模式)
 * @author TixXin
 * @since 2026-07-20
 *
 * 两种模式返回结构一致(posts / pending / error),页面与组件无需感知数据来源。
 */

import { mockPosts } from '~/features/post/mock'
import { fetchPostList } from '~/features/post/api'
import type { PostItem } from '~/features/post/types'

interface PostListSource {
  posts: ComputedRef<PostItem[]>
  pending: Ref<boolean>
  error: Ref<Error | null>
}

export async function usePostList(): Promise<PostListSource> {
  const config = useRuntimeConfig()

  if (config.public.useMockRepo !== false) {
    return {
      posts: computed(() => mockPosts),
      pending: ref(false),
      error: ref(null),
    }
  }

  const { data, pending, error } = await useAsyncData('post-list', () =>
    fetchPostList(config.public.apiBaseUrl as string),
  )
  // 后端不可用时显式失败,避免渲染"暂无相关文章"的假空态误导排查
  if (error.value) {
    throw createError({ statusCode: 503, statusMessage: '文章列表加载失败,请稍后重试', fatal: true })
  }
  return {
    posts: computed(() => data.value ?? []),
    pending,
    error: error as Ref<Error | null>,
  }
}
