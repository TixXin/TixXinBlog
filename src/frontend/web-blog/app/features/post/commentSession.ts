/**
 * @file commentSession.ts
 * @description 评论控制器按 Nuxt 请求/浏览器应用会话隔离，跨主题及路由复用草稿与在途状态
 * @author TixXin
 * @since 2026-09-07
 */
import type { createCommentController } from './commentController'

type CommentController = ReturnType<typeof createCommentController>

// 以应用实例为弱键，不能用文章 ID 的全局 Map 在 SSR 请求之间共享用户输入。
const sessions = new WeakMap<object, Map<string, CommentController>>()

export function getCommentSession(scope: object, key: string): CommentController | undefined {
  return sessions.get(scope)?.get(key)
}

export function rememberCommentSession(scope: object, key: string, controller: CommentController): CommentController {
  let entries = sessions.get(scope)
  if (!entries) {
    entries = new Map()
    sessions.set(scope, entries)
  }
  if (!entries.has(key)) entries.set(key, controller)
  return entries.get(key)!
}

/** 确认退出/更换账号时清除输入；保留控制器引用，使当前页面后续编辑仍能跨主题延续。 */
export function clearCommentDrafts(scope: object) {
  for (const controller of sessions.get(scope)?.values() ?? []) {
    controller.draft.value = ''
    controller.replyTarget.value = null
    controller.submitError.value = ''
    controller.submitNotice.value = ''
  }
}
