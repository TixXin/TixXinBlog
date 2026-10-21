/** @file operations.service.spec.ts @description 运维任务查询、脱敏摘要、存储指标与事务级重试的单元测试。 */
import { EntityManager } from '@mikro-orm/postgresql'
import { statfs } from 'node:fs/promises'
import { readOperationConfig } from './operation-config'
import { OperationsService } from './operations.service'

jest.mock('node:fs/promises', () => ({ statfs: jest.fn() }))
jest.mock('./operation-config', () => ({
  ...jest.requireActual('./operation-config'),
  readOperationConfig: jest.fn(),
}))

const taskId = 'bc011b89-3150-4058-bdaf-b1b17df27ce4'
const generation = '51b5f86d-5db1-4295-82e5-169a917d34ae'
const now = new Date('2026-10-18T12:00:00.000Z')

function setup() {
  const execute = jest.fn()
  const transactionExecute = jest.fn()
  const transaction = { execute: transactionExecute } as unknown as EntityManager
  const transactional = jest.fn((work: (em: EntityManager) => Promise<unknown>) => work(transaction))
  const service = new OperationsService({ execute, transactional } as unknown as EntityManager)
  const config = jest.requireActual<typeof import('./operation-config')>('./operation-config').readOperationConfig({})
  jest.mocked(readOperationConfig).mockReturnValue(config)
  jest
    .mocked(statfs)
    .mockResolvedValue({ bavail: 50, bsize: 1024 ** 3, blocks: 100 } as Awaited<ReturnType<typeof statfs>>)
  return { execute, transactionExecute, transactional, service, config }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(now)
})
afterEach(() => jest.useRealTimers())

