/** @file comments.ts @description 闪念评论展示口径：计数只计已发布，待审评论仅提交者本机可见并给出提示 */
import type { FlashComment, FlashNote } from './types'

/** 已发布评论数：优先使用后端 commentCount，本地演示数据缺省时按已发布评论计算 */
export function publishedCommentCount(note: Pick<FlashNote, 'comments' | 'commentCount'>): number {
  return note.commentCount ?? note.comments.filter((comment) => isPublished(comment)).length
}

export function isPublished(comment: Pick<FlashComment, 'moderationStatus'>): boolean {
  return (comment.moderationStatus ?? 'published') === 'published'
}

/** 提交成功后的提示：待审评论明确说明公开时机，避免访客误以为发送失败或已公开 */
export function commentSubmittedMessage(comment: Pick<FlashComment, 'moderationStatus'>): string {
  return comment.moderationStatus === 'pending' ? '已提交，待博主审核后公开' : '评论已发送'
}

/** 本地写入后更新计数：只有已发布评论计入，待审评论只追加到当前访客可见列表 */
export function appendComment(note: FlashNote, comment: FlashComment): FlashNote {
  return {
    ...note,
    comments: [...note.comments, comment],
    ...(note.commentCount === undefined ? {} : { commentCount: note.commentCount + (isPublished(comment) ? 1 : 0) }),
  }
}

/** 本地删除后同步计数：删除已发布评论时计数减一 */
export function withoutComment(note: FlashNote, commentId: string): FlashNote {
  const removed = note.comments.find((comment) => comment.id === commentId)
  return {
    ...note,
    comments: note.comments.filter((comment) => comment.id !== commentId),
    ...(note.commentCount === undefined || !removed || !isPublished(removed)
      ? {}
      : { commentCount: Math.max(0, note.commentCount - 1) }),
  }
}
