/**
 * @file flash-comment-moderation.spec.ts
 * @description 闪念评论审核回归：先审后发策略决定初始状态与通知原因；公开读取只返回已发布及访客本人待审评论，
 *   计数只计已发布；后台单条/批量审核与删除的冲突、归属和 DTO 边界
 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ConfigService } from '@nestjs/config'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { FlashComment } from '../../entities/flash-comment.entity'
import type { FlashCommentStatus } from '../../entities/flash-comment.entity'
import { FlashNote } from '../../entities/flash-note.entity'
import { recordOwnerEvent } from '../operations/owner-events'
import { FlashService } from './flash.service'
import { AdminFlashCommentService } from './admin-flash-comment.service'
import {
  BatchFlashCommentDeleteDto,
  BatchFlashCommentModerationDto,
  FLASH_COMMENT_BATCH_LIMIT,
  ModerateFlashCommentDto,
  QueryAdminFlashCommentsDto,
} from './dto/moderate-flash-comment.dto'

jest.mock('../operations/owner-events', () => ({ recordOwnerEvent: jest.fn().mockResolvedValue(undefined) }))
jest.mock('../media/media-references', () => ({
  lockMedia: jest.fn().mockResolvedValue(undefined),
  managedMediaIds: jest.fn(() => []),
  synchronizeMediaReferences: jest.fn().mockResolvedValue(undefined),
}))

const secret = 'flash-moderation-secret-with-at-least-32-characters'
const visitor = 'visitor-hash-a'
const other = 'visitor-hash-b'
const date = new Date('2026-10-18T01:00:00.000Z')

function flashService(em: unknown) {
  return new FlashService(em as EntityManager, new ConfigService({ JWT_ACCESS_SECRET: secret }))
}

describe('访客提交闪念评论按评论策略决定初始状态', () => {
  function setup(policy: Partial<CommentPolicy> | null) {
    const note = { id: 'note-1', userId: 'tixxin' }
    const em = {
      findOne: jest.fn((entity: unknown) => Promise.resolve(entity === CommentPolicy ? policy : note)),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 'comment-1', ...data })),
      flush: jest.fn().mockResolvedValue(undefined),
      transactional: jest.fn(),
    }
    em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
    return { em, service: flashService(em) }
  }
  beforeEach(() => jest.mocked(recordOwnerEvent).mockClear())

  it.each([
    { policy: { requireApproval: true }, status: 'pending', reason: 'pending_review' },
    { policy: { requireApproval: false }, status: 'published', reason: 'new_comment' },
    { policy: null, status: 'published', reason: 'new_comment' },
  ])('策略 $policy 时初始状态为 $status 并通知博主', async ({ policy, status, reason }) => {
    const { em, service } = setup(policy)
    const created = await service.addComment('note-1', { authorName: '访客', content: '想法很好' }, visitor)
    // 策略每次都从数据库刷新读取，避免博主刚开启先审后发时仍沿用缓存值。
    expect(em.findOne).toHaveBeenCalledWith(CommentPolicy, { id: 'default' }, { refresh: true })
    expect(em.create).toHaveBeenCalledWith(FlashComment, expect.objectContaining({ status }))
    expect(created.moderationStatus).toBe(status)
    expect(recordOwnerEvent).toHaveBeenCalledWith(em, 'flash-comment', 'comment-1', reason)
  })
})

describe('公开读取的闪念评论可见性', () => {
  function note(comments: Array<{ id: string; authorId: string; status: FlashCommentStatus }>) {
    return {
      id: 'note-1',
      userId: 'tixxin',
      content: '今天的灵感',
      tags: [],
      images: [],
      type: 'idea',
      createdAt: date,
      updatedAt: date,
      likes: 0,
      comments: {
        getItems: () =>
          comments.map((comment, index) => ({
            ...comment,
            authorName: '读者',
            authorAvatar: '/avatar.svg',
            content: '评论' + comment.id,
            createdAt: new Date(date.getTime() + index),
          })),
      },
      isPinned: false,
      isArchived: false,
      isDraft: false,
    } as unknown as FlashNote
  }
  const rows = [
    { id: 'published', authorId: other, status: 'published' as const },
    { id: 'own-pending', authorId: visitor, status: 'pending' as const },
    { id: 'other-pending', authorId: other, status: 'pending' as const },
    { id: 'own-hidden', authorId: visitor, status: 'hidden' as const },
  ]
  const service = flashService({ find: jest.fn().mockResolvedValue([]) })

  it('访客只看到已发布评论和自己提交的待审评论，计数只计已发布', async () => {
    const [dto] = await service.serialize([note(rows)], visitor)
    expect(dto!.comments.map((comment) => [comment.id, comment.moderationStatus])).toEqual([
      ['published', 'published'],
      ['own-pending', 'pending'],
    ])
    expect(dto!.commentCount).toBe(1)
    expect(JSON.stringify(dto)).not.toContain(visitor)
  })

  it('匿名读取（含 SSR）不返回任何待审或隐藏评论', async () => {
    const [dto] = await service.serialize([note(rows)], '')
    expect(dto!.comments.map((comment) => comment.id)).toEqual(['published'])
    expect(dto!.commentCount).toBe(1)
  })

  it('后台读取返回全部状态供审核，计数口径不变', async () => {
    const [dto] = await service.serialize([note(rows)], '', true)
    expect(dto!.comments.map((comment) => comment.moderationStatus)).toEqual([
      'published',
      'pending',
      'pending',
      'hidden',
    ])
    expect(dto!.commentCount).toBe(1)
  })
})

describe('AdminFlashCommentService', () => {
  type Row = { id: string; status: FlashCommentStatus; flashNote: { id: string; content: string } }
  function setup(rows: Row[], owned = rows.map((row) => row.flashNote.id)) {
    const em = {
      find: jest.fn((entity: unknown, _where?: unknown, _options?: unknown) =>
        Promise.resolve(
          entity === FlashComment
            ? rows
            : owned.map((id) => ({ id, userId: 'tixxin', content: '闪念正文', isDraft: false, isArchived: false })),
        ),
      ),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      flush: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined),
      nativeDelete: jest.fn().mockResolvedValue(1),
      transactional: jest.fn(),
    }
    em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
    const flashes = flashService(em)
    return { em, service: new AdminFlashCommentService(em as unknown as EntityManager, flashes) }
  }
  const row = (id: string, status: FlashCommentStatus, flashId = 'note-1'): Row =>
    ({
      id,
      status,
      authorId: visitor,
      authorName: '读者',
      authorAvatar: '/avatar.svg',
      content: '评论',
      createdAt: date,
      flashNote: { id: flashId, content: '闪念正文', isDraft: false, isArchived: false },
    }) as unknown as Row

  it('列表限定本站闪念并按状态与单条编号筛选，最新在前', async () => {
    const { service, em } = setup([])
    await service.list(Object.assign(new QueryAdminFlashCommentsDto(), { status: 'pending', commentId: 'c1' }))
    expect(em.findAndCount).toHaveBeenCalledWith(
      FlashComment,
      { flashNote: { userId: 'tixxin' }, status: 'pending', id: 'c1' },
      expect.objectContaining({ populate: ['flashNote'], orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    )
  })

  it('单条审核锁定评论行，状态已被他人改变时返回冲突', async () => {
    const pending = row('c1', 'pending')
    const { service, em } = setup([pending])
    await expect(service.moderate('note-1', 'c1', 'published', 'pending')).resolves.toMatchObject({
      id: 'c1',
      moderationStatus: 'published',
      status: 'published',
      flashId: 'note-1',
    })
    expect(em.find.mock.calls[0]![2]).toMatchObject({ lockMode: LockMode.PESSIMISTIC_WRITE })
    pending.status = 'hidden'
    await expect(service.moderate('note-1', 'c1', 'published', 'pending')).rejects.toMatchObject({ status: 409 })
    await expect(service.moderate('other-note', 'c1', 'hidden', 'hidden')).rejects.toMatchObject({ status: 404 })
  })

  it('批量审核逐条返回结果：不存在、非本站与状态冲突跳过，其余生效', async () => {
    const rows = [row('ok', 'pending'), row('conflict', 'hidden'), row('foreign', 'pending', 'foreign-note')]
    const { service, em } = setup(rows, ['note-1'])
    const result = await service.batchModerate('published', [
      { id: 'ok', expectedStatus: 'pending' },
      { id: 'conflict', expectedStatus: 'pending' },
      { id: 'foreign', expectedStatus: 'pending' },
      { id: 'missing', expectedStatus: 'pending' },
    ])
    expect(result).toEqual({
      ok: true,
      status: 'published',
      successCount: 1,
      failedCount: 3,
      results: [
        { id: 'ok', ok: true, moderationStatus: 'published' },
        { id: 'conflict', ok: false, reason: 'conflict', moderationStatus: 'hidden' },
        { id: 'foreign', ok: false, reason: 'not_found' },
        { id: 'missing', ok: false, reason: 'not_found' },
      ],
    })
    expect(rows[0]!.status).toBe('published')
    expect(rows[1]!.status).toBe('hidden')
    expect(em.flush).toHaveBeenCalledTimes(1)
  })

  it('批量删除只删除状态与提交一致的评论', async () => {
    const { service, em } = setup([row('a', 'pending'), row('b', 'published')])
    const result = await service.batchRemove([
      { id: 'a', expectedStatus: 'pending' },
      { id: 'b', expectedStatus: 'pending' },
    ])
    expect(result).toMatchObject({ ok: true, deleted: 1, successCount: 1, failedCount: 1 })
    expect(em.nativeDelete).toHaveBeenCalledWith(FlashComment, { id: { $in: ['a'] } })
  })
})

describe('闪念评论审核 DTO', () => {
  const errors = (type: new () => object, value: unknown) =>
    validateSync(plainToInstance(type, value) as object, { whitelist: true, forbidNonWhitelisted: true })
  const items = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `c${index}`, expectedStatus: 'pending' }))

  it('批量请求要求 1–100 条且编号不重复，状态只接受三种审核状态', () => {
    expect(errors(BatchFlashCommentDeleteDto, { items: items(1) })).toHaveLength(0)
    expect(errors(BatchFlashCommentDeleteDto, { items: [] })).not.toHaveLength(0)
    expect(errors(BatchFlashCommentDeleteDto, { items: items(FLASH_COMMENT_BATCH_LIMIT + 1) })).not.toHaveLength(0)
    expect(errors(BatchFlashCommentDeleteDto, { items: [...items(1), ...items(1)] })).not.toHaveLength(0)
    expect(errors(BatchFlashCommentDeleteDto, { items: [{ id: 'c1' }] })).not.toHaveLength(0)
    expect(errors(BatchFlashCommentModerationDto, { items: items(2), status: 'hidden' })).toHaveLength(0)
    expect(errors(BatchFlashCommentModerationDto, { items: items(2), status: 'spam' })).not.toHaveLength(0)
  })

  it('单条审核必须带提交时看到的状态', () => {
    expect(errors(ModerateFlashCommentDto, { status: 'published', expectedStatus: 'pending' })).toHaveLength(0)
    expect(errors(ModerateFlashCommentDto, { status: 'published' })).not.toHaveLength(0)
    expect(errors(ModerateFlashCommentDto, { status: 'deleted', expectedStatus: 'pending' })).not.toHaveLength(0)
  })

  it('列表筛选只接受 all 与三种审核状态，分页有上限', () => {
    expect(errors(QueryAdminFlashCommentsDto, { status: 'pending', page: '2', pageSize: '20' })).toHaveLength(0)
    expect(errors(QueryAdminFlashCommentsDto, { status: 'spam' })).not.toHaveLength(0)
    expect(errors(QueryAdminFlashCommentsDto, { pageSize: '101' })).not.toHaveLength(0)
  })
})
