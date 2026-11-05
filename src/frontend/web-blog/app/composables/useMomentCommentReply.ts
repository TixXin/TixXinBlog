/**
 * @file useMomentCommentReply.ts
 * @description 朋友圈评论区的回复对象：点“回复”记住目标并聚焦输入框，提交时带上 replyToId，
 *              发送成功（草稿被清空且无错误）后回到直接评论。
 * @author TixXin
 * @since 2026-11-06
 */
import type { Ref } from 'vue'
import type { MomentCommentItem } from '~/features/moment/types'

export function useMomentCommentReply(options: {
  input: Ref<HTMLInputElement | null>
  submitting: () => boolean
  succeeded: () => boolean
  emit: (fields: { replyToId?: string }) => void
}) {
  const replyTarget = ref<{ id: string; author: string } | null>(null)
  function startReply(comment: Pick<MomentCommentItem, 'id' | 'author'>) {
    replyTarget.value = { id: comment.id, author: comment.author }
    options.input.value?.focus()
  }
  function cancelReply() {
    replyTarget.value = null
    options.input.value?.focus()
  }
  function submit() {
    options.emit(replyTarget.value ? { replyToId: replyTarget.value.id } : {})
  }
  watch(options.submitting, (submitting, was) => {
    if (was && !submitting && options.succeeded()) replyTarget.value = null
  })
  return { replyTarget, startReply, cancelReply, submit }
}
