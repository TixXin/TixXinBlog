/** @file session.ts @description 评论草稿与在途状态按 Nuxt 应用隔离，路由和主题重挂保持同一份状态 */
import { reactive } from 'vue'
import type { MomentCommentItem, MomentItem } from './types'

export interface MomentInteractionState {
  version: number
  draft: string
  comments: MomentCommentItem[]
  total: number
  page: number
  initialized: boolean
  loading: boolean
  loadError: string
  submitting: boolean
  submitError: string
  notice: string
  likePending: boolean
  requestId: string
  requestBody: string
}
interface Session {
  states: Record<string, MomentInteractionState>
  epoch: number
}
const sessions = new WeakMap<object, Session>()
export function momentSession(app: object): Session {
  if (!sessions.has(app)) sessions.set(app, { states: reactive(Object.create(null)), epoch: 0 })
  return sessions.get(app)!
}
export function seedMomentState(session: Session, note: MomentItem) {
  if (!session.states[note.id])
    session.states[note.id] = {
      version: 0,
      draft: '',
      comments: [...(note.comments ?? [])],
      total: note.commentCount ?? note.comments?.length ?? 0,
      page: 0,
      initialized: false,
      loading: false,
      loadError: '',
      submitting: false,
      submitError: '',
      notice: '',
      likePending: false,
      requestId: '',
      requestBody: '',
    }
  const state = session.states[note.id]!
  if (!state.initialized && !state.submitting) state.comments = [...(note.comments ?? [])]
  state.total = Math.max(state.total, note.commentCount ?? 0)
  return state
}
export function clearMomentDrafts(app: object) {
  const session = sessions.get(app)
  if (!session) return
  session.epoch++
  for (const state of Object.values(session.states))
    Object.assign(state, {
      draft: '',
      submitting: false,
      loading: false,
      likePending: false,
      requestId: '',
      requestBody: '',
      submitError: '',
      notice: '',
      loadError: '',
      initialized: false,
      page: 0,
      comments: state.comments.filter(
        (comment) => !comment.moderationStatus || comment.moderationStatus === 'published',
      ),
    })
}
export function invalidateMomentComments(app: object, id: string) {
  const state = sessions.get(app)?.states[id]
  if (!state) return
  state.version++
  Object.assign(state, { comments: [], page: 0, total: 0, initialized: false, loading: false, loadError: '' })
}
