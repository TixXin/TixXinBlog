/**
 * @file admin-guestbook-batch.service.spec.ts
 * @description 留言批量审核与删除：请求校验、管理员守卫、咨询锁、逐条版本校验、部分不存在与汇总审计映射
 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import type { EntityManager } from '@mikro-orm/postgresql'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GuestbookReaction } from '../../entities/guestbook-reaction.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard'
import { auditDescriptor } from '../audit/audit-description'
import {
  AdminGuestbookController,
  BatchGuestbookDeleteDto,
  BatchGuestbookModerationDto,
  GUESTBOOK_BATCH_LIMIT,
} from './admin-guestbook.controller'
import { AdminGuestbookBatchService } from './admin-guestbook-batch.service'

const selection = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index + 1, revision: 0 }))

describe('留言批量请求', () => {
  it('拒绝空列表、超过上限、重复编号和不支持的状态', async () => {
    expect(await validate(plainToInstance(BatchGuestbookDeleteDto, { items: [] }))).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchGuestbookDeleteDto, { items: selection(GUESTBOOK_BATCH_LIMIT + 1) })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchGuestbookDeleteDto, { items: [selection(1)[0], selection(1)[0]] })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchGuestbookModerationDto, { status: 'spam', items: selection(1) })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchGuestbookModerationDto, { status: 'hidden', items: selection(100) })),
    ).toHaveLength(0)
  })

  it('批量路由在管理员守卫下，先于 :id 注册，并使用独立批量审计动作', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminGuestbookController)).toContain(AdminAuthGuard)
    const names = Object.getOwnPropertyNames(AdminGuestbookController.prototype)
    const route = (name: string) => ({
      path: Reflect.getMetadata('path', AdminGuestbookController.prototype[name as keyof AdminGuestbookController]),
      method: Reflect.getMetadata('method', AdminGuestbookController.prototype[name as keyof AdminGuestbookController]),
    })
    expect(route('batchModerate')).toEqual({ path: 'batch', method: RequestMethod.PATCH })
    expect(route('batchRemove')).toEqual({ path: 'batch', method: RequestMethod.DELETE })
    expect(names.indexOf('batchModerate')).toBeLessThan(names.indexOf('update'))
    expect(names.indexOf('batchRemove')).toBeLessThan(names.indexOf('remove'))
    expect(auditDescriptor('/api/v1/admin/guestbook/batch', 'PATCH')).toMatchObject({
      action: 'guestbook.batch.moderate',
      resourceId: undefined,
    })
    expect(auditDescriptor('/api/v1/admin/guestbook/batch', 'DELETE')).toMatchObject({
      action: 'guestbook.batch.delete',
    })
  })
})

type Note = Pick<GuestbookMessage, 'id' | 'revision' | 'status' | 'isPinned' | 'deletedAt'>
function setup(notes: Note[]) {
  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    find: jest.fn(async (_entity: unknown, where: { id: { $in: number[] } }) =>
      notes.filter((note) => where.id.$in.includes(note.id)),
    ),
    flush: jest.fn().mockResolvedValue(undefined),
    nativeDelete: jest.fn().mockResolvedValue(0),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { em, service: new AdminGuestbookBatchService(em as unknown as EntityManager) }
}
const note = (id: number, revision: number, patch: Partial<Note> = {}): Note => ({
  id,
  revision,
  status: 'pending',
  isPinned: false,
  deletedAt: undefined,
  ...patch,
})

describe('AdminGuestbookBatchService', () => {
  it('批量审核持留言板锁，逐条校验版本；隐藏同时取消置顶，已删除视为不存在', async () => {
    const notes = [
      note(1, 2, { status: 'published', isPinned: true }),
      note(2, 1),
      note(3, 0, { deletedAt: new Date() }),
    ]
    const { em, service } = setup(notes)
    const result = await service.moderate('hidden', [
      { id: 1, revision: 2 },
      { id: 2, revision: 0 },
      { id: 3, revision: 0 },
      { id: 9, revision: 0 },
    ])
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742920)')
    expect(em.find).toHaveBeenCalledWith(
      GuestbookMessage,
      { id: { $in: [1, 2, 3, 9] } },
      expect.objectContaining({ refresh: true }),
    )
    expect(result).toMatchObject({ ok: true, status: 'hidden', successCount: 1, failedCount: 3 })
    expect(result.results.map((item) => item.reason)).toEqual([undefined, 'conflict', 'not_found', 'not_found'])
    expect(notes[0]).toMatchObject({ status: 'hidden', isPinned: false, revision: 3 })
    expect(notes[1]).toMatchObject({ status: 'pending', revision: 1 })
  })

  it('公开时保留置顶；状态未变化不递增版本', async () => {
    const notes = [note(1, 4, { status: 'published', isPinned: true })]
    const { service } = setup(notes)
    await service.moderate('published', [{ id: 1, revision: 4 }])
    expect(notes[0]).toMatchObject({ isPinned: true, revision: 4 })
  })

  it('批量删除软删除并清理回应与媒体引用；已删除视为成功、版本过期跳过', async () => {
    const removedBefore = new Date('2026-01-01')
    const notes = [note(1, 0, { isPinned: true }), note(2, 5, { deletedAt: removedBefore }), note(3, 2)]
    const { em, service } = setup(notes)
    const result = await service.remove([
      { id: 1, revision: 0 },
      { id: 2, revision: 0 },
      { id: 3, revision: 1 },
      { id: 4, revision: 0 },
    ])
    expect(em.execute).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ deleted: 1, successCount: 2, failedCount: 2 })
    expect(notes[0]).toMatchObject({ isPinned: false, revision: 1 })
    expect(notes[0]!.deletedAt).toBeInstanceOf(Date)
    expect(notes[1]!.deletedAt).toBe(removedBefore)
    expect(notes[2]!.deletedAt).toBeUndefined()
    expect(em.nativeDelete).toHaveBeenCalledWith(GuestbookReaction, { message: { $in: [notes[0]] } })
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { guestbookMessage: { $in: [notes[0]] } })
  })

  it('没有可删除项时不清理关联', async () => {
    const { em, service } = setup([])
    const result = await service.remove([{ id: 1, revision: 0 }])
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(result).toMatchObject({ deleted: 0, successCount: 0, failedCount: 1 })
  })
})
