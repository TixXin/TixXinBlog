/** @file operations.controller.spec.ts @description 运维入口参数、脱敏摘要与人工重试冲突的无数据库单元测试。 */
import 'reflect-metadata'
import { EntityManager } from '@mikro-orm/postgresql'
import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA, PARAMTYPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { statfs } from 'node:fs/promises'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { readOperationConfig } from './operation-config'
import { OperationsController } from './operations.controller'

jest.mock('node:fs/promises', () => ({ statfs: jest.fn() }))
jest.mock('./operation-config', () => ({
  ...jest.requireActual('./operation-config'),
  readOperationConfig: jest.fn(),
}))

const taskId = 'bc011b89-3150-4058-bdaf-b1b17df27ce4'
const generation = '51b5f86d-5db1-4295-82e5-169a917d34ae'
const now = new Date('2026-10-18T12:00:00.000Z')
const validation = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
const acknowledgements = {
  failed: '重试失败任务',
  uncertain: '已核对未送达并承担重复投递风险',
  restored: '明确重新投递恢复前任务',
}

function validate(method: 'status' | 'retry', value: unknown) {
  // 从真实控制器读取私有 DTO，防止测试另造一套校验规则。
  const index = method === 'status' ? 0 : 1
  const metatype = Reflect.getMetadata(PARAMTYPES_METADATA, OperationsController.prototype, method)[index]
  return validation.transform(value, { type: method === 'status' ? 'query' : 'body', metatype })
}

function setup() {
  const execute = jest.fn()
  const transactionExecute = jest.fn()
  const transaction = { execute: transactionExecute } as unknown as EntityManager
  const transactional = jest.fn((work: (em: EntityManager) => Promise<unknown>) => work(transaction))
  const controller = new OperationsController({ execute, transactional } as unknown as EntityManager)
  const config = jest.requireActual<typeof import('./operation-config')>('./operation-config').readOperationConfig({})
  jest.mocked(readOperationConfig).mockReturnValue(config)
  jest
    .mocked(statfs)
    .mockResolvedValue({ bavail: 50, bsize: 1024 ** 3, blocks: 100 } as Awaited<ReturnType<typeof statfs>>)
  return { execute, transactionExecute, transactional, controller, config }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(now)
})
afterEach(() => jest.useRealTimers())

