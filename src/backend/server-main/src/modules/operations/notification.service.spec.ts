/**
 * @file notification.service.spec.ts
 * @description 通知分页、详情与独立已读状态；数据库及当前业务目标均使用替身
 */
import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { NotFoundException, RequestMethod } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { OwnerNotification } from '../../entities/owner-notification.entity'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { resolveNotificationTargets } from './notification-targets'

jest.mock('./notification-targets', () => ({ resolveNotificationTargets: jest.fn() }))

const resolveTargets = jest.mocked(resolveNotificationTargets)
const createdAt = new Date('2026-10-18T01:02:03.000Z')
const readAt = new Date('2026-10-18T02:03:04.000Z')

function notification(overrides: Partial<OwnerNotification> = {}): OwnerNotification {
  return Object.assign(new OwnerNotification(), {
    id: 'notification-1',
    eventKey: 'comment:41',
    kind: 'comment',
    sourceId: '41',
    reason: 'comment_created',
    createdAt,
    ...overrides,
  })
}

beforeEach(() => {
  resolveTargets.mockReset()
  resolveTargets.mockResolvedValue(new Map())
})

describe('通知查询', () => {
  it('汇总只统计未读通知，不读取或修改业务记录', async () => {
    const em = { count: jest.fn().mockResolvedValue(7) }

    await expect(new NotificationService(em as unknown as EntityManager).summary()).resolves.toEqual({ unread: 7 })

    expect(em.count).toHaveBeenCalledTimes(1)
    expect(em.count).toHaveBeenCalledWith(OwnerNotification, { readAt: null })
    expect(resolveTargets).not.toHaveBeenCalled()
  })

  it('详情刷新记录并返回当前业务状态，已读不代表已处理', async () => {
    const item = notification({ readAt })
    const em = { findOne: jest.fn().mockResolvedValue(item) }
    resolveTargets.mockResolvedValue(
      new Map([[item.id, { state: 'pending_review', url: '/admin/comments?commentId=41' }]]),
    )

    await expect(new NotificationService(em as unknown as EntityManager).detail(item.id)).resolves.toEqual({
      id: item.id,
      kind: 'comment',
      reason: 'comment_created',
      createdAt: createdAt.toISOString(),
      readAt: readAt.toISOString(),
      state: 'pending_review',
      url: '/admin/comments?commentId=41',
    })

    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(OwnerNotification, { id: item.id }, { refresh: true })
    expect(resolveTargets).toHaveBeenCalledTimes(1)
    expect(resolveTargets).toHaveBeenCalledWith(em, [item])
  })

  it('缺失详情返回 404，不继续解析业务目标', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(null) }

    await expect(new NotificationService(em as unknown as EntityManager).detail('missing')).rejects.toThrow(
      new NotFoundException('通知不存在或记录已移除'),
    )

    expect(resolveTargets).not.toHaveBeenCalled()
  })

  it.each([
    ['all', {}],
    ['unread', { readAt: null }],
  ] as const)('按 %s 筛选分页、稳定排序，并独立统计全部未读', async (filter, where) => {
    const unread = notification()
    const read = notification({ id: 'notification-2', sourceId: '42', readAt })
    const items = filter === 'unread' ? [unread] : [unread, read]
    const em = { findAndCount: jest.fn().mockResolvedValue([items, 43]), count: jest.fn().mockResolvedValue(8) }
    resolveTargets.mockResolvedValue(
      new Map([
        [unread.id, { state: 'handled', url: '/admin/comments?commentId=41' }],
        [read.id, { state: 'unavailable', url: null }],
      ]),
    )

    const result = await new NotificationService(em as unknown as EntityManager).list(3, filter)

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount).toHaveBeenCalledWith(OwnerNotification, where, {
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: 20,
      offset: 40,
    })
    expect(em.count).toHaveBeenCalledTimes(1)
    expect(em.count).toHaveBeenCalledWith(OwnerNotification, { readAt: null })
    expect(resolveTargets).toHaveBeenCalledTimes(1)
    expect(resolveTargets).toHaveBeenCalledWith(em, items)
    expect(result).toEqual({
      page: 3,
      pageSize: 20,
      total: 43,
      unread: 8,
      items: [
        {
          id: unread.id,
          kind: 'comment',
          reason: 'comment_created',
          createdAt: createdAt.toISOString(),
          readAt: null,
          state: 'handled',
          url: '/admin/comments?commentId=41',
        },
        ...(filter === 'all'
          ? [
              {
                id: read.id,
                kind: 'comment',
                reason: 'comment_created',
                createdAt: createdAt.toISOString(),
                readAt: readAt.toISOString(),
                state: 'unavailable',
                url: null,
              },
            ]
          : []),
      ],
    })
  })

  it('空页仍保留总数和未读数，首页偏移为零', async () => {
    const em = { findAndCount: jest.fn().mockResolvedValue([[], 0]), count: jest.fn().mockResolvedValue(0) }

    await expect(new NotificationService(em as unknown as EntityManager).list(1, 'all')).resolves.toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      unread: 0,
      items: [],
    })

    expect(em.findAndCount.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ offset: 0 }))
    expect(resolveTargets).toHaveBeenCalledTimes(1)
    expect(resolveTargets).toHaveBeenCalledWith(em, [])
  })

  it('目标解析失败向上传播，不把故障伪装成已处理或无目标', async () => {
    const em = { findOne: jest.fn().mockResolvedValue(notification()) }
    const failure = new Error('目标查询失败')
    resolveTargets.mockRejectedValue(failure)

    await expect(new NotificationService(em as unknown as EntityManager).detail('notification-1')).rejects.toBe(failure)
  })
})

