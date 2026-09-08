/**
 * @file commentSession.test.ts
 * @description 主题/路由重挂时草稿与回复延续，文章、SSR 会话和退出状态隔离
 * @author TixXin
 * @since 2026-09-07
 */
import { describe, expect, it, vi } from 'vitest'
import { createCommentController } from '../../app/features/post/commentController'
import { clearCommentDrafts, getCommentSession, rememberCommentSession } from '../../app/features/post/commentSession'

function controller() {
  return createCommentController(
    {
      load: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      create: vi.fn(),
      like: vi.fn(),
    },
    { items: [], total: 0 },
  )
}

describe('评论应用会话', () => {
  it('同会话同文章重挂沿用输入、回复对象和在途状态，不被新实例覆盖', () => {
    const scope = {}
    const original = rememberCommentSession(scope, 'post:1', controller())
    original.draft.value = '尚未发送的正文'
    original.replyTarget.value = { id: 9, author: '原作者' }
    original.submitting.value = true
    const mountedAgain = rememberCommentSession(scope, 'post:1', controller())
    expect(mountedAgain).toBe(original)
    expect(mountedAgain.draft.value).toBe('尚未发送的正文')
    expect(mountedAgain.replyTarget.value?.id).toBe(9)
    expect(mountedAgain.busy.value).toBe(true)
  })

  it('不同文章和不同 SSR/浏览器应用会话不共享草稿', () => {
    const firstApp = {}
    const secondApp = {}
    rememberCommentSession(firstApp, 'post:1', controller()).draft.value = '仅属于第一篇'
    expect(getCommentSession(firstApp, 'post:2')).toBeUndefined()
    expect(getCommentSession(secondApp, 'post:1')).toBeUndefined()
  })

  it('退出后清除旧身份输入，仍允许新输入在当前页面与下一主题之间延续', () => {
    const scope = {}
    const state = rememberCommentSession(scope, 'post:1', controller())
    state.draft.value = '旧草稿'
    state.replyTarget.value = { id: 9, author: '原作者' }
    clearCommentDrafts(scope)
    expect(state.draft.value).toBe('')
    expect(state.replyTarget.value).toBeNull()
    state.draft.value = '本次新输入'
    expect(getCommentSession(scope, 'post:1')?.draft.value).toBe('本次新输入')
  })
})
