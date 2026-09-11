/** @file notification.service.ts @description 博主通知分页与独立已读状态，批量解析当前业务状态 */
import { Injectable, NotFoundException } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { OwnerNotification } from '../../entities/owner-notification.entity'
import { resolveNotificationTargets } from './notification-targets'

@Injectable()
export class NotificationService {
  constructor(private readonly em: EntityManager) {}
  async summary() {
    return { unread: await this.em.count(OwnerNotification, { readAt: null }) }
  }
  async detail(id: string) {
    const item = await this.em.findOne(OwnerNotification, { id }, { refresh: true })
    if (!item) throw new NotFoundException('通知不存在或记录已移除')
    const targets = await resolveNotificationTargets(this.em, [item])
    return {
      id: item.id,
      kind: item.kind,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
      ...targets.get(id),
    }
  }
  async list(page: number, filter: 'all' | 'unread') {
    const where: FilterQuery<OwnerNotification> = filter === 'unread' ? { readAt: null } : {}
    const [items, total] = await this.em.findAndCount(OwnerNotification, where, {
      orderBy: { createdAt: 'desc', id: 'desc' },
      limit: 20,
      offset: (page - 1) * 20,
    })
    const unread = await this.em.count(OwnerNotification, { readAt: null })
    const targets = await resolveNotificationTargets(this.em, items)
    return {
      page,
      pageSize: 20,
      total,
      unread,
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt?.toISOString() ?? null,
        ...targets.get(item.id),
      })),
    }
  }
  async read(id: string) {
    const rows = await this.em.execute(
      'update owner_notification set read_at=coalesce(read_at,now()) where id=? returning id,read_at as "readAt"',
      [id],
    )
    if (!rows.length) throw new NotFoundException('通知不存在')
    return rows[0]
  }
}
