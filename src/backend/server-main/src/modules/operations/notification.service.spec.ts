/**
 * @file notification.service.spec.ts
 * @description 通知全部已读：管理员守卫、单条原子 SQL、只标记未读并返回实际数量与剩余未读
 */
import 'reflect-metadata'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { OwnerNotification } from '../../entities/owner-notification.entity'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'

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
})
