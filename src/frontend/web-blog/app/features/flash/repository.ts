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

import type {
  FlashComment,
  FlashCommentDraft,
  FlashNote,
  FlashNoteDraft,
  FlashPublicPage,
  FlashPublicPageQuery,
} from './types'

export interface FlashNoteRepository {
  /** 公开详情与聚合入口使用，不随管理员登录态包含草稿。 */
  listPublic?(): Promise<FlashNote[]>
  /**
   * 公开列表单页读取（服务端分页）：tag 走 GET /flashes?tag=，q 走 GET /flashes/search?q=。
   * 后端不支持 tag 与 q 同时生效，调用方不得同时传入；仅真实接口实现，本地演示仓库沿用整表读取。
   */
  listPublicPage?(query: FlashPublicPageQuery): Promise<FlashPublicPage>
  /** 列出指定用户的**非归档**闪念，按 createdAt 倒序；isArchived=true 的条目由 listArchived 返回 */
  list(userId: string): Promise<FlashNote[]>
  /** 列出指定用户的**已归档**闪念 */
  listArchived(userId: string): Promise<FlashNote[]>
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
  /** 设置置顶态 */
  setPinned(id: string, pinned: boolean): Promise<FlashNote>
  /** 设置归档态 */
  setArchived(id: string, archived: boolean): Promise<FlashNote>
  /** 添加评论 */
  addComment(noteId: string, draft: FlashCommentDraft): Promise<FlashComment>
  /** 删除评论 */
  removeComment(noteId: string, commentId: string): Promise<void>
}