describe('OperationsService 任务查询与部分失败', () => {
  it('任务响应只暴露允许的摘要，结果标记必须是布尔 true', async () => {
    const { service, execute } = setup()
    execute.mockResolvedValue([
      {
        id: taskId,
        kind: 'backup',
        state: 'succeeded',
        attempts: 1,
        max_attempts: 3,
        error_code: null,
        payload: { password: 'private-password' },
        lease_token: 'private-lease',
        result: {
          accepted: 'true',
          suppressed: true,
          integrityVerified: true,
          recoveryVerified: false,
          directory: '/private/backup',
          transfer: { configured: true, verified: 1, token: 'private-token' },
        },
      },
    ])
    expect(await service.getTask(taskId)).toEqual({
      id: taskId,
      kind: 'backup',
      state: 'succeeded',
      attempts: 1,
      maxAttempts: 3,
      availableAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      createdAt: undefined,
      errorCode: null,
      outcome: {
        accepted: false,
        suppressed: true,
        integrityVerified: true,
        transferVerified: false,
        transferConfigured: true,
        recoveryVerified: false,
      },
    })
    expect(execute).toHaveBeenCalledWith(expect.any(String), [taskId])
  })

  it('任务不存在返回 404，未完成任务保留空结果', async () => {
    const { service, execute } = setup()
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: taskId, result: null }])
    await expect(service.getTask(taskId)).rejects.toMatchObject({ status: 404 })
    await expect(service.getTask(taskId)).resolves.toMatchObject({ id: taskId, outcome: null })
  })

  it.each(['query', 'control', 'counts'])('数据库 %s 不可用时保留存储摘要且不伪造零统计', async (failure) => {
    const { service, execute } = setup()
    if (failure === 'query') execute.mockRejectedValue(new Error('private database credentials'))
    else execute.mockResolvedValueOnce(failure === 'control' ? [] : [{ backupPaused: false }]).mockResolvedValue([])
    const result = await service.getStatus(1)
    expect(result).toMatchObject({
      databaseAvailable: false,
      runtime: null,
      backupOverdue: false,
      storage: { availableBytes: 50 * 1024 ** 3, totalBytes: 100 * 1024 ** 3, low: false },
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('存储失败仍保留实际数据库统计与分页，任务列表同样脱敏', async () => {
    const { service, execute } = setup()
    jest.mocked(statfs).mockRejectedValue(new Error('/private/media'))
    execute
      .mockResolvedValueOnce([{ backupPaused: true, revision: 2 }])
      .mockResolvedValueOnce([{ id: taskId, result: null, payload: { secret: 'private-payload' } }])
      .mockResolvedValueOnce([{ total: 42, failures: 3, lastVerifiedBackup: null, lastRecovery: now }])
    const result = await service.getStatus(3)
    expect(result).toMatchObject({
      databaseAvailable: true,
      storage: null,
      runtime: { total: 42, failures: 3, lastRecovery: now, tasks: [{ id: taskId, outcome: null }] },
      page: 3,
      pageSize: 20,
      generatedAt: now.toISOString(),
    })
    expect(execute).toHaveBeenNthCalledWith(2, expect.any(String), [40])
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it.each([
    { enabled: true, paused: false, age: null, overdue: true },
    { enabled: true, paused: false, age: 120_000, overdue: false },
    { enabled: true, paused: false, age: 120_001, overdue: true },
    { enabled: false, paused: false, age: null, overdue: false },
    { enabled: true, paused: true, age: null, overdue: false },
  ])('仅启用且未暂停的备份按两倍周期判断超期 %j', async ({ enabled, paused, age, overdue }) => {
    const { service, execute, config } = setup()
    config.backup.enabled = enabled
    config.backup.intervalMinutes = 1
    execute
      .mockResolvedValueOnce([{ backupPaused: paused }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 0, failures: 0, lastVerifiedBackup: age === null ? null : new Date(+now - age) },
      ])
    expect((await service.getStatus(1)).backupOverdue).toBe(overdue)
  })

  it.each([
    { bavail: 0, bsize: 1, blocks: 0, low: true },
    { bavail: 1, bsize: 1024 ** 3 - 1, blocks: 10, low: true },
    { bavail: 1, bsize: 1024 ** 3, blocks: 20, low: false },
    { bavail: 1, bsize: 1024 ** 3, blocks: 21, low: true },
  ])('磁盘低空间同时考虑绝对字节数和比例 %j', async ({ low, ...stat }) => {
    const { service, execute } = setup()
    execute.mockResolvedValue([])
    jest.mocked(statfs).mockResolvedValue(stat as Awaited<ReturnType<typeof statfs>>)
    expect((await service.getStatus(1)).storage?.low).toBe(low)
  })
})

describe('OperationsService 人工重试事务', () => {
  it.each([
    { label: '运行控制缺失', control: null, task: null },
    { label: '任务缺失', control: {}, task: null },
    { label: '状态变化', control: {}, task: { state: 'running', attempts: 1 } },
    { label: '次数变化', control: {}, task: { state: 'failed', attempts: 2 } },
    { label: '邮件暂停', control: { external_paused: true }, task: { kind: 'mail', state: 'failed', attempts: 1 } },
    { label: '备份暂停', control: { backup_paused: true }, task: { kind: 'backup', state: 'failed', attempts: 1 } },
  ])('$label 时拒绝重试且不更新任务', async ({ control, task }) => {
    const { service, transactionExecute, execute } = setup()
    transactionExecute.mockResolvedValueOnce(control ? [control] : []).mockResolvedValueOnce(task ? [task] : [])
    await expect(service.retryTask(taskId, 'failed', 1)).rejects.toMatchObject({ status: 409 })
    expect(transactionExecute).toHaveBeenCalledTimes(control ? 2 : 1)
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    { state: 'failed', kind: 'backup' },
    { state: 'uncertain', kind: 'mail' },
    { state: 'restored', kind: 'mail' },
  ] as const)('$state 重试绑定当前代次并重置租约，另一通道暂停不阻止操作', async ({ state, kind }) => {
    const { service, transactionExecute } = setup()
    transactionExecute
      .mockResolvedValueOnce(
        { mail: [{ generation, backup_paused: true }], backup: [{ generation, external_paused: true }] }[kind],
      )
      .mockResolvedValueOnce([{ kind, state, attempts: 4 }])
      .mockResolvedValueOnce([{ id: taskId, state: 'queued' }])

    await expect(service.retryTask(taskId, state, 4)).resolves.toEqual({ id: taskId, state: 'queued' })
    expect(transactionExecute).toHaveBeenNthCalledWith(1, expect.stringContaining('for update'))
    expect(transactionExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('for update'), [taskId])
    expect(transactionExecute).toHaveBeenNthCalledWith(3, expect.stringContaining("state='queued'"), [
      generation,
      taskId,
    ])
    const update = transactionExecute.mock.calls[2]![0] as string
    for (const fragment of [
      'max_attempts=attempts+3',
      'finished_at=null',
      'error_code=null',
      'lease_token=null',
      'lease_until=null',
    ])
      expect(update).toContain(fragment)
  })
})
