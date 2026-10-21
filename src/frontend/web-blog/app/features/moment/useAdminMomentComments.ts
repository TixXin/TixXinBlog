/**
 * @file useAdminMomentComments.ts
 * @description 朋友圈后台评论抽屉管理、深度链接定位、审核、删除与回复组合函数
 * @author TixXin
 * @since 2026-04-20
 */

import type { ManagedMoment, MomentCommentItem } from '~/features/moment/types'
import { invalidateMomentComments } from '~/features/moment/session'

export interface AdminMomentCommentsContext {
  busyIds: Ref<string[]>
  contentContext: Ref<string>
  load: () => Promise<void>
  perform: (note: ManagedMoment, operation: () => Promise<void>) => Promise<void>
  read: (key: string) => string
}

export function useAdminMomentComments(ctx: AdminMomentCommentsContext) {
  const route = useRoute(),
    app = useNuxtApp(),
    auth = useCurrentUser(),
    repo = useMomentRepository(),
    store = useMomentStore(),
    toast = useToast()
  const { t } = useI18n()

  const commentNote = ref<ManagedMoment | null>(null),
    commentItems = ref<MomentCommentItem[]>([])
  const commentTotal = ref(0),
    commentPage = ref(1),
    commentsPending = ref(false),
    commentsError = ref('')
  const commentTargetId = ref(''),
    commentsLinkError = ref(''),
    commentsLinkPending = ref(false),
    commentsFocusVersion = ref(0)
  const replyPending = ref(false),
    replyDraft = ref(''),
    replyRequest = ref(''),
    replyBody = ref('')

  let commentsVersion = 0,
    commentsLinkVersion = 0

  function invalidateComments(id: string, count: number) {
    invalidateMomentComments(app, id)
    store.patch(id, { comments: [], commentCount: count })
    void app.runWithContext(() => refreshNuxtData(['moment-overview', 'moment-feed', `moment-detail:${id}`]))
  }

  async function openComments(note: ManagedMoment, targetPage = 1) {
    if (commentNote.value?.id !== note.id) {
      if (replyDraft.value.trim() && !window.confirm(t('admin-content.moments.discardReplyConfirm'))) return
      commentItems.value = []
      replyDraft.value = ''
      replyRequest.value = ''
      replyBody.value = ''
    }
    const current = ++commentsVersion
    const requestedPath = route.fullPath,
      requestedContext = ctx.contentContext.value
    commentNote.value = note
    commentTargetId.value = ''
    commentsLinkError.value = ''
    commentsPending.value = true
    commentsError.value = ''
    const actor = auth.currentUser.value?.id
    try {
      const data = await repo.adminComments(note.id, targetPage)
      if (
        current !== commentsVersion ||
        auth.currentUser.value?.id !== actor ||
        route.fullPath !== requestedPath ||
        ctx.contentContext.value !== requestedContext
      )
        return
      const last = Math.max(1, Math.ceil(data.total / 15))
      if (targetPage > last) {
        await openComments(note, last)
        return
      }
      commentItems.value = data.items
      commentTotal.value = data.total
      commentPage.value = data.page
    } catch (cause) {
      if (
        current === commentsVersion &&
        route.fullPath === requestedPath &&
        ctx.contentContext.value !== requestedContext &&
        auth.currentUser.value?.id === actor
      )
        commentsError.value = cause instanceof Error ? cause.message : t('admin-content.moments.commentsLoadFailed')
    } finally {
      if (current === commentsVersion) commentsPending.value = false
    }
  }

  function closeComments() {
    if (commentNote.value && ctx.busyIds.value.includes(commentNote.value.id)) return false
    if (replyDraft.value.trim() && !window.confirm(t('admin-content.moments.discardReplyConfirm'))) return false
    commentsVersion++
    commentNote.value = null
    replyDraft.value = ''
    commentsPending.value = false
    return true
  }

  async function openLinkedComments() {
    if (route.path !== '/admin/moments') return
    const sourceId = ctx.read('comments'),
      targetId = ctx.read('commentId')
    const current = ++commentsLinkVersion,
      actor = auth.currentUser.value?.id,
      context = ctx.contentContext.value,
      path = route.fullPath
    const owns = () =>
      current === commentsLinkVersion &&
      actor === auth.currentUser.value?.id &&
      context === ctx.contentContext.value &&
      path === route.fullPath
    commentsLinkError.value = ''
    commentTargetId.value = ''
    if (!sourceId) {
      commentsLinkPending.value = false
      return
    }
    commentsLinkPending.value = true
    try {
      const note = await repo.adminDetail(sourceId)
      if (!owns()) return
      const location = targetId ? await repo.adminCommentLocation(sourceId, targetId) : { page: 1 }
      if (!owns()) return
      await openComments(note, location.page)
      if (!owns()) return
      if (commentNote.value?.id !== sourceId) {
        commentsLinkError.value = t('admin-content.moments.replyKept')
        return
      }
      commentTargetId.value = targetId
      if (targetId && !commentsError.value && !commentItems.value.some((item) => item.id === targetId))
        commentsLinkError.value = t('admin-content.moments.commentMoved')
      commentsFocusVersion.value++
    } catch (cause) {
      if (owns())
        commentsLinkError.value =
          cause instanceof Error ? cause.message : t('admin-content.moments.commentLocateFailed')
    } finally {
      if (current === commentsLinkVersion) commentsLinkPending.value = false
    }
  }

  async function moderate(comment: MomentCommentItem, next: 'published' | 'pending' | 'hidden') {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value
    if (!note) return
    await ctx.perform(note, async () => {
      const result = await repo.moderate(note.id, comment.id, next, comment.moderationStatus ?? 'published')
      invalidateComments(note.id, result.commentCount)
      if (actor === auth.currentUser.value?.id) {
        await openComments(note, commentPage.value)
        await ctx.load()
      }
    })
  }

  async function removeComment(comment: MomentCommentItem) {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value
    if (
      !note ||
      ctx.busyIds.value.includes(note.id) ||
      !window.confirm(t('admin-content.moments.removeCommentConfirm'))
    )
      return
    await ctx.perform(note, async () => {
      const result = await repo.removeComment(note.id, comment.id)
      invalidateComments(note.id, result.commentCount)
      if (actor === auth.currentUser.value?.id) {
        await openComments(note, 1)
        await ctx.load()
      }
    })
  }

  async function reply() {
    const actor = auth.currentUser.value?.id
    const note = commentNote.value,
      content = replyDraft.value.trim()
    if (!note || !content) return
    if (replyBody.value !== content) {
      replyBody.value = content
      replyRequest.value = crypto.randomUUID()
    }
    await ctx.perform(note, async () => {
      replyPending.value = true
      try {
        const result = await repo.comment(note.id, { requestId: replyRequest.value, content }, true)
        invalidateComments(note.id, result.commentCount)
        if (actor === auth.currentUser.value?.id) {
          if (replyDraft.value.trim() === content) replyDraft.value = ''
          replyRequest.value = ''
          replyBody.value = ''
          await openComments(note, Math.max(1, Math.ceil((commentTotal.value + 1) / 15)))
          await ctx.load()
          toast.success(t('admin-content.moments.replySent'))
        }
      } finally {
        replyPending.value = false
      }
    })
  }

  function resetActor() {
    commentNote.value = null
    commentItems.value = []
    replyDraft.value = ''
    replyBody.value = ''
    replyRequest.value = ''
    commentsVersion++
    commentsLinkVersion++
    commentsLinkPending.value = false
    commentTargetId.value = ''
    commentsPending.value = false
  }

  function cancelPending() {
    commentsVersion++
    commentsLinkVersion++
  }

  return {
    commentNote,
    commentItems,
    commentTotal,
    commentPage,
    commentsPending,
    commentsError,
    commentTargetId,
    commentsLinkError,
    commentsLinkPending,
    commentsFocusVersion,
    replyPending,
    replyDraft,
    openComments,
    closeComments,
    openLinkedComments,
    moderate,
    removeComment,
    reply,
    resetActor,
    cancelPending,
  }
}
