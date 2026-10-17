/**
 * @file admin-guestbook-batch.service.ts
 * @description 博主留言批量审核与软删除：单事务、留言板咨询锁与行锁，逐条校验版本并返回逐条结果。
 */
import { Injectable } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import type { GuestbookStatus } from '../../entities/guestbook-message.entity'
import { GuestbookReaction } from '../../entities/guestbook-reaction.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia } from '../media/media-references'
import { lockGuestbook } from './guestbook-write.service'

/** 单条结果：not_found 表示留言不存在（或审核时已删除），conflict 表示提交版本已过期 */
export interface GuestbookBatchItemResult {
  id: number
  ok: boolean
  reason?: 'not_found' | 'conflict'
  revision?: number
}
interface GuestbookSelection {
  id: number
  revision: number
}

@Injectable()
export class AdminGuestbookBatchService {
  constructor(private readonly em: EntityManager) {}

  private async lockRows(em: EntityManager, items: GuestbookSelection[]) {
    const rows = await em.find(
      GuestbookMessage,
      { id: { $in: items.map((item) => item.id) } },
      { lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'asc' }, refresh: true },
    )
    return new Map(rows.map((row) => [row.id, row]))
  }
  private summary(results: GuestbookBatchItemResult[]) {
    const successCount = results.filter((item) => item.ok).length
    return { successCount, failedCount: results.length - successCount, results }
  }

  /** 与单条修改一致：非公开状态同时取消置顶；状态未变化的留言视为成功且不递增版本 */
  async moderate(status: GuestbookStatus, items: GuestbookSelection[]) {
    return this.em.transactional(async (em) => {
      await lockGuestbook(em)
      const rows = await this.lockRows(em, items)
      const results = items.map((item): GuestbookBatchItemResult => {
        const note = rows.get(item.id)
        if (!note || note.deletedAt) return { id: item.id, ok: false, reason: 'not_found' }
        if (note.revision !== item.revision)
          return { id: item.id, ok: false, reason: 'conflict', revision: note.revision }
        const pinned = status === 'published' && note.isPinned
        if (note.status !== status || note.isPinned !== pinned) {
          note.status = status
          note.isPinned = pinned
          note.revision++
        }
        return { id: item.id, ok: true, revision: note.revision }
      })
      await em.flush()
      return { ok: true, status, ...this.summary(results) }
    })
  }

  /** 与单条删除一致：软删除、取消置顶并清理回应与媒体引用；已删除的留言视为成功 */
  async remove(items: GuestbookSelection[]) {
    return this.em.transactional(async (em) => {
      await lockMedia(em)
      await lockGuestbook(em)
      const rows = await this.lockRows(em, items)
      const removed: GuestbookMessage[] = []
      const deletedAt = new Date()
      const results = items.map((item): GuestbookBatchItemResult => {
        const note = rows.get(item.id)
        if (!note) return { id: item.id, ok: false, reason: 'not_found' }
        if (note.deletedAt) return { id: item.id, ok: true, revision: note.revision }
        if (note.revision !== item.revision)
          return { id: item.id, ok: false, reason: 'conflict', revision: note.revision }
        note.deletedAt = deletedAt
        note.isPinned = false
        note.revision++
        removed.push(note)
        return { id: item.id, ok: true, revision: note.revision }
      })
      if (removed.length) {
        await em.nativeDelete(GuestbookReaction, { message: { $in: removed } })
        await em.nativeDelete(MediaReference, { guestbookMessage: { $in: removed } })
      }
      await em.flush()
      return { ok: true, deleted: removed.length, ...this.summary(results) }
    })
  }
}
