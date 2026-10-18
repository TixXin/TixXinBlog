/** @file task-runner.spec.ts @description 以隔离依赖验证任务领取、租约、代次与外部副作用的收尾边界，不连接数据库或 SMTP */
import type { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import nodemailer from 'nodemailer'
import type { BackgroundTaskKind } from '../../entities/background-task.entity'
import { readOperationConfig } from './operation-config'
import { recordOwnerEvent } from './owner-events'
import { resolveNotificationTargets } from './notification-targets'
import { performWorkerBackup } from './worker-backup'
import { runTaskOnce, scheduleBackup, setOperationPaused } from './task-runner'

jest.mock('nodemailer', () => ({ __esModule: true, default: { createTransport: jest.fn() } }))
jest.mock('./owner-events', () => ({ recordOwnerEvent: jest.fn() }))
jest.mock('./notification-targets', () => ({ resolveNotificationTargets: jest.fn() }))
jest.mock('./worker-backup', () => ({ performWorkerBackup: jest.fn() }))

const taskId = 'b083746d-e563-4f84-b420-962de58dd56e'
const generation = 'a7162917-9938-48eb-a872-886439f03d90'
const notificationId = '2573bb6e-94a5-4b48-b174-82b2450a363b'
const notification = { id: notificationId, kind: 'comment', sourceId: '23', reason: 'created' }
const backupResult = {
  generated: true,
  integrityVerified: true,
  manifestVersion: 1,
  databaseBytes: 1024,
  mediaFiles: 2,
  snapshotAt: '2026-10-18T00:00:00.000Z',
  transfer: { configured: false, verified: false },
  retainedCleanupCount: 0,
  backupId: `${taskId}-1`,
}
const sendMail = jest.fn()
const close = jest.fn()

function config() {
  return readOperationConfig({
    NOTIFICATION_EMAIL_ENABLED: 'true',
    NOTIFICATION_SMTP_HOST: 'smtp.example.com',
    NOTIFICATION_EMAIL_FROM: 'blog@example.com',
    NOTIFICATION_EMAIL_TO: 'owner@example.com',
    NOTIFICATION_SITE_URL: 'https://blog.example.com',
    BACKUP_SCHEDULE_ENABLED: 'true',
    BACKUP_DIRECTORY: '/isolated-backup-fixture',
    BACKUP_OWNER_ID: '3f4cc65f-5632-4a48-a82a-53f6b7fd2d51',
  })
}

function task(attempts = 1, maxAttempts = 3) {
  return { id: taskId, generation, payload: { notificationId }, attempts, max_attempts: maxAttempts }
}

function database() {
  // 未声明的查询直接失败，避免缺少断言的分支默默取得模拟成功结果。
  const execute = jest.fn<Promise<unknown[]>, [string, unknown[]?]>().mockRejectedValue(new Error('未安排的查询'))
  const manager = {
    execute,
    transactional: jest.fn(async (callback: (em: EntityManager) => Promise<unknown>) =>
      callback(manager as unknown as EntityManager),
    ),
  }
  const locked = {
    execute: jest.fn().mockResolvedValue([{ owned: true }]),
    transactional: jest.fn(async (callback: (em: EntityManager) => Promise<unknown>) =>
      callback(locked as unknown as EntityManager),
    ),
  }
  const fork = jest.fn().mockReturnValueOnce(locked).mockReturnValue(manager)
  return {
    orm: { em: { fork } } as unknown as MikroORM,
    manager,
    locked,
    fork,
    execute,
    replies(...rows: unknown[][]) {
      for (const row of rows) execute.mockResolvedValueOnce(row)
    },
  }
}

function readyDatabase(attempts = 1, maxAttempts = 3) {
  const db = database()
  db.replies([], [{ count: 0 }], [{ paused: false, generation, limited: false }], [task(attempts, maxAttempts)])
  return db
}

function failureWrite(db: ReturnType<typeof database>) {
  const call = db.execute.mock.calls.find(([query]) => query.includes('set state=?,error_code=?,result='))
  expect(call).toBeDefined()
  return call!
}

function successWrite(db: ReturnType<typeof database>) {
  const call = db.execute.mock.calls.find(([query]) => query.includes("set state='succeeded'"))
  expect(call).toBeDefined()
  return call!
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  sendMail.mockResolvedValue({ accepted: ['owner@example.com'], rejected: [] })
  jest
    .mocked(nodemailer.createTransport)
    .mockReturnValue({ sendMail, close } as unknown as ReturnType<typeof nodemailer.createTransport>)
  jest
    .mocked(resolveNotificationTargets)
    .mockResolvedValue(new Map([[notificationId, { state: 'pending_review', url: '/admin/comments?commentId=23' }]]))
  jest.mocked(performWorkerBackup).mockResolvedValue(backupResult)
  jest.mocked(recordOwnerEvent).mockResolvedValue(undefined)
})

