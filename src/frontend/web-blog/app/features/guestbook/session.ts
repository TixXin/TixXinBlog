/** @file session.ts @description 留言输入按应用和身份隔离，恢复副本只保留正文、引用编号和提交标识 */
import { reactive } from 'vue'
import type { ReplyRef } from './types'
export interface GuestbookRecovery {
  content: string
  replyId: number | null
  nonce: string
  signature: string
}
export interface GuestbookSession {
  actor: string
  draft: string
  reply: ReplyRef | null
  revision: number
  epoch: number
  nonce: string
  signature: string
  submitting: boolean
  error: string
  notice: string
  storageError: string
  recovery: GuestbookRecovery | null
}
const sessions = new WeakMap<object, Map<string, GuestbookSession>>()
export function guestbookSession(app: object, scope = 'public') {
  let scopes = sessions.get(app)
  if (!scopes) {
    scopes = new Map()
    sessions.set(app, scopes)
  }
  let state = scopes.get(scope)
  if (!state) {
    state = reactive({
      actor: '',
      draft: '',
      reply: null,
      revision: 0,
      epoch: 0,
      nonce: '',
      signature: '',
      submitting: false,
      error: '',
      notice: '',
      storageError: '',
      recovery: null,
    })
    scopes.set(scope, state)
  }
  return state
}
export function parseGuestbookRecovery(raw: string | null): GuestbookRecovery | null {
  if (!raw || raw.length > 12000) return null
  try {
    const value = JSON.parse(raw) as GuestbookRecovery
    if (
      typeof value.content !== 'string' ||
      value.content.length > 500 ||
      typeof value.nonce !== 'string' ||
      (value.nonce && !/^[0-9a-f-]{36}$/i.test(value.nonce)) ||
      typeof value.signature !== 'string' ||
      value.signature.length > 7000 ||
      (value.replyId !== null && (!Number.isInteger(value.replyId) || value.replyId < 1 || value.replyId > 2147483647))
    )
      return null
    return { content: value.content, replyId: value.replyId, nonce: value.nonce, signature: value.signature }
  } catch {
    return null
  }
}
