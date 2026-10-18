/** @file owner-events.spec.ts @description 博主事件稳定去重、邮件入队开关和异步隔离上下文，不执行数据库或外部投递 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { recordOwnerEvent, withoutExternalNotifications, withoutOwnerEvents } from './owner-events'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function manager() {
  const execute = jest.fn().mockResolvedValue([{ id: 'notification-1' }])
  return { execute, em: { execute } as unknown as EntityManager }
}

beforeEach(() => {
  jest.replaceProperty(process, 'env', { ...process.env, NOTIFICATION_EMAIL_ENABLED: 'true' })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('博主事件与邮件出箱', () => {
  it('以业务类型和编号生成稳定去重键，邮件载荷仅包含通知编号', async () => {
    const { em, execute } = manager()

    await recordOwnerEvent(em, 'comment', 41, 'comment_created')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('on conflict (event_key) do nothing returning id'),
      [expect.stringMatching(uuid), 'comment:41', 'comment', '41', 'comment_created'],
    )
    expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining('on conflict (dedupe_key) do nothing'), [
      expect.stringMatching(uuid),
      'mail:comment:41',
      true,
      JSON.stringify({ notificationId: 'notification-1' }),
    ])
    expect(execute.mock.calls[1]?.[0]).toContain("case when external_paused or ?=false then 'paused' else 'queued' end")
    expect(execute.mock.calls[1]?.[0]).toContain("from operation_control where id='default'")
  })

  it('事件后缀参与站内与邮件去重，保留来源编号原值', async () => {
    const { em, execute } = manager()

    await recordOwnerEvent(em, 'guestbook', '0041', 'guestbook_updated', 'revision-2')

    expect(execute.mock.calls[0]?.[1]).toEqual([
      expect.stringMatching(uuid),
      'guestbook:0041:revision-2',
      'guestbook',
      '0041',
      'guestbook_updated',
    ])
    expect(execute.mock.calls[1]?.[1]?.[1]).toBe('mail:guestbook:0041:revision-2')
  })

  it('重复事件未插入时不创建第二个邮件任务', async () => {
    const { em, execute } = manager()
    execute.mockResolvedValueOnce([])

    await recordOwnerEvent(em, 'comment', 41, 'comment_created')

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['true', true],
    ['false', false],
    ['TRUE', false],
    [undefined, false],
  ] as const)('邮件环境开关为 %s 时传递启用标记 %s', async (enabled, deliver) => {
    if (enabled === undefined) delete process.env.NOTIFICATION_EMAIL_ENABLED
    else process.env.NOTIFICATION_EMAIL_ENABLED = enabled
    const { em, execute } = manager()

    await recordOwnerEvent(em, 'moment-comment', 41, 'comment_created')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]?.[1]?.[2]).toBe(deliver)
  })

  it.each(['mail_failed', 'mail_uncertain', 'mail_restored'])('%s 只记录站内事件，避免递归邮件告警', async (reason) => {
    const { em, execute } = manager()

    await recordOwnerEvent(em, 'task', 'task-1', reason)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]?.[1]).toEqual([expect.stringMatching(uuid), 'task:task-1', 'task', 'task-1', reason])
  })

  it('备份失败可以创建邮件告警任务', async () => {
    const { em, execute } = manager()

    await recordOwnerEvent(em, 'task', 'task-1', 'backup_failed')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]?.[1]?.[1]).toBe('mail:task:task-1')
  })

  it('事件写入失败时不继续入队', async () => {
    const failure = new Error('事件写入失败')
    const { em, execute } = manager()
    execute.mockRejectedValueOnce(failure)

    await expect(recordOwnerEvent(em, 'comment', 41, 'comment_created')).rejects.toBe(failure)

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('邮件入队失败向上传播，由业务事务决定回滚', async () => {
    const failure = new Error('邮件入队失败')
    const { em, execute } = manager()
    execute.mockResolvedValueOnce([{ id: 'notification-1' }]).mockRejectedValueOnce(failure)

    await expect(recordOwnerEvent(em, 'comment', 41, 'comment_created')).rejects.toBe(failure)

    expect(execute).toHaveBeenCalledTimes(2)
  })
})

describe('事件隔离上下文', () => {
  it('关闭外部通知仍保留站内事件，邮件入队标记暂停并返回工作结果', async () => {
    const { em, execute } = manager()

    const result = await withoutExternalNotifications(async () => {
      await Promise.resolve()
      await recordOwnerEvent(em, 'comment', 41, 'comment_created')
      return '已导入'
    })

    expect(result).toBe('已导入')
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[1]?.[1]?.[2]).toBe(false)
  })

  it('关闭博主事件时完全不写入通知或邮件，并保留工作结果', async () => {
    const { em, execute } = manager()

    const result = await withoutOwnerEvents(async () => {
      await Promise.resolve()
      await recordOwnerEvent(em, 'guestbook', 41, 'guestbook_created')
      return 41
    })

    expect(result).toBe(41)
    expect(execute).not.toHaveBeenCalled()
  })

  it('并行的正常业务不继承另一个异步调用的事件屏蔽', async () => {
    const suppressed = manager()
    const normal = manager()
    let release!: () => void
    const resumed = new Promise<void>((resolve) => {
      release = resolve
    })
    const work = withoutOwnerEvents(async () => {
      await resumed
      await recordOwnerEvent(suppressed.em, 'comment', 41, 'comment_created')
    })

    try {
      await recordOwnerEvent(normal.em, 'comment', 42, 'comment_created')
    } finally {
      release()
      await work
    }

    expect(suppressed.execute).not.toHaveBeenCalled()
    expect(normal.execute).toHaveBeenCalledTimes(2)
    expect(normal.execute.mock.calls[1]?.[1]?.[2]).toBe(true)
  })

  it.each([withoutExternalNotifications, withoutOwnerEvents])(
    '隔离工作失败后恢复后续业务的默认上下文',
    async (isolate) => {
      const failure = new Error('导入失败')
      const { em, execute } = manager()

      await expect(
        isolate(async () => {
          await Promise.resolve()
          throw failure
        }),
      ).rejects.toBe(failure)
      await recordOwnerEvent(em, 'comment', 41, 'comment_created')

      expect(execute).toHaveBeenCalledTimes(2)
      expect(execute.mock.calls[1]?.[1]?.[2]).toBe(true)
    },
  )
})