afterEach(() => {
  expect(jest.getTimerCount()).toBe(0)
  jest.useRealTimers()
})

describe('运行控制与备份登记', () => {
  it.each<BackgroundTaskKind>(['mail', 'backup'])('暂停 %s 时用调用方版本比较更新', async (kind) => {
    const db = database()
    const row = { revision: 8, generation }
    db.fork.mockReset().mockReturnValue(db.manager)
    db.replies([row])

    await expect(setOperationPaused(db.orm, kind, true, 7)).resolves.toBe(row)
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining(`set ${kind === 'mail' ? 'external_paused' : 'backup_paused'}=?`),
      [true, 'operator_paused', 7],
    )
    expect(db.execute.mock.calls[0]![0]).toContain("where id='default' and revision=?")
  })

  it('控制版本过期拒绝启用，不能报告成功', async () => {
    const db = database()
    db.fork.mockReset().mockReturnValue(db.manager)
    db.replies([])
    await expect(setOperationPaused(db.orm, 'mail', false, 4)).rejects.toThrow('运行控制版本已改变')
    expect(db.execute.mock.calls[0]![1]).toEqual([false, 'operator_enabled', 4])
  })

  it.each(['disabled', 'missing'])('备份配置 %s 时不登记任务', async (mode) => {
    const settings = config()
    if (mode === 'disabled') settings.backup.enabled = false
    else settings.backup.missing = ['BACKUP_DIRECTORY']
    const db = database()
    await expect(scheduleBackup(db.orm, settings)).resolves.toEqual({ state: 'disabled' })
    expect(db.fork).not.toHaveBeenCalled()
  })

  it('同一 UTC 时间槽用相同键并交给数据库按代次去重，边界进入下一槽', async () => {
    const db = database()
    db.fork.mockReset().mockReturnValue(db.manager)
    db.replies([{ id: taskId }], [], [{ id: 'next-task' }])
    const settings = config()
    settings.backup.intervalMinutes = 1
    const first = new Date('2026-10-18T00:00:00.000Z')
    await expect(scheduleBackup(db.orm, settings, first)).resolves.toEqual({ state: 'queued', taskId })
    await expect(scheduleBackup(db.orm, settings, new Date(first.getTime() + 59_999))).resolves.toEqual({
      state: 'paused_or_existing',
    })
    await expect(scheduleBackup(db.orm, settings, new Date(first.getTime() + 60_000))).resolves.toEqual({
      state: 'queued',
      taskId: 'next-task',
    })
    const calls = db.execute.mock.calls
    expect(calls[0]![1]![1]).toBe(calls[1]![1]![1])
    expect(Number(calls[2]![1]![1])).toBe(Number(calls[0]![1]![1]) + 1)
    expect(calls[0]![0]).toContain("'backup:'||generation::text||':'||?")
    expect(calls[0]![0]).toContain('backup_paused=false on conflict(dedupe_key) do nothing')
  })
})

