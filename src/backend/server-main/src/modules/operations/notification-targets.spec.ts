/** @file notification-targets.spec.ts @description 通知目标按领域批量查询、缺失降级和后台链接映射，不连接数据库 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationTargets, type NotificationSource, type NotificationTarget } from './notification-targets'

describe('通知目标解析', () => {
  it('没有通知时不执行查询', async () => {
    const em = { execute: jest.fn() }

    await expect(resolveNotificationTargets(em as unknown as EntityManager, [])).resolves.toEqual(new Map())

    expect(em.execute).not.toHaveBeenCalled()
  })

  it('每个领域只查一次且来源编号去重，重复来源的通知均保留', async () => {
    const notifications: NotificationSource[] = [
      { id: 'task-note', kind: 'task', sourceId: 'task-1' },
      { id: 'comment-note', kind: 'comment', sourceId: '41' },
      { id: 'duplicate-note', kind: 'comment', sourceId: '41' },
      { id: 'another-comment', kind: 'comment', sourceId: '42' },
      { id: 'guestbook-note', kind: 'guestbook', sourceId: '41' },
      { id: 'moment-note', kind: 'moment-comment', sourceId: '41' },
    ]
    const em = {
      execute: jest
        .fn()
        .mockResolvedValueOnce([
          { id: '42', state: 'handled' },
          { id: '41', state: 'pending_review' },
        ])
        .mockResolvedValueOnce([{ id: '41', state: 'awaiting_reply' }])
        .mockResolvedValueOnce([{ id: '41', state: 'available', parent: 'moment-3' }])
        .mockResolvedValueOnce([{ id: 'task-1', state: 'failed' }]),
    }

    const result = await resolveNotificationTargets(em as unknown as EntityManager, notifications)

    expect(em.execute).toHaveBeenCalledTimes(4)
    expect(em.execute).toHaveBeenNthCalledWith(1, expect.stringContaining('from comment c join post p'), ['41', '42'])
    expect(em.execute).toHaveBeenNthCalledWith(2, expect.stringContaining('from guestbook_message g'), ['41'])
    expect(em.execute).toHaveBeenNthCalledWith(3, expect.stringContaining('from moment_comment c join moment m'), [
      '41',
    ])
    expect(em.execute).toHaveBeenNthCalledWith(4, expect.stringContaining('from background_task'), ['task-1'])
    expect(result).toEqual(
      new Map([
        ['comment-note', { state: 'pending_review', url: '/admin/comments?commentId=41' }],
        ['duplicate-note', { state: 'pending_review', url: '/admin/comments?commentId=41' }],
        ['another-comment', { state: 'handled', url: '/admin/comments?commentId=42' }],
        ['guestbook-note', { state: 'awaiting_reply', url: '/admin/guestbook?focus=41' }],
        ['moment-note', { state: 'available', url: '/admin/moments?comments=moment-3&commentId=41' }],
        ['task-note', { state: 'failed', url: '/admin/operations?task=task-1' }],
      ]),
    )
  })

  it.each(['comment', 'guestbook', 'moment-comment', 'task'] as const)(
    '%s 的业务记录缺失时保留通知并隐藏链接',
    async (kind) => {
      const em = { execute: jest.fn().mockResolvedValue([]) }

      const result = await resolveNotificationTargets(em as unknown as EntityManager, [
        { id: 'notification-1', kind, sourceId: 'missing' },
      ])

      expect(result.get('notification-1')).toEqual({ state: 'unavailable', url: null })
      expect(em.execute).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['comment', 'guestbook', 'moment-comment', 'task'] as const)(
    '%s 的业务状态不可用时不生成可点击目标',
    async (kind) => {
      const em = { execute: jest.fn().mockResolvedValue([{ id: '41', state: 'unavailable', parent: 'moment-3' }]) }

      const result = await resolveNotificationTargets(em as unknown as EntityManager, [
        { id: 'notification-1', kind, sourceId: '41' },
      ])

      expect(result.get('notification-1')).toEqual({ state: 'unavailable', url: null })
    },
  )

  it.each<NotificationTarget['state']>(['pending_review', 'awaiting_reply', 'available', 'handled', 'failed'])(
    '保持查询返回的 %s 状态，不受通知是否已读影响',
    async (state) => {
      const em = { execute: jest.fn().mockResolvedValue([{ id: '41', state }]) }

      const result = await resolveNotificationTargets(em as unknown as EntityManager, [
        { id: 'notification-1', kind: 'comment', sourceId: '41' },
      ])

      expect(result.get('notification-1')).toEqual({ state, url: '/admin/comments?commentId=41' })
    },
  )

  it('来源编号仅进入绑定参数，不插值进入 SQL', async () => {
    const sourceId = "41') or true --"
    const em = { execute: jest.fn().mockResolvedValue([]) }

    await resolveNotificationTargets(em as unknown as EntityManager, [
      { id: 'notification-1', kind: 'comment', sourceId },
    ])

    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.execute).toHaveBeenCalledWith(expect.stringContaining('where c.id::text in (?)'), [sourceId])
    expect(em.execute.mock.calls[0]?.[0]).not.toContain(sourceId)
  })

  it('业务查询失败向上传播，不返回伪造的不可用状态', async () => {
    const failure = new Error('目标查询失败')
    const em = { execute: jest.fn().mockRejectedValue(failure) }

    await expect(
      resolveNotificationTargets(em as unknown as EntityManager, [
        { id: 'notification-1', kind: 'guestbook', sourceId: '41' },
      ]),
    ).rejects.toBe(failure)
  })
})
