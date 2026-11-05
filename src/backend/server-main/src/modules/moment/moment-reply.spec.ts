/** @file moment-reply.spec.ts @description 朋友圈评论回复目标的公开投影：不可见目标不泄露作者，原生行与实体两条路径一致 */
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { CreateMomentCommentDto } from './moment.dto'
import { formatCommentRow, replyProjection, type CommentRow } from './moment-query'

const target = { id: 'c-1', author: '远山', status: 'published', deletedAt: null }

describe('朋友圈评论回复', () => {
  it('公开目标只暴露编号与昵称', () => {
    expect(replyProjection(target)).toEqual({ id: 'c-1', author: '远山' })
    expect(replyProjection(null)).toBeNull()
  })

  it.each([
    ['待审', { status: 'pending' }],
    ['隐藏', { status: 'hidden' }],
    ['已删除', { deletedAt: new Date() }],
  ])('%s目标对访客只标明不可见，后台仍显示原作者', (_name, patch) => {
    expect(replyProjection({ ...target, ...patch })).toEqual({ id: null, author: null })
    expect(replyProjection({ ...target, ...patch }, true)).toEqual({ id: 'c-1', author: '远山' })
  })

  it('卡片内嵌评论的原生行与实体投影一致，目标记录缺失时同样不可见', () => {
    const row: CommentRow = {
      id: 'c-2',
      moment_id: 'm-1',
      author: '读者',
      avatar: '',
      content: '同感',
      created_at: new Date('2026-11-06T00:00:00Z'),
      is_owner: false,
      status: 'published',
      reply_to_id: 'c-1',
      reply_author: '远山',
      reply_status: 'hidden',
      reply_deleted_at: null,
    }
    expect(formatCommentRow(row).replyTo).toEqual({ id: null, author: null })
    expect(formatCommentRow({ ...row, reply_status: 'published' }).replyTo).toEqual({ id: 'c-1', author: '远山' })
    expect(formatCommentRow({ ...row, reply_author: null }).replyTo).toEqual({ id: null, author: null })
    expect(formatCommentRow({ ...row, reply_to_id: null }).replyTo).toBeNull()
  })

  it('回复目标编号必须是 UUID', () => {
    const base = { requestId: '11111111-1111-4111-8111-111111111111', author: '读者', content: '同感' }
    expect(validateSync(plainToInstance(CreateMomentCommentDto, base))).toHaveLength(0)
    expect(
      validateSync(
        plainToInstance(CreateMomentCommentDto, { ...base, replyToId: '3b8ada68-c31e-458a-9bde-12cf04e2473e' }),
      ),
    ).toHaveLength(0)
    expect(validateSync(plainToInstance(CreateMomentCommentDto, { ...base, replyToId: 'c-1' }))).toHaveLength(1)
  })
})