describe('任务领取与执行前边界', () => {
  it.each<BackgroundTaskKind>(['mail', 'backup'])('%s 未启用或缺配置时不获取连接', async (kind) => {
    for (const mode of ['disabled', 'missing']) {
      const settings = config()
      const channel = kind === 'mail' ? settings.email : settings.backup
      if (mode === 'disabled') channel.enabled = false
      else channel.missing = ['required']
      const db = database()
      await expect(runTaskOnce(db.orm, settings, kind)).resolves.toEqual({ state: 'disabled' })
      expect(db.fork).not.toHaveBeenCalled()
    }
  })

  it('同类事务锁被占用时不检查或领取任务', async () => {
    const db = database()
    db.locked.execute.mockResolvedValue([{ owned: false }])
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({ state: 'busy' })
    expect(db.fork).toHaveBeenCalledTimes(1)
    expect(db.execute).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it.each<BackgroundTaskKind>(['mail', 'backup'])('%s 仍有有效 running 任务时不领取另一项', async (kind) => {
    const db = database()
    db.replies([], [{ count: 1 }])
    await expect(runTaskOnce(db.orm, config(), kind)).resolves.toEqual({ state: 'busy' })
    expect(db.execute).toHaveBeenCalledTimes(2)
    expect(performWorkerBackup).not.toHaveBeenCalled()
  })

  it.each([
    ['mail', 'uncertain', 'smtp_interrupted_unknown', 'delivery_uncertain'],
    ['backup', 'failed', 'backup_interrupted', 'backup_failed'],
  ] as const)('%s 过期租约终结并产生站内事件，不自动恢复原任务', async (kind, state, code, reason) => {
    const db = database()
    db.replies([{ id: 'expired-task' }], [{ count: 0 }], [{ paused: true, generation }])
    await expect(runTaskOnce(db.orm, config(), kind)).resolves.toEqual({ state: 'paused' })
    expect(db.execute.mock.calls[0]![1]).toEqual([state, code, kind])
    expect(db.execute.mock.calls[0]![0]).toContain('(lease_until is null or lease_until<now())')
    expect(recordOwnerEvent).toHaveBeenCalledWith(db.manager, 'task', 'expired-task', reason)
    expect(sendMail).not.toHaveBeenCalled()
    expect(performWorkerBackup).not.toHaveBeenCalled()
  })

  it.each([{ rows: [] }, { rows: [{ paused: true, generation, limited: false }] }])(
    '控制记录缺失或暂停时不领取任务',
    async ({ rows }) => {
      const db = database()
      db.replies([], [{ count: 0 }], rows)
      await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({ state: 'paused' })
      expect(db.execute).toHaveBeenCalledTimes(3)
    },
  )

  it('邮件持久限频时保持待执行任务不变', async () => {
    const db = database()
    db.replies([], [{ count: 0 }], [{ paused: false, generation, limited: true }])
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({ state: 'rate_limited' })
    expect(db.execute).toHaveBeenCalledTimes(3)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('备份不受邮件限频影响，领取只允许当前代次到期且未耗尽的排队任务', async () => {
    const db = database()
    db.replies([], [{ count: 0 }], [{ paused: false, generation, limited: true }], [])
    await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({ state: 'idle' })
    const [query, parameters] = db.execute.mock.calls[3]!
    expect(query).toContain(
      "state in ('queued','retry') and generation=? and available_at<=now() and attempts<max_attempts",
    )
    expect(query).toContain('for update skip locked limit 1')
    expect(parameters).toEqual([expect.any(String), 300, 'backup', generation])
    expect(performWorkerBackup).not.toHaveBeenCalled()
  })

  it.each([{ authorization: [] }, { authorization: [{ allowed: false }] }])(
    '领取后控制失效时撤销租约，不执行外部操作',
    async ({ authorization }) => {
      const db = readyDatabase()
      db.replies(authorization, [])
      await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({ state: 'paused', taskId })
      const [query, parameters] = db.execute.mock.calls[5]!
      expect(query).toContain("state='paused',error_code='operation_paused',lease_token=null,lease_until=null")
      expect(parameters).toEqual([taskId, db.execute.mock.calls[3]![1]![0]])
      expect(performWorkerBackup).not.toHaveBeenCalled()
    },
  )
})

describe('任务结果与失败收尾', () => {
  it('成功结果只有持有原租约且运行代次未变时才完成', async () => {
    const db = readyDatabase(2)
    const settings = config()
    db.replies([{ allowed: true }], [{ id: taskId }])
    await expect(runTaskOnce(db.orm, settings, 'backup')).resolves.toEqual({ state: 'succeeded', taskId })
    expect(performWorkerBackup).toHaveBeenCalledWith(settings, taskId, 2)
    const [query, parameters] = successWrite(db)
    expect(query).toContain(
      "where id=? and lease_token=? and generation=(select generation from operation_control where id='default')",
    )
    expect(query).toContain('lease_token=null,lease_until=null')
    expect(parameters).toEqual([JSON.stringify(backupResult), taskId, db.execute.mock.calls[3]![1]![0]])
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('副作用成功但租约或代次已失效时返回 uncertain，不宣称完成', async () => {
    const db = readyDatabase()
    db.replies([{ allowed: true }], [])
    await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({ state: 'uncertain', taskId })
    expect(recordOwnerEvent).not.toHaveBeenCalled()
    expect(performWorkerBackup).toHaveBeenCalledTimes(1)
  })

  it.each([
    [1, 3, 'retry', 30],
    [2, 3, 'retry', 60],
    [3, 3, 'failed', 120],
    [12, 20, 'retry', 3600],
  ])('备份第 %i/%i 次失败进入 %s，退避 %i 秒', async (attempts, maxAttempts, state, delay) => {
    const db = readyDatabase(Number(attempts), Number(maxAttempts))
    db.replies([{ allowed: true }], [{ id: taskId }])
    const operationResult = { generated: true, integrityVerified: true, transferred: false }
    jest.mocked(performWorkerBackup).mockRejectedValue(
      Object.assign(new Error('private-token=/private/path'), {
        operationCode: 'backup_transfer_failed',
        operationResult,
      }),
    )
    await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({
      state,
      taskId,
      errorCode: 'backup_transfer_failed',
    })
    const [query, parameters] = failureWrite(db)
    expect(parameters).toEqual([
      state,
      'backup_transfer_failed',
      JSON.stringify(operationResult),
      delay,
      state,
      taskId,
      db.execute.mock.calls[3]![1]![0],
    ])
    expect(query).toContain("finished_at=case when ?='retry' then null else now() end")
    expect(query).toContain("generation=(select generation from operation_control where id='default')")
    expect(JSON.stringify(parameters)).not.toContain('private-token')
    expect(recordOwnerEvent).toHaveBeenCalledWith(db.manager, 'task', taskId, 'backup_failed')
  })

  it('失败收尾丢失租约时返回 uncertain，不能登记其他执行器的失败通知', async () => {
    const db = readyDatabase()
    db.replies([{ allowed: true }], [])
    jest.mocked(performWorkerBackup).mockRejectedValue(new Error('失败'))
    await expect(runTaskOnce(db.orm, config(), 'backup')).resolves.toEqual({
      state: 'uncertain',
      taskId,
      errorCode: 'backup_execution_failed',
    })
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('失败状态无法持久化时向调用方传播错误并清理心跳', async () => {
    const db = readyDatabase()
    db.replies([{ allowed: true }])
    const unavailable = new Error('状态存储不可用')
    db.execute.mockRejectedValueOnce(unavailable)
    jest.mocked(performWorkerBackup).mockRejectedValue(new Error('执行失败'))
    await expect(runTaskOnce(db.orm, config(), 'backup')).rejects.toBe(unavailable)
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })
})

describe('邮件投递与不确定结果', () => {
  function mailDatabase(attempts = 1) {
    const db = readyDatabase(attempts)
    db.replies([{ allowed: true }], [], [notification])
    return db
  }

  it('指定收件人被接受后记录稳定 Message-ID，邮件仅包含类型和后台入口', async () => {
    const db = mailDatabase()
    db.replies([{ id: taskId }])
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({ state: 'succeeded', taskId })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'blog@example.com',
      to: 'owner@example.com',
      subject: '博客互动：收到新的文章评论',
      text: `收到新的文章评论。请登录后台查看当前审核和回复状态。\nhttps://blog.example.com/admin/notifications?notification=${notificationId}`,
      messageId: `<tixxin-${taskId}@blog.example.com>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, ignoreTLS: false, disableFileAccess: true, disableUrlAccess: true }),
    )
    expect(JSON.parse(successWrite(db)[1]![0] as string)).toEqual({
      accepted: true,
      messageId: `<tixxin-${taskId}@blog.example.com>`,
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it.each(['handled', 'unavailable', 'missing'] as const)('当前通知目标 %s 时成功抑制投递', async (state) => {
    const db = mailDatabase()
    db.replies([{ id: taskId }])
    jest
      .mocked(resolveNotificationTargets)
      .mockResolvedValue(state === 'missing' ? new Map() : new Map([[notificationId, { state, url: null }]]))
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({ state: 'succeeded', taskId })
    expect(JSON.parse(successWrite(db)[1]![0] as string)).toEqual({
      suppressed: true,
      reason: state === 'missing' ? 'unavailable' : state,
    })
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it.each([
    ['临时拒收', { responseCode: 450 }, 1, 'retry', 'smtp_temporary_rejection'],
    ['耗尽重试', { responseCode: 450 }, 3, 'failed', 'smtp_temporary_rejection'],
    ['永久拒收', { responseCode: 550 }, 1, 'failed', 'smtp_permanent_rejection'],
    ['DATA 后断线', { code: 'ECONNECTION', command: 'CONN' }, 1, 'uncertain', 'smtp_acceptance_unknown'],
  ] as const)('%s 时按投递结果收尾并关闭传输', async (_label, error, attempts, state, code) => {
    const db = mailDatabase(attempts)
    db.replies([{ id: taskId }])
    sendMail.mockRejectedValue(Object.assign(new Error('private-address@example.com'), error))
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({ state, taskId, errorCode: code })
    expect(failureWrite(db)[1]!.slice(0, 3)).toEqual([state, code, 'null'])
    expect(recordOwnerEvent).toHaveBeenCalledWith(db.manager, 'task', taskId, code)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it.each([
    { accepted: [], rejected: [] },
    { accepted: ['owner@example.com'], rejected: ['owner@example.com'] },
  ])('未明确接受唯一收件目标时不得记录 accepted', async (result) => {
    const db = mailDatabase()
    db.replies([{ id: taskId }])
    sendMail.mockResolvedValue(result)
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({
      state: 'failed',
      taskId,
      errorCode: 'smtp_configuration_rejected',
    })
    expect(failureWrite(db)[1]![2]).toBe('null')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('SMTP 已接受后数据库 connect 失败仍为 uncertain，保留接收证据并禁止自动重试', async () => {
    const db = mailDatabase()
    db.execute.mockRejectedValueOnce(Object.assign(new Error('数据库断线'), { syscall: 'connect' }))
    db.replies([{ id: taskId }])
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({
      state: 'uncertain',
      taskId,
      errorCode: 'smtp_result_not_recorded',
    })
    const parameters = failureWrite(db)[1]!
    expect(parameters[0]).toBe('uncertain')
    expect(JSON.parse(parameters[2] as string)).toEqual({
      accepted: true,
      messageId: `<tixxin-${taskId}@blog.example.com>`,
    })
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('邮件通知源缺失时直接失败，不创建 SMTP 连接', async () => {
    const db = readyDatabase()
    db.replies([{ allowed: true }], [], [], [{ id: taskId }])
    await expect(runTaskOnce(db.orm, config(), 'mail')).resolves.toEqual({
      state: 'failed',
      taskId,
      errorCode: 'smtp_configuration_rejected',
    })
    expect(resolveNotificationTargets).not.toHaveBeenCalled()
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
  })
})

describe('任务心跳', () => {
  it.each([true, false])('心跳失败后完成写入=%s，保留最终状态并停止定时器', async (completed) => {
    const db = readyDatabase()
    db.replies([{ allowed: true }])
    db.execute.mockRejectedValueOnce(new Error('心跳写入失败'))
    db.replies(completed ? [{ id: taskId }] : [])
    let finish!: (value: typeof backupResult) => void
    jest.mocked(performWorkerBackup).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const running = runTaskOnce(db.orm, config(), 'backup')
    await jest.advanceTimersByTimeAsync(60_000)
    expect(performWorkerBackup).toHaveBeenCalledTimes(1)
    const heartbeat = db.execute.mock.calls.find(([query]) =>
      query.startsWith('update background_task set lease_until='),
    )
    expect(heartbeat?.[1]).toEqual([300, taskId, db.execute.mock.calls[3]![1]![0]])
    finish(backupResult)
    await expect(running).resolves.toEqual(
      completed ? { state: 'succeeded', taskId } : { state: 'uncertain', taskId, errorCode: 'task_heartbeat_failed' },
    )
  })
})
