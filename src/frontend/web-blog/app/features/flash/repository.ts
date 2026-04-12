/**
 * @file repository.ts
 * @description 闪念数据仓库接口契约（Repository 模式）
 * @author TixXin
 * @since 2026-04-11
 *
 * 这是闪念功能的数据访问契约，组件 / composable 只依赖此接口。
 * 现在由 LocalFlashRepository（localStorage）实现，未来后端就绪后切到
 * HttpFlashRepository（$fetch /api/flash-notes），调用方代码无需改动。
 */

import type { FlashComment, FlashCommentDraft, FlashNote, FlashNoteDraft } from './types'

export interface FlashNoteRepository {
  /** 列出指定用户的全部闪念，按 createdAt 倒序 */
  list(userId: string): Promise<FlashNote[]>
  /** 创建一条新闪念，返回完整对象（含生成的 id / 时间戳） */
  create(userId: string, draft: FlashNoteDraft): Promise<FlashNote>
  /** 更新指定闪念，支持部分字段 patch */
  update(id: string, patch: Partial<FlashNoteDraft>): Promise<FlashNote>
  /** 删除指定闪念 */
  remove(id: string): Promise<void>
  /** 关键词搜索（用户内本地匹配，不依赖 AI） */
  search(userId: string, query: string): Promise<FlashNote[]>
  /** 切换点赞状态：当前已点赞则 -1，否则 +1（mock 阶段不区分谁点的） */
  toggleLike(id: string): Promise<FlashNote>
  /** 添加评论 */
  addComment(noteId: string, draft: FlashCommentDraft): Promise<FlashComment>
  /** 删除评论 */
  removeComment(noteId: string, commentId: string): Promise<void>
}
