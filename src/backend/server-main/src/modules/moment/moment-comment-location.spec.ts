/** @file moment-comment-location.spec.ts @description 管理评论位置使用真实排序计数，不拉取全部评论或泄露其他动态。 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException } from '@nestjs/common'
import { MomentReadService } from './moment-read.service'

describe('动态评论深链分页', () => {
  it('按未删除评论的时间和编号升序计算目标页', async () => {
    const date = new Date('2026-09-11T00:00:00Z')
    const em = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'moment' })
        .mockResolvedValueOnce({ id: 'comment', createdAt: date }),
      count: jest.fn().mockResolvedValue(30),
    }
    const service = new MomentReadService(em as unknown as EntityManager)
    expect(await service.commentLocation('moment', 'comment')).toEqual({ commentId: 'comment', page: 3, pageSize: 15 })
    expect(em.count.mock.calls[0][1]).toEqual({
      moment: 'moment',
      deletedAt: null,
      $or: [{ createdAt: { $lt: date } }, { createdAt: date, id: { $lt: 'comment' } }],
    })
  })
  it('删除或不属于指定动态的评论返回明确不存在', async () => {
    const em = {
      findOne: jest.fn().mockResolvedValueOnce({ id: 'moment' }).mockResolvedValueOnce(null),
      count: jest.fn(),
    }
    const service = new MomentReadService(em as unknown as EntityManager)
    await expect(service.commentLocation('moment', 'other-comment')).rejects.toBeInstanceOf(NotFoundException)
    expect(em.count).not.toHaveBeenCalled()
    expect(em.findOne.mock.calls[1][1]).toEqual({ id: 'other-comment', moment: 'moment', deletedAt: null })
  })
})
