/**
 * @file useFlashCardInteractions.ts
 * @description 闪念列表卡片互动流程：点赞、置顶、归档、删除与访客评论身份录入编排
 * @author TixXin
 * @since 2026-10-21
 */

import type { Ref } from 'vue'
import type { FlashCommentSubmission, FlashNote } from '~/features/flash/types'
import { commentSubmittedMessage } from '~/features/flash/comments'

export interface FlashCardInteractionsOptions {
  notes: Ref<FlashNote[]>
  archivedNotes: Ref<FlashNote[]>
  refreshArchived: () => Promise<void>
  load: (force?: boolean) => Promise<void>
  remove: (id: string) => Promise<boolean>
  setPinned: (id: string, pinned: boolean) => Promise<FlashNote | null>
  setArchived: (id: string, archived: boolean) => Promise<FlashNote | null>
  toggleLike: (id: string) => Promise<boolean>
  addComment: (
    noteId: string,
    content: string,
    guestAuthor?: { id: string; name: string; avatar: string },
    fields?: Record<string, unknown>,
  ) => Promise<unknown>
  removeComment: (noteId: string, commentId: string) => Promise<boolean>
}

export function useFlashCardInteractions(options: FlashCardInteractionsOptions) {
  const {
    notes,
    archivedNotes,
    refreshArchived,
    load,
    remove,
    setPinned,
    setArchived,
    toggleLike,
    addComment,
    removeComment,
  } = options

  const { t } = useI18n()
  const { isLoggedIn } = useCurrentUser()
  const { open: openLoginDrawer } = useLoginDrawer()
  const { success, error: showError } = useToast()
  const { guestIdentity, hasIdentity, resolveAvatar } = useGuestIdentity()

  const pendingIds = ref<string[]>([])
  const identityModalVisible = ref(false)
  let pendingComment: FlashCommentSubmission | null = null

  async function runNoteAction(id: string, action: () => Promise<void>) {
    if (pendingIds.value.includes(id)) return
    pendingIds.value.push(id)
    try {
      await action()
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastActionFailed'))
    } finally {
      pendingIds.value = pendingIds.value.filter((value) => value !== id)
    }
  }

  async function onRemove(id: string) {
    await runNoteAction(id, async () => {
      await remove(id)
      archivedNotes.value = archivedNotes.value.filter((note) => note.id !== id)
      success(t('flash-moment.flash.toastDeleted'))
    })
  }

  async function onSetPinned(payload: { id: string; pinned: boolean }) {
    await runNoteAction(payload.id, async () => {
      const changed = await setPinned(payload.id, payload.pinned)
      if (changed) {
        archivedNotes.value = archivedNotes.value.map((note) => (note.id === changed.id ? changed : note))
        success(payload.pinned ? t('flash-moment.flash.toastPinned') : t('flash-moment.flash.toastUnpinned'))
      }
    })
  }

  async function onSetArchived(payload: { id: string; archived: boolean }) {
    await runNoteAction(payload.id, async () => {
      const changed = await setArchived(payload.id, payload.archived)
      if (!changed) return
      await refreshArchived()
      if (!payload.archived) await load(true)
      success(payload.archived ? t('flash-moment.flash.toastArchived') : t('flash-moment.flash.toastRestored'))
    })
  }

  async function onToggleLike(id: string) {
    if (pendingIds.value.includes(id)) return
    pendingIds.value.push(id)
    try {
      await toggleLike(id)
      const changed = notes.value.find((note) => note.id === id)
      success(changed?.liked ? t('flash-moment.flash.toastLiked') : t('flash-moment.flash.toastUnliked'))
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastLikeFailed'))
    } finally {
      pendingIds.value = pendingIds.value.filter((value) => value !== id)
    }
  }

  async function onAddComment(payload: FlashCommentSubmission) {
    if (pendingIds.value.includes(payload.noteId)) {
      payload.complete?.(false)
      return
    }
    if (!isLoggedIn.value && !hasIdentity.value) {
      pendingComment = payload
      identityModalVisible.value = true
      return
    }
    pendingIds.value.push(payload.noteId)
    try {
      const guest = guestIdentity.value
      const created = await addComment(
        payload.noteId,
        payload.content,
        !isLoggedIn.value && guest ? { id: guest.id, name: guest.nickname, avatar: resolveAvatar() } : undefined,
        { website: payload.website, formElapsedMs: payload.formElapsedMs },
      )
      payload.complete?.(!!created)
      if (created) success(commentSubmittedMessage(created as import('~/features/flash/types').FlashComment, t))
    } catch (cause) {
      payload.complete?.(false)
      showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastCommentFailed'))
    } finally {
      pendingIds.value = pendingIds.value.filter((value) => value !== payload.noteId)
    }
  }

  async function onRemoveComment(payload: { noteId: string; commentId: string }) {
    try {
      await removeComment(payload.noteId, payload.commentId)
      success(t('flash-moment.flash.toastCommentDeleted'))
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : t('flash-moment.flash.toastDeleteFailed'))
    }
  }

  function loginForComment() {
    cancelIdentity()
    openLoginDrawer('login')
  }

  function cancelIdentity() {
    identityModalVisible.value = false
    pendingComment?.complete?.(false)
    pendingComment = null
  }

  function onIdentityConfirm() {
    identityModalVisible.value = false
    if (pendingComment) {
      const pending = pendingComment
      pendingComment = null
      void onAddComment(pending)
    }
  }

  return {
    pendingIds,
    identityModalVisible,
    onRemove,
    onSetPinned,
    onSetArchived,
    onToggleLike,
    onAddComment,
    onRemoveComment,
    loginForComment,
    cancelIdentity,
    onIdentityConfirm,
  }
}
