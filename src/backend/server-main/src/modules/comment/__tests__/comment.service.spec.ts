/**
 * @file comment.service.spec.ts
 * @description 评论业务回归：校验、回复边界、访客身份隔离与读取点赞状态
 */
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Comment } from '../../../entities/comment.entity'
import { CommentLike } from '../../../entities/comment-like.entity'
import { Post } from '../../../entities/post.entity'
import { CommentService } from '../comment.service'
import { CreateCommentDto } from '../dto/create-comment.dto'

const input = { author: '联调测试', content: '评论正文' }
function setup(status = 'published', parentDepth = 0) {
  const post = { id: 1, status, commentCount: 99 }
  const parent = { id: 10, depth: parentDepth }
  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    nativeDelete: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(async (entity: unknown) => (entity === Post ? post : parent)),
    count: jest.fn().mockResolvedValue(2),
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => ({ id: 20, ...data })),
    flush: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { em, post, service: new CommentService(em as unknown as EntityManager) }
}

describe('评论请求校验', () => {
  it('去除首尾空白，拒绝空白、超长内容和越界 parentId', async () => {
    const dto = plainToInstance(CreateCommentDto, { author: ' 测试 ', content: ' 正文 ' })
    expect(await validate(dto)).toHaveLength(0)
    expect(dto).toMatchObject({ author: '测试', content: '正文' })
    for (const patch of [{ content: ' \n ' }, { author: '  ' }, { content: '字'.repeat(1001) }, { parentId: 0 }]) {
      expect((await validate(plainToInstance(CreateCommentDto, { ...input, ...patch }))).length).toBeGreaterThan(0)
    }
  })
})

describe('CommentService', () => {
  it('归档文章拒评，草稿文章不可评论', async () => {
    for (const [status, code] of [
      ['archived', 1002],
      ['draft', 1001],
    ] as const) {
      const { service, em } = setup(status)
      await expect(service.create(1, input, 'visitor-hash')).rejects.toMatchObject({ code })
      expect(em.create).not.toHaveBeenCalled()
    }
  })

  it('不存在或不属于本文章的父评论拒绝写入', async () => {
    const { service, em } = setup()
    em.findOne.mockImplementation(async (entity) =>
      entity === Post ? { id: 1, status: 'published', commentCount: 0 } : (null as never),
    )
    await expect(service.create(1, { ...input, parentId: 999 }, 'hash')).rejects.toMatchObject({
      message: '父评论不存在',
    })
    expect(em.findOne).toHaveBeenCalledWith(
      Comment,
      expect.objectContaining({ id: 999, post: expect.objectContaining({ id: 1 }) }),
    )
    expect(em.create).not.toHaveBeenCalled()
  })

  it('第三层不能继续回复', async () => {
    const { service, em } = setup('published', 2)
    await expect(service.create(1, { ...input, parentId: 10 }, 'hash')).rejects.toMatchObject({ code: 1003 })
    expect(em.create).not.toHaveBeenCalled()
  })

  it('回复挂到指定父节点，计数以数据库为准，游客始终不是作者', async () => {
    const { service, em, post } = setup('published', 1)
    const result = await service.create(1, { ...input, parentId: 10 }, 'visitor-hash')
    expect(em.create).toHaveBeenCalledWith(
      Comment,
      expect.objectContaining({
        parent: { id: 10, depth: 1 },
        depth: 2,
        isOwner: false,
        authorSnapshot: expect.objectContaining({ visitorIdHash: 'visitor-hash' }),
      }),
    )
    expect(result).toMatchObject({ id: 20, isOwner: false, liked: false })
    expect(post.commentCount).toBe(3)
  })

  it('评论树仅标记本次访客的点赞，匿名 SSR 不查询个人状态', async () => {
    const { service, em } = setup()
    const comment = {
      id: 5,
      authorSnapshot: { name: '访客', avatar: '' },
      content: '正文',
      likes: 3,
      isOwner: false,
      createdAt: new Date('2026-09-06T00:00:00Z'),
    }
    em.find.mockImplementation(async (entity) => (entity === Comment ? [comment] : [{ comment: { id: 5 } }]))
    const personal = await service.getTree(1, 'mine')
    expect(personal.items[0]).toMatchObject({ liked: true, likes: 3 })
    expect(em.find).toHaveBeenCalledWith(CommentLike, { comment: { $in: [5] }, visitorIdHash: 'mine' })
    em.find.mockClear()
    const anonymous = await service.getTree(1)
    expect(anonymous.items[0]?.liked).toBe(false)
    expect(em.find).toHaveBeenCalledTimes(1)
  })
})
