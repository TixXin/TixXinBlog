/**
 * @file admin-comment-batch.spec.ts
 * @description 评论批量审核与删除：请求校验（空列表、上限、重复）、管理员守卫、逐条版本校验、部分不存在与汇总审计映射
 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import type { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { Comment } from '../../../entities/comment.entity'
import { Post } from '../../../entities/post.entity'
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard'
import { auditDescriptor, auditResult } from '../../audit/audit-description'
import {
  AdminCommentController,
  BatchCommentDeleteDto,
  BatchCommentModerationDto,
  COMMENT_BATCH_LIMIT,
} from '../admin-comment.controller'
import { AdminCommentService } from '../admin-comment.service'
import type { CommentService } from '../comment.service'
import type { CommentModerationService } from '../comment-moderation.service'

function selection(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1, revision: 0 }))
}

describe('评论批量请求校验', () => {
  it('拒绝空列表、超过上限、重复编号和非法状态', async () => {
    expect(await validate(plainToInstance(BatchCommentDeleteDto, { items: [] }))).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchCommentDeleteDto, { items: selection(COMMENT_BATCH_LIMIT + 1) })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchCommentDeleteDto, { items: selection(COMMENT_BATCH_LIMIT) })),
    ).toHaveLength(0)
    expect(
      await validate(
        plainToInstance(BatchCommentDeleteDto, {
          items: [
            { id: 1, revision: 0 },
            { id: 1, revision: 1 },
          ],
        }),
      ),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchCommentDeleteDto, { items: [{ id: 0, revision: -1 }] })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchCommentModerationDto, { status: 'deleted', items: selection(1) })),
    ).not.toHaveLength(0)
    expect(
      await validate(plainToInstance(BatchCommentModerationDto, { status: 'spam', items: selection(2) })),
    ).toHaveLength(0)
  })

  it('批量接口与单条接口同在管理员守卫下，并使用独立批量审计动作', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminCommentController)).toContain(AdminAuthGuard)
    expect(auditDescriptor('/api/v1/admin/comments/batch/moderation', 'POST')).toEqual({
      action: 'comment.batch.moderate',
      resourceType: 'comment',
      resourceId: undefined,
    })
    expect(auditDescriptor('/api/v1/admin/comments/batch/delete', 'POST')).toMatchObject({
      action: 'comment.batch.delete',
      resourceType: 'comment',
    })
  })

  it('汇总审计记录成功与失败数量，部分成功记为 partial、全部失败记为 failure', () => {
    const partial = auditResult(
      { status: 'hidden', items: selection(3) },
      { ok: true, status: 'hidden', successCount: 2, failedCount: 1, results: [] },
    )
    expect(partial).toMatchObject({ partial: true, failed: false })
    expect(partial.summary).toMatchObject({
      fields: ['状态'],
      targetState: 'hidden',
      counts: { successCount: 2, failedCount: 1 },
    })
    expect(auditResult({}, { successCount: 0, failedCount: 2, deleted: 0 })).toMatchObject({ failed: true })
    // 审计摘要只保留白名单字段，不写入选中的评论编号列表。
    expect(JSON.stringify(partial.summary)).not.toContain('items')
  })
})

function setup(comments: Partial<Comment>[], deleted = 0) {
  const posts = [...new Set(comments.map((comment) => (comment.post as Post).id))].map((id) => ({
    id,
    commentCount: 99,
  }))
  const em = {
    transactional: jest.fn(),
    find: jest.fn(async (entity: unknown, where: { id: { $in: number[] } }) =>
      entity === Post
        ? posts.filter((post) => where.id.$in.includes(post.id))
        : comments.filter((comment) => where.id.$in.includes(comment.id!)),
    ),
    count: jest.fn().mockResolvedValue(7),
    flush: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue([{ count: deleted }]),
    nativeDelete: jest.fn().mockResolvedValue(1),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  const service = new AdminCommentService(
    em as unknown as EntityManager,
    {} as CommentService,
    {} as CommentModerationService,
  )
  return { em, posts, service }
}
const comment = (id: number, revision: number, status: Comment['status'] = 'pending', postId = 1) =>
  ({ id, revision, status, post: { id: postId } }) as unknown as Comment

describe('AdminCommentService 批量审核', () => {
  it('单事务内锁定文章与评论，逐条校验版本，跳过不存在与已变化项并重算公开计数', async () => {
    const items = [comment(1, 3), comment(2, 5, 'published', 2), comment(3, 1)]
    const { em, posts, service } = setup(items)
    const result = await service.batchModerate('published', [
      { id: 1, revision: 3 },
      { id: 2, revision: 4 },
      { id: 3, revision: 1 },
      { id: 404, revision: 0 },
    ])
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.find).toHaveBeenCalledWith(
      Post,
      { id: { $in: [1, 2] } },
      expect.objectContaining({ lockMode: LockMode.PESSIMISTIC_WRITE, orderBy: { id: 'asc' } }),
    )
    expect(em.find).toHaveBeenCalledWith(
      Comment,
      { id: { $in: [1, 2, 3, 404] } },
      expect.objectContaining({ lockMode: LockMode.PESSIMISTIC_WRITE }),
    )
    expect(result).toMatchObject({ ok: true, status: 'published', successCount: 2, failedCount: 2 })
    expect(result.results).toEqual([
      { id: 1, ok: true, revision: 4 },
      { id: 2, ok: false, reason: 'conflict', revision: 5 },
      { id: 3, ok: true, revision: 2 },
      { id: 404, ok: false, reason: 'not_found' },
    ])
    expect(items[0]).toMatchObject({ status: 'published', revision: 4 })
    expect(items[0]!.moderatedAt).toBeInstanceOf(Date)
    expect(items[1]).toMatchObject({ status: 'published', revision: 5 })
    expect(posts.map((post) => post.commentCount)).toEqual([7, 7])
  })

  it('状态未变化时视为成功但不递增版本', async () => {
    const items = [comment(1, 2, 'hidden')]
    const { service } = setup(items)
    const result = await service.batchModerate('hidden', [{ id: 1, revision: 2 }])
    expect(result).toMatchObject({ successCount: 1, failedCount: 0 })
    expect(items[0]).toMatchObject({ revision: 2 })
  })

  it('全部不存在时不锁文章、不改数据，结果全部失败', async () => {
    const { em, service } = setup([])
    const result = await service.batchModerate('spam', [{ id: 9, revision: 0 }])
    expect(result).toMatchObject({ successCount: 0, failedCount: 1 })
    expect(em.find).not.toHaveBeenCalledWith(Post, expect.anything(), expect.anything())
  })
})

describe('AdminCommentService 批量删除', () => {
  it('只删除版本一致的评论，回复级联去重计数，并重算文章评论数', async () => {
    const items = [comment(1, 0), comment(2, 3)]
    const { em, posts, service } = setup(items, 5)
    const result = await service.batchRemove([
      { id: 1, revision: 0 },
      { id: 2, revision: 2 },
      { id: 3, revision: 0 },
    ])
    expect(em.execute).toHaveBeenCalledWith(expect.stringContaining('union'), [[1]])
    expect(em.nativeDelete).toHaveBeenCalledWith(Comment, { id: { $in: [1] } })
    expect(result).toMatchObject({ ok: true, deleted: 5, successCount: 1, failedCount: 2 })
    expect(result.results.map((item) => item.reason)).toEqual([undefined, 'conflict', 'not_found'])
    expect(posts[0]!.commentCount).toBe(7)
  })

  it('没有可删除项时不执行删除', async () => {
    const { em, service } = setup([comment(1, 4)])
    const result = await service.batchRemove([{ id: 1, revision: 0 }])
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(result).toMatchObject({ deleted: 0, successCount: 0, failedCount: 1 })
  })
})
