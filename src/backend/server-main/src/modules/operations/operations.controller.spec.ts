/** @file operations.controller.spec.ts @description 运维入口参数、守卫与服务委托的单元测试。 */
import 'reflect-metadata'
import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA, PARAMTYPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { OperationsController } from './operations.controller'
import type { OperationsService } from './operations.service'

const taskId = 'bc011b89-3150-4058-bdaf-b1b17df27ce4'
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
  const operationsService = {
    getTask: jest.fn(),
    getStatus: jest.fn(),
    retryTask: jest.fn(),
  } as unknown as OperationsService
  const controller = new OperationsController(operationsService)
  return { operationsService, controller }
}

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

describe('人工重试确认文本校验', () => {
  it.each(Object.keys(acknowledgements) as (keyof typeof acknowledgements)[])(
    '%s 必须使用对应确认文本，错误文本不进入服务',
    async (expectedState) => {
      const { controller, operationsService } = setup()
      const acknowledgement = expectedState === 'failed' ? acknowledgements.uncertain : acknowledgements.failed
      await expect(
        controller.retry(taskId, { expectedState, expectedAttempts: 1, acknowledgement }),
      ).rejects.toMatchObject({ status: 409 })
      expect(operationsService.retryTask).not.toHaveBeenCalled()
    },
  )
})

describe('运维控制器委托服务', () => {
  it('task 委托给 operationsService.getTask', async () => {
    const { controller, operationsService } = setup()
    const mockTask = {
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
      outcome: null,
    }
    jest.mocked(operationsService.getTask).mockResolvedValue(mockTask)

    const result = await controller.task(taskId)
    expect(result).toBe(mockTask)
    expect(operationsService.getTask).toHaveBeenCalledWith(taskId)
  })

  it('status 委托给 operationsService.getStatus', async () => {
    const { controller, operationsService } = setup()
    const mockStatus = {
      configured: {
        email: { enabled: true, configured: true, missing: [] },
        backup: { enabled: true, configured: true, transferConfigured: true, missing: [] },
        workerEnabled: true,
      },
      databaseAvailable: true,
      runtime: null,
      storage: null,
      backupOverdue: false,
      page: 2,
      pageSize: 20,
      generatedAt: '2026-10-18T12:00:00.000Z',
    }
    jest.mocked(operationsService.getStatus).mockResolvedValue(mockStatus)

    const result = await controller.status({ page: 2 })
    expect(result).toBe(mockStatus)
    expect(operationsService.getStatus).toHaveBeenCalledWith(2)
  })

  it('retry 校验通过后委托给 operationsService.retryTask', async () => {
    const { controller, operationsService } = setup()
    const mockResult = { id: taskId, state: 'queued' }
    jest.mocked(operationsService.retryTask).mockResolvedValue(mockResult)

    const result = await controller.retry(taskId, {
      expectedState: 'failed',
      expectedAttempts: 1,
      acknowledgement: acknowledgements.failed,
    })
    expect(result).toBe(mockResult)
    expect(operationsService.retryTask).toHaveBeenCalledWith(taskId, 'failed', 1)
  })
})
