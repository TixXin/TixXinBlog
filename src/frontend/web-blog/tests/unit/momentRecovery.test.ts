/** @file momentRecovery.test.ts @description 动态恢复输入白名单及评论会话失效边界 */
import { describe, expect, it } from 'vitest'
import { momentForm, parseMomentRecovery } from '../../app/features/moment/editor'
import {
  clearMomentDrafts,
  invalidateMomentComments,
  momentSession,
  seedMomentState,
} from '../../app/features/moment/session'

describe('朋友圈输入恢复', () => {
  it('恢复有效草稿但不保留未知字段或原型属性', () => {
    const value = {
      version: 1,
      id: null,
      revision: null,
      requestId: '12345678-1234-4123-a123-123456789abc',
      savedAt: '2026-09-09',
      form: { ...momentForm(), content: '未保存的输入', extra: '不应恢复' },
    }
    const parsed = parseMomentRecovery(JSON.stringify(value))!
    expect(parsed.form.content).toBe('未保存的输入')
    expect('extra' in parsed.form).toBe(false)
    expect(parseMomentRecovery(JSON.stringify({ ...value, form: { ...value.form, topics: [false] } }))).toBeNull()
  })
  it('评论内容失效时保留草稿，确认退出时清除草稿与待审缓存', () => {
    const app = {},
      session = momentSession(app)
    const state = seedMomentState(session, {
      id: 'moment',
      content: '动态',
      date: '2026-09-09',
      likes: 0,
      isLiked: false,
    })
    state.draft = '尚未发送'
    invalidateMomentComments(app, 'moment')
    expect(state.draft).toBe('尚未发送')
    expect(state.version).toBe(1)
    state.comments = [
      { id: 'pending', author: '作者', avatar: '', content: '待审', time: '2026-09-09', moderationStatus: 'pending' },
    ]
    clearMomentDrafts(app)
    expect(state.draft).toBe('')
    expect(state.comments).toHaveLength(0)
    expect(session.epoch).toBe(1)
  })
})
