/**
 * @file types.ts
 * @description 闪念（Flash Notes）模块类型定义
 * @author TixXin
 * @since 2026-04-11
 */

/** 单条评论 */
export interface FlashComment {
  /** 评论 id */
  id: string
  /** 评论作者 id */
  authorId: string
  /** 评论作者昵称（mock 期冗余存储，便于展示） */
  authorName: string
  /** 评论作者头像 */
  authorAvatar: string
  /** 评论内容（纯文本） */
  content: string
  /** 创建时间 ISO 字符串 */
  createdAt: string
}

/** 单条闪念笔记 */
export interface FlashNote {
  /** 全局唯一 id */
  id: string
  /** 所属用户 id（per-user 隔离） */
  userId: string
  /** 笔记正文（纯文本，支持换行） */
  content: string
  /** 标签集合 */
  tags: string[]
  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 最近更新时间 ISO 字符串 */
  updatedAt: string
  /** 点赞数 */
  likes: number
  /** 评论列表 */
  comments: FlashComment[]
}

/** 创建/更新闪念时使用的草稿数据 */
export interface FlashNoteDraft {
  content: string
  tags: string[]
}

/** 创建评论时的草稿 */
export interface FlashCommentDraft {
  authorId: string
  authorName: string
  authorAvatar: string
  content: string
}

/** AI 搜索返回结构 */
export interface FlashAISearchResult {
  /** 模板拼接出的回答正文 */
  answer: string
  /** 命中的笔记 id 列表 */
  citedNoteIds: string[]
  /** 模拟思考延迟（毫秒） */
  latencyMs: number
}
