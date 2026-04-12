/**
 * @file repository.http.ts
 * @description FlashNoteRepository 的 HTTP 实现占位，预留给未来后端对接
 * @author TixXin
 * @since 2026-04-11
 *
 * 当前后端尚未就绪，此处仅作类型契约占位。所有方法直接抛错，
 * 仅在 nuxt.config.ts `runtimeConfig.public.useMockRepo === false` 时才会被实例化使用。
 *
 * 未来对接步骤：
 * 1. 把每个方法的 throw 替换为 `return $fetch('/api/flash-notes', ...)`
 * 2. 把 nuxt.config.ts 的 useMockRepo 改成 false（或读环境变量）
 * 3. 组件 / composable 一行不用动
 */

import type { FlashNoteRepository } from './repository'
import type { FlashComment, FlashCommentDraft, FlashNote, FlashNoteDraft } from './types'

const NOT_IMPLEMENTED = 'HttpFlashRepository 尚未实现，请保持 useMockRepo=true 或先完成后端 API 对接'

export class HttpFlashRepository implements FlashNoteRepository {
  list(_userId: string): Promise<FlashNote[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  create(_userId: string, _draft: FlashNoteDraft): Promise<FlashNote> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  update(_id: string, _patch: Partial<FlashNoteDraft>): Promise<FlashNote> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  remove(_id: string): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  search(_userId: string, _query: string): Promise<FlashNote[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  toggleLike(_id: string): Promise<FlashNote> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  addComment(_noteId: string, _draft: FlashCommentDraft): Promise<FlashComment> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
  removeComment(_noteId: string, _commentId: string): Promise<void> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
}
