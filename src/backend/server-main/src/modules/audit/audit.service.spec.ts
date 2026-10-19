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

describe('AuditService 英文展示', () => {
  it('动作、操作者与持久化的中文字段名按请求语言翻译，数据库记录保持中文', async () => {
    const entries = [
      {
        id: '1',
        action: 'post.update',
        actorId: 'a1',
        resourceType: 'post',
        state: 'success',
        summary: { fields: ['标题', '正文', '自定义字段'] },
        createdAt: new Date('2026-10-18T00:00:00.000Z'),
      },
      {
        id: '2',
        action: 'legacy.unknown',
        resourceType: 'admin',
        state: 'failure',
        summary: { fields: [] },
        createdAt: new Date('2026-10-18T00:00:00.000Z'),
      },
    ]
    const em = {
      findAndCount: jest.fn().mockResolvedValue([entries, entries.length]),
      count: jest.fn().mockResolvedValue(0),
    }
    const controller = new AuditController(new AuditService(em as unknown as EntityManager))

    const english = await controller.list({ page: 1 }, 'en')
    expect(english.items.map(({ actor, actionLabel, summary }) => [actor, actionLabel, summary.fields])).toEqual([
      ['Administrator', 'Save post', ['Title', 'Body', '自定义字段']],
      ['Unauthenticated request', 'Admin action', []],
    ])
    expect(entries[0]!.summary.fields).toEqual(['标题', '正文', '自定义字段'])
    expect(controller.actions('en')['comment.batch.delete']).toBe('Bulk delete comments')

    const chinese = await controller.list({ page: 1 })
    expect(chinese.items.map(({ actor, actionLabel, summary }) => [actor, actionLabel, summary.fields])).toEqual([
      ['管理员', '保存文章', ['标题', '正文', '自定义字段']],
      ['未认证请求', '管理操作', []],
    ])
  })
})
