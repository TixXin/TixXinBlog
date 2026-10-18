/**
 * @file guestbook-state.service.spec.ts
 * @description 留言审核与唯一置顶、访客目标回应及软删除的事务边界单元测试
 */
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { GuestbookMessage } from '../../entities/guestbook-message.entity'
import { GuestbookReaction } from '../../entities/guestbook-reaction.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import type { GuestbookReadService } from './guestbook-read.service'
import { GuestbookWriteService } from './guestbook-write.service'

function setup(patch: Partial<GuestbookMessage> = {}) {
  const note = Object.assign(new GuestbookMessage(), {
    id: 42,
    revision: 3,
    author: '山间来客',
    content: '很喜欢这篇山行记录。',
    deletedAt: null,
    ...patch,
  })
  const tx = {
    execute: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(note),
    create: jest.fn(),
    remove: jest.fn(),
    nativeDelete: jest.fn().mockResolvedValue(1),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 根管理器只提供事务入口，事务内任何误用都会立即暴露。
  const em = { transactional: jest.fn(async (run: (manager: unknown) => Promise<unknown>) => run(tx)) }
  const detail = { id: 42, content: note.content }
  const read = { detail: jest.fn().mockResolvedValue(detail) }
  const service = new GuestbookWriteService(em as unknown as EntityManager, read as unknown as GuestbookReadService)
  return { service, em, tx, note, read, detail }
}

describe('GuestbookWriteService 审核与置顶', () => {
  it('没有审核或置顶字段时在开启事务前拒绝', async () => {
    const { service, em } = setup()
    await expect(service.update(42, { revision: 3 })).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('持锁读取未删除留言，先释放旧置顶并递增其版本，再写入新置顶', async () => {
    const { service, em, tx, note, read, detail } = setup({ status: 'pending' })
    tx.execute.mockImplementation(async (sql: string) => {
      if (sql.startsWith('update guestbook_message')) {
        expect(note).toMatchObject({ status: 'pending', isPinned: false, revision: 3 })
        expect(tx.flush).not.toHaveBeenCalled()
      }
      return []
    })
    em.transactional.mockImplementationOnce(async (run) => {
      const result = await run(tx)
      expect(read.detail).not.toHaveBeenCalled()
      return result
    })

    await expect(service.update(42, { revision: 3, status: 'published', isPinned: true })).resolves.toBe(detail)

    expect(tx.execute).toHaveBeenNthCalledWith(1, 'select pg_advisory_xact_lock(742920)')
    expect(tx.findOne).toHaveBeenCalledWith(
      GuestbookMessage,
      { id: 42, deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(tx.execute).toHaveBeenNthCalledWith(
      2,
      'update guestbook_message set is_pinned=false,revision=revision+1,updated_at=now() where id<>? and is_pinned=true',
      [42],
    )
    expect(tx.execute.mock.invocationCallOrder[0]).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]!)
    expect(tx.execute.mock.invocationCallOrder[1]).toBeLessThan(tx.flush.mock.invocationCallOrder[0]!)
    expect(note).toMatchObject({ status: 'published', isPinned: true, revision: 4 })
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(read.detail).toHaveBeenCalledWith(42, '', true)
  })

  it.each(['pending', 'hidden'] as const)('已置顶留言转为 %s 时自动取消置顶', async (status) => {
    const { service, tx, note } = setup({ isPinned: true })
    await service.update(42, { revision: 3, status })
    expect(note).toMatchObject({ status, isPinned: false, revision: 4 })
    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.flush).toHaveBeenCalledTimes(1)
  })

  it('显式取消置顶时保留公开状态，且不触碰其他置顶记录', async () => {
    const { service, tx, note } = setup({ isPinned: true })
    await service.update(42, { revision: 3, isPinned: false })
    expect(note).toMatchObject({ status: 'published', isPinned: false, revision: 4 })
    expect(tx.execute).toHaveBeenCalledTimes(1)
  })

  it('省略置顶字段时保留原置顶状态', async () => {
    const { service, note } = setup({ isPinned: true })
    await service.update(42, { revision: 3, status: 'published' })
    expect(note).toMatchObject({ status: 'published', isPinned: true, revision: 4 })
  })

  it.each(['pending', 'hidden'] as const)('拒绝直接置顶 %s 留言，且不修改原状态', async (status) => {
    const { service, tx, note, read } = setup({ status })
    await expect(service.update(42, { revision: 3, isPinned: true })).rejects.toMatchObject({ status: 400 })
    expect(note).toMatchObject({ status, isPinned: false, revision: 3 })
    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('不能同时隐藏留言并请求置顶', async () => {
    const { service, tx, note } = setup({ isPinned: true })
    await expect(service.update(42, { revision: 3, status: 'hidden', isPinned: true })).rejects.toMatchObject({
      status: 400,
    })
    expect(note).toMatchObject({ status: 'published', isPinned: true, revision: 3 })
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('不存在或已删除留言返回 404，不释放其他置顶或读取详情', async () => {
    const { service, tx, read } = setup()
    tx.findOne.mockResolvedValue(null)
    await expect(service.update(42, { revision: 3, isPinned: true })).rejects.toMatchObject({ status: 404 })
    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('旧版本请求返回冲突，不能更改审核状态或抢占置顶', async () => {
    const { service, tx, note, read } = setup()
    await expect(service.update(42, { revision: 2, isPinned: true })).rejects.toMatchObject({ status: 409 })
    expect(note).toMatchObject({ status: 'published', isPinned: false, revision: 3 })
    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('释放旧置顶失败时传播错误，不修改新记录或返回成功', async () => {
    const { service, tx, note, read } = setup()
    const error = new Error('旧置顶写入失败')
    tx.execute.mockResolvedValueOnce([]).mockRejectedValueOnce(error)
    await expect(service.update(42, { revision: 3, isPinned: true })).rejects.toBe(error)
    expect(note).toMatchObject({ isPinned: false, revision: 3 })
    expect(tx.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('事务提交失败时不读取或返回更新后的详情', async () => {
    const { service, em, tx, read } = setup()
    const error = new Error('事务提交失败')
    em.transactional.mockImplementationOnce(async (run) => {
      await run(tx)
      throw error
    })
    await expect(service.update(42, { revision: 3, status: 'hidden' })).rejects.toBe(error)
    expect(read.detail).not.toHaveBeenCalled()
  })
})

describe('GuestbookWriteService 访客回应', () => {
  it.each([
    { reacted: true, exists: false, creates: 1, removes: 0 },
    { reacted: true, exists: true, creates: 0, removes: 0 },
    { reacted: false, exists: true, creates: 0, removes: 1 },
    { reacted: false, exists: false, creates: 0, removes: 0 },
  ])('目标状态 $reacted、当前记录 $exists 时只执行必要变更', async ({ reacted, exists, creates, removes }) => {
    const { service, em, tx, note } = setup()
    const existing = Object.assign(new GuestbookReaction(), {
      id: 8,
      message: note,
      visitorIdHash: '访客甲',
      emoji: '👍',
    })
    const reactions = [
      { emoji: '👍', count: 4, reacted },
      { emoji: '💡', count: 2, reacted: false },
    ]
    tx.findOne.mockResolvedValueOnce(note).mockResolvedValueOnce(exists ? existing : null)
    tx.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(reactions)

    await expect(service.react(42, '访客甲', { emoji: '👍', reacted })).resolves.toEqual({ id: 42, reactions })

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenNthCalledWith(1, 'select pg_advisory_xact_lock(742920)')
    expect(tx.findOne).toHaveBeenNthCalledWith(
      1,
      GuestbookMessage,
      { id: 42, status: 'published', deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(tx.findOne).toHaveBeenNthCalledWith(2, GuestbookReaction, {
      message: note,
      visitorIdHash: '访客甲',
      emoji: '👍',
    })
    expect(tx.create).toHaveBeenCalledTimes(creates)
    expect(tx.remove).toHaveBeenCalledTimes(removes)
    if (creates)
      expect(tx.create).toHaveBeenCalledWith(GuestbookReaction, { message: note, visitorIdHash: '访客甲', emoji: '👍' })
    if (removes) expect(tx.remove).toHaveBeenCalledWith(existing)
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenNthCalledWith(
      2,
      'select emoji,count(*)::int as count,bool_or(visitor_id_hash=?) as reacted from guestbook_reaction where message_id=? group by emoji order by emoji',
      ['访客甲', 42],
    )
    expect(tx.execute.mock.invocationCallOrder[0]).toBeLessThan(tx.findOne.mock.invocationCallOrder[0]!)
    expect(tx.flush.mock.invocationCallOrder[0]).toBeLessThan(tx.execute.mock.invocationCallOrder[1]!)
    expect(note.revision).toBe(3)
  })

  it('同一访客重复设置已回应不会重复写入，再取消两次只删除一次', async () => {
    const { service, tx, note } = setup()
    const reaction = Object.assign(new GuestbookReaction(), {
      id: 8,
      message: note,
      visitorIdHash: '访客甲',
      emoji: '👍',
    })
    tx.findOne
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(reaction)
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(reaction)
      .mockResolvedValueOnce(note)
      .mockResolvedValueOnce(null)
    await service.react(42, '访客甲', { emoji: '👍', reacted: true })
    await service.react(42, '访客甲', { emoji: '👍', reacted: true })
    await service.react(42, '访客甲', { emoji: '👍', reacted: false })
    await expect(service.react(42, '访客甲', { emoji: '👍', reacted: false })).resolves.toEqual({
      id: 42,
      reactions: [],
    })
    expect(tx.create).toHaveBeenCalledTimes(1)
    expect(tx.remove).toHaveBeenCalledTimes(1)
    expect(tx.remove).toHaveBeenCalledWith(reaction)
  })

  it.each([
    { visitor: '访客乙', emoji: '👍' as const },
    { visitor: '访客甲', emoji: '💡' as const },
  ])('取消 $visitor 的 $emoji 不影响其他访客或另一种回应', async ({ visitor, emoji }) => {
    const { service, tx, note } = setup()
    const others = { message: note, visitorIdHash: '访客甲', emoji: '👍' }
    tx.findOne.mockImplementation(async (entity: unknown, where: { visitorIdHash?: string; emoji?: string }) => {
      if (entity === GuestbookMessage) return note
      return where.visitorIdHash === others.visitorIdHash && where.emoji === others.emoji ? others : null
    })
    const reactions = [{ emoji: '👍', count: 1, reacted: visitor === '访客甲' }]
    tx.execute.mockResolvedValueOnce([]).mockResolvedValueOnce(reactions)
    await expect(service.react(42, visitor, { emoji, reacted: false })).resolves.toEqual({ id: 42, reactions })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.remove).not.toHaveBeenCalled()
    expect(tx.execute).toHaveBeenLastCalledWith(expect.any(String), [visitor, 42])
  })

  it('不可公开或不存在的留言返回 404，不读取或修改回应', async () => {
    const { service, tx } = setup()
    tx.findOne.mockResolvedValue(null)
    await expect(service.react(42, '访客甲', { emoji: '👍', reacted: true })).rejects.toMatchObject({ status: 404 })
    expect(tx.findOne).toHaveBeenCalledTimes(1)
    expect(tx.execute).toHaveBeenCalledTimes(1)
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.remove).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('回应持久化失败时不读取聚合或返回伪造计数', async () => {
    const { service, tx, note } = setup()
    tx.findOne.mockResolvedValueOnce(note).mockResolvedValueOnce(null)
    const error = new Error('回应保存失败')
    tx.flush.mockRejectedValueOnce(error)
    await expect(service.react(42, '访客甲', { emoji: '👍', reacted: true })).rejects.toBe(error)
    expect(tx.execute).toHaveBeenCalledTimes(1)
  })
})

describe('GuestbookWriteService 软删除', () => {
  it('按统一顺序加锁，保留提交墓碑并清理回应及媒体引用', async () => {
    const { service, tx, note } = setup({ isPinned: true, requestId: '原提交标识', requestHash: '原内容摘要' })
    const start = Date.now()
    await expect(service.remove(42, 3)).resolves.toEqual({ ok: true })
    expect(tx.execute).toHaveBeenNthCalledWith(1, 'select pg_advisory_xact_lock(742912)')
    expect(tx.execute).toHaveBeenNthCalledWith(2, 'select pg_advisory_xact_lock(742920)')
    expect(tx.findOne).toHaveBeenCalledWith(GuestbookMessage, { id: 42 }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    expect(note.deletedAt).toBeInstanceOf(Date)
    expect(note.deletedAt!.getTime()).toBeGreaterThanOrEqual(start)
    expect(note.deletedAt!.getTime()).toBeLessThanOrEqual(Date.now())
    expect(note).toMatchObject({ isPinned: false, revision: 4, requestId: '原提交标识', requestHash: '原内容摘要' })
    expect(tx.nativeDelete).toHaveBeenCalledTimes(2)
    expect(tx.nativeDelete).toHaveBeenNthCalledWith(1, GuestbookReaction, { message: note })
    expect(tx.nativeDelete).toHaveBeenNthCalledWith(2, MediaReference, { guestbookMessage: note })
    expect(tx.nativeDelete.mock.invocationCallOrder[1]).toBeLessThan(tx.flush.mock.invocationCallOrder[0]!)
    expect(tx.remove).not.toHaveBeenCalled()
    expect(tx.flush).toHaveBeenCalledTimes(1)
  })

  it('重复删除直接成功，即使携带旧版本也不重复清理或更新墓碑', async () => {
    const deletedAt = new Date('2026-10-18T00:00:00.000Z')
    const { service, tx, note } = setup({ deletedAt })
    await expect(service.remove(42, 2)).resolves.toEqual({ ok: true })
    expect(note).toMatchObject({ deletedAt, revision: 3 })
    expect(tx.nativeDelete).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('旧版本不能删除尚存留言或清理关联数据', async () => {
    const { service, tx, note } = setup({ isPinned: true })
    await expect(service.remove(42, 2)).rejects.toMatchObject({ status: 409 })
    expect(note).toMatchObject({ deletedAt: null, isPinned: true, revision: 3 })
    expect(tx.nativeDelete).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('不存在的留言返回 404，不执行关联删除', async () => {
    const { service, tx } = setup()
    tx.findOne.mockResolvedValue(null)
    await expect(service.remove(42, 3)).rejects.toMatchObject({ status: 404 })
    expect(tx.nativeDelete).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('关联清理失败向事务传播，不返回删除成功', async () => {
    const { service, tx } = setup()
    const error = new Error('媒体引用清理失败')
    tx.nativeDelete.mockResolvedValueOnce(1).mockRejectedValueOnce(error)
    await expect(service.remove(42, 3)).rejects.toBe(error)
    expect(tx.flush).not.toHaveBeenCalled()
  })
})

describe('GuestbookWriteService 状态操作编号边界', () => {
  it.each([0, -1, 1.5, 2147483648, Number.NaN])('非法编号 %s 在任何事务前拒绝', async (id) => {
    const { service, em } = setup()
    await expect(service.update(id, { revision: 3, isPinned: true })).rejects.toMatchObject({ status: 400 })
    await expect(service.react(id, '访客甲', { emoji: '👍', reacted: true })).rejects.toMatchObject({ status: 400 })
    await expect(service.remove(id, 3)).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
  })
})
