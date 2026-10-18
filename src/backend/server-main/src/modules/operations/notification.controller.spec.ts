/** @file notification.controller.spec.ts @description 通知入口分页、筛选、编号校验与已读操作的单元测试。 */
import 'reflect-metadata'
import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA, PARAMTYPES_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'

const notificationId = '759709f8-23a5-4b80-a155-98f615482c22'
const validation = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })

function validate(value: unknown) {
  const [metatype] = Reflect.getMetadata(PARAMTYPES_METADATA, NotificationController.prototype, 'list')
  return validation.transform(value, { type: 'query', metatype })
}

function setup() {
  const service = { summary: jest.fn(), list: jest.fn(), detail: jest.fn(), read: jest.fn(), readAll: jest.fn() }
  return { service, controller: new NotificationController(service as unknown as NotificationService) }
}

describe('通知控制器', () => {
  it('保留管理员守卫，默认查询全部通知第一页', async () => {
    const { service, controller } = setup()
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationController)).toContain(AdminAuthGuard)
    const query = await validate({})
    expect(query).toMatchObject({ page: 1, filter: 'all' })
    service.list.mockResolvedValue({ items: [], total: 0 })
    await expect(controller.list(query)).resolves.toEqual({ items: [], total: 0 })
    expect(service.list).toHaveBeenCalledWith(1, 'all')
  })

  it('转换分页字符串且向服务传递未读筛选', async () => {
    const { service, controller } = setup()
    service.list.mockResolvedValue({ items: [{ id: notificationId }], total: 21 })
    await expect(controller.list(await validate({ page: '2', filter: 'unread' }))).resolves.toMatchObject({ total: 21 })
    expect(service.list).toHaveBeenCalledWith(2, 'unread')
  })

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '' },
    { page: 'NaN' },
    { page: ['1', '2'] },
    { filter: 'read' },
    { filter: ['all', 'unread'] },
    { extra: 'unknown' },
  ])('拒绝非法查询 %j', async (query) => {
    await expect(validate(query)).rejects.toMatchObject({ status: 400 })
  })

  it.each(['detail', 'read'] as const)('%s 的参数管道拒绝非 UUID v4 编号', async (method) => {
    const params = Reflect.getMetadata(ROUTE_ARGS_METADATA, NotificationController, method) as Record<
      string,
      { data: string; pipes: ParseUUIDPipe[] }
    >
    const pipe = Object.values(params).find((param) => param.data === 'id')!.pipes[0]!
    await expect(pipe.transform(notificationId, { type: 'param' })).resolves.toBe(notificationId)
    for (const id of ['bad-id', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'])
      await expect(pipe.transform(id, { type: 'param' })).rejects.toMatchObject({ status: 400 })
  })

  it('详情与摘要保留服务返回的业务状态', async () => {
    const { service, controller } = setup()
    service.summary.mockResolvedValue({ unread: 2 })
    service.detail.mockResolvedValue({ id: notificationId, readAt: null, state: 'pending_review' })
    await expect(controller.summary()).resolves.toEqual({ unread: 2 })
    await expect(controller.detail(notificationId)).resolves.toEqual({
      id: notificationId,
      readAt: null,
      state: 'pending_review',
    })
    expect(service.detail).toHaveBeenCalledWith(notificationId)
  })

  it('单条与全部已读分别委托并保留返回结果，不调用另一入口', async () => {
    const { service, controller } = setup()
    const readAt = new Date('2026-10-18T12:00:00.000Z')
    service.read.mockResolvedValue({ id: notificationId, readAt })
    service.readAll.mockResolvedValue({ updated: 3, unread: 0 })
    await expect(controller.read(notificationId)).resolves.toEqual({ id: notificationId, readAt })
    expect(service.read).toHaveBeenCalledWith(notificationId)
    expect(service.readAll).not.toHaveBeenCalled()
    await expect(controller.readAll()).resolves.toEqual({ updated: 3, unread: 0 })
    expect(service.read).toHaveBeenCalledTimes(1)
    expect(service.list).not.toHaveBeenCalled()
  })
})
