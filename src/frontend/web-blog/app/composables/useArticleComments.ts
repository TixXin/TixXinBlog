/**
 * @file useArticleComments.ts
 * @description 评论数据源及游客身份协调；SSR 读取公共评论，水合后仅在设备已有访客身份时恢复点赞状态
 */
import type { VisitorSubmissionFields } from '~/features/visitor/types'
import { invalidatePublicReads } from '~/utils/invalidatePublicReads'
import { createComment, fetchComments, toggleCommentLike } from '~/features/post/api'
import { createCommentController, findComment } from '~/features/post/commentController'
import type { CommentList, CommentTransport } from '~/features/post/commentController'
import { mockComments } from '~/features/post/mock'
import { getCommentSession, rememberCommentSession } from '~/features/post/commentSession'
import { hasStoredVisitorId } from '~/utils/visitorId'

export async function useArticleComments(id: string) {
  const initialRequest = usePageRequestScope()
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()
  const useMock = config.public.postUseMockRepo !== false
  // 静态发布第一版隐藏评论，不读取也不提交。
  const staticSite = useStaticSite()
  const base = config.public.apiBaseUrl as string
  const { guestIdentity, resolveAvatar } = useGuestIdentity()
  const toast = useToast()
  // 用全局 i18n 实例而非 useI18n：本 composable 也会在插件或测试中脱离组件 setup 调用
  const { t } = useNuxtApp().$i18n
  const identityVisible = ref(false)
  const sessionKey = JSON.stringify([String(id), useMock, base])
  let controller = getCommentSession(nuxtApp, sessionKey)

  // 演示模式只维护本次页面生命周期的数据，与真实 HTTP 路径明确分开。
  const mockData: CommentList = { items: structuredClone(mockComments), total: 0 }
  const count = (items: CommentList['items']): number =>
    items.reduce((sum, item) => sum + 1 + count(item.replies ?? []), 0)
  mockData.total = count(mockData.items)
  let mockId = Date.now()
  const transport: CommentTransport = useMock
    ? {
        load: async () => structuredClone(mockData),
        create: async (input) => {
          const created = {
            id: ++mockId,
            author: input.author,
            avatar: input.avatar || '/avatar.svg',
            content: input.content,
            time: new Date().toISOString().slice(0, 10),
            likes: 0,
            liked: false,
            isOwner: false,
            replies: [],
          }
          const parent = input.parentId ? findComment(mockData.items, input.parentId) : undefined
          if (parent) (parent.replies ??= []).push(created)
          else mockData.items.push(created)
          mockData.total += 1
          return structuredClone(created)
        },
        like: async (commentId) => {
          const item = findComment(mockData.items, commentId)!
          item.liked = !item.liked
          item.likes += item.liked ? 1 : -1
          return { liked: item.liked, likes: item.likes }
        },
      }
    : {
        load: () => fetchComments(base, id),
        create: (input) => createComment(base, id, input),
        like: (commentId) => toggleCommentLike(base, commentId),
      }

  // SSR 读取不带设备身份，水合后需按设备恢复点赞与自己的待审评论；客户端导航时首次读取已携带身份，无需再读。
  // 本设备从未生成过访客 id 时不可能有个人记录，也跳过整树重读。
  const personalizeAfterHydration = !useMock && !staticSite && nuxtApp.isHydrating === true && hasStoredVisitorId()
  // 生命周期钩子必须在首个 await 之前注册，避免异步 composable 丢失组件实例。
  onMounted(() => {
    if (personalizeAfterHydration) void controller!.reload()
  })
  if (!controller) {
    // 只取消当前视图的初始读取；共享控制器的提交、重试和草稿继续由应用会话持有。
    const result = await useAsyncData(`article-${id}-comments`, (_app, { signal }) =>
      staticSite
        ? Promise.resolve({ items: [], total: 0 })
        : useMock
          ? transport.load()
          : fetchComments(base, id, AbortSignal.any([signal, initialRequest.signal])),
    )
    initialRequest.assertActive()
    controller = rememberCommentSession(
      nuxtApp,
      sessionKey,
      createCommentController(
        transport,
        result.data.value ?? { items: [], total: 0 },
        result.error.value ? t('article.comment.loadFailed') : '',
      ),
    )
  }
  const state = controller

  let pendingFields: VisitorSubmissionFields = {}
  async function submit(fields?: VisitorSubmissionFields) {
    if (fields) pendingFields = fields
    if (!state.canSubmit.value) return
    // 评论始终以游客身份提交；前端模拟登录不代表后端管理员权限。
    if (!guestIdentity.value) {
      identityVisible.value = true
      return
    }
    identityVisible.value = false
    if (
      await state.submit({ author: guestIdentity.value.nickname, avatar: resolveAvatar() || undefined }, pendingFields)
    ) {
      toast.success(useMock ? t('article.comment.mockAdded') : state.submitNotice.value)
      // 列表离开文章后重新取数，避免首页沿用发表前的缓存计数。
      if (!useMock) {
        invalidatePublicReads(nuxtApp, ['posts', 'post-summary'])
        void refreshNuxtData('post-metadata')
      }
    }
  }

  return { ...state, identityVisible, submit }
}