describe('单条通知已读', () => {
  it('参数化更新指定通知，重复标记保留原已读时间', async () => {
    const id = 'notification-1'
    const row = { id, readAt }
    const em = { execute: jest.fn().mockResolvedValue([row]) }

    await expect(new NotificationService(em as unknown as EntityManager).read(id)).resolves.toBe(row)

    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.execute).toHaveBeenCalledWith(
      'update owner_notification set read_at=coalesce(read_at,now()) where id=? returning id,read_at as "readAt"',
      [id],
    )
    expect(resolveTargets).not.toHaveBeenCalled()
  })

  it('更新不到记录时返回 404', async () => {
    const em = { execute: jest.fn().mockResolvedValue([]) }

    await expect(new NotificationService(em as unknown as EntityManager).read('missing')).rejects.toThrow(
      new NotFoundException('通知不存在'),
    )
  })
})

describe('通知全部已读', () => {
  it('路由为 POST read-all，且在管理员守卫下', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationController)).toContain(AdminAuthGuard)
    const handler = NotificationController.prototype.readAll
    expect(Reflect.getMetadata('path', handler)).toBe('read-all')
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.POST)
  })

  it('一次更新所有未读并返回本次标记数量与之后的未读数', async () => {
    const em = {
      execute: jest.fn().mockResolvedValue([{ updated: 3 }]),
      count: jest.fn().mockResolvedValue(0),
    }
    const service = new NotificationService(em as unknown as EntityManager)
    await expect(service.readAll()).resolves.toEqual({ updated: 3, unread: 0 })
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.execute.mock.calls[0][0]).toMatch(/update owner_notification set read_at=now\(\) where read_at is null/)
    expect(em.count).toHaveBeenCalledWith(OwnerNotification, { readAt: null })
  })

  it('没有未读时返回 0，不抛错', async () => {
    const em = { execute: jest.fn().mockResolvedValue([{ updated: 0 }]), count: jest.fn().mockResolvedValue(0) }
    await expect(new NotificationService(em as unknown as EntityManager).readAll()).resolves.toEqual({
      updated: 0,
      unread: 0,
    })
  })

  it('全部已读后仍返回新到通知的未读数', async () => {
    const em = { execute: jest.fn().mockResolvedValue([{ updated: 3 }]), count: jest.fn().mockResolvedValue(2) }

    await expect(new NotificationService(em as unknown as EntityManager).readAll()).resolves.toEqual({
      updated: 3,
      unread: 2,
    })

    expect(em.execute.mock.invocationCallOrder[0]).toBeLessThan(em.count.mock.invocationCallOrder[0]!)
    expect(resolveTargets).not.toHaveBeenCalled()
  })

  it('计数结果缺失时默认本次更新为零', async () => {
    const em = { execute: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(1) }

    await expect(new NotificationService(em as unknown as EntityManager).readAll()).resolves.toEqual({
      updated: 0,
      unread: 1,
    })
  })

  it('写入失败时保留错误，不继续查询未读或报告成功', async () => {
    const failure = new Error('更新失败')
    const em = { execute: jest.fn().mockRejectedValue(failure), count: jest.fn() }

    await expect(new NotificationService(em as unknown as EntityManager).readAll()).rejects.toBe(failure)

    expect(em.count).not.toHaveBeenCalled()
  })
})