describe('运维入口参数与权限', () => {
  it('保留管理员守卫，页码默认 1 并转换合法查询字符串', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OperationsController)).toContain(AdminAuthGuard)
    await expect(validate('status', {})).resolves.toMatchObject({ page: 1 })
    await expect(validate('status', { page: '3' })).resolves.toMatchObject({ page: 3 })
  })

  it.each([{ page: '0' }, { page: '-1' }, { page: '1.5' }, { page: 'bad' }, { page: ['1', '2'] }, { extra: true }])(
    '拒绝非法分页或未知字段 %j',
    async (query) => {
      await expect(validate('status', query)).rejects.toMatchObject({ status: 400 })
    },
  )

  it.each([
    {},
    { expectedState: 'running' },
    { expectedAttempts: -1 },
    { expectedAttempts: 1.5 },
    { expectedAttempts: '1' },
    { acknowledgement: '重试' },
    { extra: true },
  ])('拒绝缺字段、非法状态、次数和确认文本 %j', async (change) => {
    const body = Object.keys(change).length
      ? { expectedState: 'failed', expectedAttempts: 0, acknowledgement: acknowledgements.failed, ...change }
      : {}
    await expect(validate('retry', body)).rejects.toMatchObject({ status: 400 })
  })

  it.each(['task', 'retry'] as const)('%s 的编号管道只接受 UUID v4', async (method) => {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, OperationsController, method) as Record<
      string,
      { data: string; pipes: ParseUUIDPipe[] }
    >
    const pipe = Object.values(params).find((param) => param.data === 'id')!.pipes[0]!
    await expect(pipe.transform(taskId, { type: 'param' })).resolves.toBe(taskId)
    for (const id of ['not-a-uuid', '../secret', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'])
      await expect(pipe.transform(id, { type: 'param' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('运维任务查询与部分失败', () => {
  it('任务响应只暴露允许的摘要，结果标记必须是布尔 true', async () => {
    const { controller, execute } = setup()
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
    expect(await controller.task(taskId)).toEqual({
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
    const { controller, execute } = setup()
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: taskId, result: null }])
    await expect(controller.task(taskId)).rejects.toMatchObject({ status: 404 })
    await expect(controller.task(taskId)).resolves.toMatchObject({ id: taskId, outcome: null })
  })

  it.each(['query', 'control', 'counts'])('数据库 %s 不可用时保留存储摘要且不伪造零统计', async (failure) => {
    const { controller, execute } = setup()
    if (failure === 'query') execute.mockRejectedValue(new Error('private database credentials'))
    else execute.mockResolvedValueOnce(failure === 'control' ? [] : [{ backupPaused: false }]).mockResolvedValue([])
    const result = await controller.status({ page: 1 })
    expect(result).toMatchObject({
      databaseAvailable: false,
      runtime: null,
      backupOverdue: false,
      storage: { availableBytes: 50 * 1024 ** 3, totalBytes: 100 * 1024 ** 3, low: false },
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('存储失败仍保留实际数据库统计与分页，任务列表同样脱敏', async () => {
    const { controller, execute } = setup()
    jest.mocked(statfs).mockRejectedValue(new Error('/private/media'))
    execute
      .mockResolvedValueOnce([{ backupPaused: true, revision: 2 }])
      .mockResolvedValueOnce([{ id: taskId, result: null, payload: { secret: 'private-payload' } }])
      .mockResolvedValueOnce([{ total: 42, failures: 3, lastVerifiedBackup: null, lastRecovery: now }])
    const result = await controller.status({ page: 3 })
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
    const { controller, execute, config } = setup()
    config.backup.enabled = enabled
    config.backup.intervalMinutes = 1
    execute
      .mockResolvedValueOnce([{ backupPaused: paused }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { total: 0, failures: 0, lastVerifiedBackup: age === null ? null : new Date(+now - age) },
      ])
    expect((await controller.status({ page: 1 })).backupOverdue).toBe(overdue)
  })

  it.each([
    { bavail: 0, bsize: 1, blocks: 0, low: true },
    { bavail: 1, bsize: 1024 ** 3 - 1, blocks: 10, low: true },
    { bavail: 1, bsize: 1024 ** 3, blocks: 20, low: false },
    { bavail: 1, bsize: 1024 ** 3, blocks: 21, low: true },
  ])('磁盘低空间同时考虑绝对字节数和比例 %j', async ({ low, ...stat }) => {
    const { controller, execute } = setup()
    execute.mockResolvedValue([])
    jest.mocked(statfs).mockResolvedValue(stat as Awaited<ReturnType<typeof statfs>>)
    expect((await controller.status({ page: 1 })).storage?.low).toBe(low)
  })
})

describe('人工重试的状态与代次约束', () => {
  it.each(Object.keys(acknowledgements) as (keyof typeof acknowledgements)[])(
    '%s 必须使用对应确认文本，错误文本不进入事务',
    async (expectedState) => {
      const { controller, transactional } = setup()
      const acknowledgement = expectedState === 'failed' ? acknowledgements.uncertain : acknowledgements.failed
      await expect(
        controller.retry(taskId, { expectedState, expectedAttempts: 1, acknowledgement }),
      ).rejects.toMatchObject({ status: 409 })
      expect(transactional).not.toHaveBeenCalled()
    },
  )

  it.each([
    { label: '运行控制缺失', control: null, task: null },
    { label: '任务缺失', control: {}, task: null },
    { label: '状态变化', control: {}, task: { state: 'running', attempts: 1 } },
    { label: '次数变化', control: {}, task: { state: 'failed', attempts: 2 } },
    { label: '邮件暂停', control: { external_paused: true }, task: { kind: 'mail', state: 'failed', attempts: 1 } },
    { label: '备份暂停', control: { backup_paused: true }, task: { kind: 'backup', state: 'failed', attempts: 1 } },
  ])('$label 时拒绝重试且不更新任务', async ({ control, task }) => {
    const { controller, transactionExecute, execute } = setup()
    transactionExecute.mockResolvedValueOnce(control ? [control] : []).mockResolvedValueOnce(task ? [task] : [])
    await expect(
      controller.retry(taskId, {
        expectedState: 'failed',
        expectedAttempts: 1,
        acknowledgement: acknowledgements.failed,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(transactionExecute).toHaveBeenCalledTimes(control ? 2 : 1)
    expect(execute).not.toHaveBeenCalled()
  })

  it.each([
    { state: 'failed', kind: 'backup' },
    { state: 'uncertain', kind: 'mail' },
    { state: 'restored', kind: 'mail' },
  ] as const)('$state 重试绑定当前代次并重置租约，另一通道暂停不阻止操作', async ({ state, kind }) => {
    const { controller, transactionExecute } = setup()
    transactionExecute
      .mockResolvedValueOnce(
        { mail: [{ generation, backup_paused: true }], backup: [{ generation, external_paused: true }] }[kind],
      )
      .mockResolvedValueOnce([{ kind, state, attempts: 4 }])
      .mockResolvedValueOnce([{ id: taskId, state: 'queued' }])
    const body = await validate('retry', {
      expectedState: state,
      expectedAttempts: 4,
      acknowledgement: acknowledgements[state],
    })
    await expect(controller.retry(taskId, body)).resolves.toEqual({ id: taskId, state: 'queued' })
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
