/**
 * @file audit.service.spec.ts
 * @description 审计列表的批量动作标签与筛选回归；使用内存替身，不连接数据库
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { AuditEntry } from '../../entities/audit-entry.entity'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

const batchActions = [
  ['comment.batch.moderate', '批量审核评论'],
  ['comment.batch.delete', '批量删除评论'],
  ['guestbook.batch.moderate', '批量审核留言'],
  ['guestbook.batch.delete', '批量删除留言'],
] as const

describe('AuditService 批量动作展示', () => {
  it('动作选项和列表同时提供批量中文标签，历史动作仍使用原标签', async () => {
    const actions = [
      ...batchActions,
      ['comment.moderate', '审核评论'],
      ['comment.delete', '删除评论及回复'],
      ['guestbook.update', '审核或置顶留言'],
      ['guestbook.delete', '删除留言'],
    ] as const
    const entries = actions.map(([action], index) => ({
      id: String(index),
      action,
      actorName: '博主',
      resourceType: action.startsWith('comment.') ? 'comment' : 'guestbook',
      state: 'success',
      summary: { fields: [], counts: { successCount: 2, failedCount: 0 } },
      createdAt: new Date('2026-10-18T00:00:00.000Z'),
    }))
    const em = {
      findAndCount: jest.fn().mockResolvedValue([entries, entries.length]),
      count: jest.fn().mockResolvedValue(0),
    }
    const service = new AuditService(em as unknown as EntityManager)
    const controller = new AuditController(service)

    const result = await controller.list({ page: 1 })

    expect(result.items.map(({ action, actionLabel }) => [action, actionLabel])).toEqual(actions)
    expect(result.total).toBe(actions.length)
    for (const [action, label] of actions) expect(controller.actions()[action]).toBe(label)
  })

  it.each(batchActions)('筛选 %s 时按完整批量动作查询', async (action) => {
    const em = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
    }
    const service = new AuditService(em as unknown as EntityManager)

    await service.list({ page: 1, action })

    expect(em.findAndCount).toHaveBeenCalledWith(AuditEntry, { action }, expect.objectContaining({ offset: 0 }))
  })
})
