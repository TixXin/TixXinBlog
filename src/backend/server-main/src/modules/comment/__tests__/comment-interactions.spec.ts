/**
 * @file comment-interactions.spec.ts
 * @description 公开评论树与点赞回归：可见性、访客隔离、事务锁顺序及失败写入边界
 */
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Comment } from '../../../entities/comment.entity'
import { CommentLike } from '../../../entities/comment-like.entity'
import { Post } from '../../../entities/post.entity'
import { CommentService } from '../comment.service'

// 独立声明公开契约，避免调用被测查询构造器来生成期望值。
const publicVisibility = {
  status: 'published',
  $or: [
    { parent: null },
    { parent: { status: 'published', $or: [{ parent: null }, { parent: { status: 'published', parent: null } }] } },
  ],
}

function makeComment(id: number, parent?: Comment): Comment {
  return Object.assign(new Comment(), {
    id,
    parent,
    depth: parent ? parent.depth + 1 : 0,
    authorSnapshot: { name: `读者${id}`, avatar: '/avatar.svg', visitorIdHash: `private-${id}` },
    content: `读后感 ${id}`,
    likes: id,
    createdAt: new Date(`2026-10-18T04:00:0${id}Z`),
  })
}

function treeSetup() {
  const post = { id: 7, status: 'published', deletedAt: null as Date | null }
  const root = makeComment(1)
  const reply = makeComment(2, root)
  const nestedReply = makeComment(3, reply)
  nestedReply.isOwner = true
  const otherRoot = makeComment(4)
  const comments = [root, reply, nestedReply, otherRoot]
  const visitorLikes = new Map([
    ['reader-a', [{ comment: reply }]],
    ['reader-b', [{ comment: otherRoot }]],
  ])
  const em = {
    findOne: jest.fn().mockResolvedValue(post),
    find: jest.fn(async (entity: unknown, where: { visitorIdHash?: string }) => {
      if (entity === Comment) return comments
      if (entity === CommentLike) return visitorLikes.get(where.visitorIdHash ?? '') ?? []
      throw new Error('未配置的实体查询')
    }),
  }
  return { service: new CommentService(em as unknown as EntityManager), em, post, comments }
}

function likeSetup() {
  const post = { id: 7, status: 'published', deletedAt: null }
  // 首次读取只用于定位文章；实际计数必须使用取得写锁后的实体。
  const target = { id: 8, post, likes: 99 }
  const comment = { id: 8, post, likes: 3 }
  const state = { targetMissing: false, postMissing: false, visible: true, lockedMissing: false }
  const likes = new Map<string, object>()
  const transactionEm = {
    findOne: jest.fn(async (entity: unknown, where: { visitorIdHash?: string }, options?: { lockMode?: LockMode }) => {
      if (entity === Post) return state.postMissing ? null : post
      if (entity === Comment)
        return options?.lockMode ? (state.lockedMissing ? null : comment) : state.targetMissing ? null : target
      if (entity === CommentLike) return likes.get(where.visitorIdHash ?? '') ?? null
      throw new Error('未配置的实体查询')
    }),
    count: jest.fn(async () => (state.visible ? 1 : 0)),
    create: jest.fn((entity: unknown, data: { visitorIdHash: string }) => {
      if (entity !== CommentLike) throw new Error('未配置的实体创建')
      likes.set(data.visitorIdHash, data)
      return data
    }),
    remove: jest.fn((existing: object) => {
      for (const [visitor, like] of likes) if (like === existing) likes.delete(visitor)
    }),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  const em = {
    transactional: jest.fn(async (run: (manager: typeof transactionEm) => Promise<unknown>) => run(transactionEm)),
  }
  return {
    service: new CommentService(em as unknown as EntityManager),
    em,
    transactionEm,
    post,
    target,
    comment,
    likes,
    state,
  }
}

describe('CommentService.getTree 公开评论树', () => {
  it('只读取公开文章的状态列，并同时约束自身、父评论与根评论的审核状态', async () => {
    const { service, em, post } = treeSetup()

    await service.getTree(7)

    expect(em.findOne).toHaveBeenCalledWith(Post, { id: 7 }, { fields: ['id', 'status', 'deletedAt'] })
    expect(em.find).toHaveBeenCalledWith(
      Comment,
      { post, ...publicVisibility },
      { orderBy: { createdAt: 'asc', id: 'asc' }, populate: ['parent'] },
    )
    expect(em.find).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['归档文章', 'archived', null],
    ['草稿文章', 'draft', null],
    ['回收文章', 'published', new Date('2026-10-17T00:00:00Z')],
  ])('%s 不允许读取评论或访客点赞状态', async (_label, status, deletedAt) => {
    const { service, em, post } = treeSetup()
    Object.assign(post, { status, deletedAt })

    await expect(service.getTree(7, 'reader-a')).rejects.toMatchObject({ code: 1001, status: 404 })

    expect(em.find).not.toHaveBeenCalled()
  })

  it('文章不存在时返回 404，不继续读取评论', async () => {
    const { service, em } = treeSetup()
    em.findOne.mockResolvedValue(null)

    await expect(service.getTree(7)).rejects.toMatchObject({ code: 1001, status: 404 })

    expect(em.find).not.toHaveBeenCalled()
  })

  it('组装三层回复，total 包含全部层级且不暴露作者身份哈希', async () => {
    const { service } = treeSetup()

    const result = await service.getTree(7, 'reader-a')

    expect(result.total).toBe(4)
    expect(result.items.map((item) => item.id)).toEqual([1, 4])
    expect(result.items[0]).toEqual({
      id: 1,
      author: '读者1',
      avatar: '/avatar.svg',
      content: '读后感 1',
      time: '2026-10-18T04:00:01.000Z',
      likes: 1,
      liked: false,
      isOwner: false,
      replies: [
        {
          id: 2,
          author: '读者2',
          avatar: '/avatar.svg',
          content: '读后感 2',
          time: '2026-10-18T04:00:02.000Z',
          likes: 2,
          liked: true,
          isOwner: false,
          replies: [
            {
              id: 3,
              author: '读者3',
              avatar: '/avatar.svg',
              content: '读后感 3',
              time: '2026-10-18T04:00:03.000Z',
              likes: 3,
              liked: false,
              isOwner: true,
              replies: [],
            },
          ],
        },
      ],
    })
    expect(JSON.stringify(result)).not.toContain('private-')
  })

  it('不同访客只读取自己对当前公开评论的点赞，匿名请求不继承个人状态', async () => {
    const { service, em } = treeSetup()

    const first = await service.getTree(7, 'reader-a')
    const second = await service.getTree(7, 'reader-b')
    const anonymous = await service.getTree(7)

    expect(first.items[0]?.replies[0]?.liked).toBe(true)
    expect(first.items[1]?.liked).toBe(false)
    expect(second.items[0]?.replies[0]?.liked).toBe(false)
    expect(second.items[1]?.liked).toBe(true)
    expect(anonymous.items[0]?.replies[0]?.liked).toBe(false)
    expect(anonymous.items[1]?.liked).toBe(false)
    expect(em.find.mock.calls.filter(([entity]) => entity === CommentLike)).toEqual([
      [CommentLike, { comment: { $in: [1, 2, 3, 4] }, visitorIdHash: 'reader-a' }],
      [CommentLike, { comment: { $in: [1, 2, 3, 4] }, visitorIdHash: 'reader-b' }],
    ])
  })

  it('无公开评论时返回空树和零总数，即使携带访客身份也不查询点赞', async () => {
    const { service, em, comments } = treeSetup()
    comments.length = 0

    await expect(service.getTree(7, 'reader-a')).resolves.toEqual({ items: [], total: 0 })

    expect(em.find).toHaveBeenCalledTimes(1)
  })
})

describe('CommentService.toggleLike 评论点赞', () => {
  it('在同一事务内先锁文章、校验公开祖先，再锁评论并增加点赞', async () => {
    const { service, em, transactionEm, post, target, comment, likes } = likeSetup()

    await expect(service.toggleLike(8, 'reader-a')).resolves.toEqual({ liked: true, likes: 4 })

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(transactionEm.findOne.mock.calls).toEqual([
      [Comment, { id: 8 }],
      [Post, { id: post.id, status: 'published', deletedAt: null }, { lockMode: LockMode.PESSIMISTIC_WRITE }],
      [Comment, { id: 8 }, { lockMode: LockMode.PESSIMISTIC_WRITE }],
      [CommentLike, { comment, visitorIdHash: 'reader-a' }],
    ])
    expect(transactionEm.count).toHaveBeenCalledWith(Comment, { id: 8, ...publicVisibility })
    const queryOrder = transactionEm.findOne.mock.invocationCallOrder
    expect(queryOrder[1]).toBeLessThan(transactionEm.count.mock.invocationCallOrder[0]!)
    expect(transactionEm.count.mock.invocationCallOrder[0]).toBeLessThan(queryOrder[2]!)
    expect(queryOrder[3]).toBeLessThan(transactionEm.create.mock.invocationCallOrder[0]!)
    expect(transactionEm.create.mock.invocationCallOrder[0]).toBeLessThan(
      transactionEm.flush.mock.invocationCallOrder[0]!,
    )
    expect(transactionEm.create).toHaveBeenCalledWith(CommentLike, {
      comment,
      visitorIdHash: 'reader-a',
      createdAt: expect.any(Date),
    })
    expect(likes.has('reader-a')).toBe(true)
    expect(target.likes).toBe(99)
    expect(transactionEm.remove).not.toHaveBeenCalled()
    expect(transactionEm.flush).toHaveBeenCalledTimes(1)
  })

  it.each([
    [3, 2],
    [0, 0],
  ])('取消已有点赞时将计数 %i 调整为 %i，最低为零', async (before, after) => {
    const { service, transactionEm, comment, likes } = likeSetup()
    comment.likes = before
    const existing = { id: 12, comment, visitorIdHash: 'reader-a' }
    likes.set('reader-a', existing)

    await expect(service.toggleLike(8, 'reader-a')).resolves.toEqual({ liked: false, likes: after })

    expect(transactionEm.remove).toHaveBeenCalledWith(existing)
    expect(transactionEm.create).not.toHaveBeenCalled()
    expect(transactionEm.flush).toHaveBeenCalledTimes(1)
    expect(comment.likes).toBe(after)
    expect(likes.has('reader-a')).toBe(false)
  })

  it('不同访客的点赞分别保存，重复切换只移除当前访客记录', async () => {
    const { service, transactionEm, likes } = likeSetup()

    await expect(service.toggleLike(8, 'reader-a')).resolves.toEqual({ liked: true, likes: 4 })
    await expect(service.toggleLike(8, 'reader-b')).resolves.toEqual({ liked: true, likes: 5 })
    const firstLike = likes.get('reader-a')
    const secondLike = likes.get('reader-b')
    await expect(service.toggleLike(8, 'reader-a')).resolves.toEqual({ liked: false, likes: 4 })

    expect([...likes.entries()]).toEqual([['reader-b', secondLike]])
    expect(transactionEm.remove).toHaveBeenCalledTimes(1)
    expect(transactionEm.remove).toHaveBeenCalledWith(firstLike)
    expect(transactionEm.create).toHaveBeenCalledTimes(2)
    expect(transactionEm.flush).toHaveBeenCalledTimes(3)
  })

  it.each([
    { label: '评论不存在', failure: 'targetMissing', queries: 1, counts: 0 },
    { label: '文章不满足已发布且未回收条件', failure: 'postMissing', queries: 2, counts: 0 },
    { label: '评论或祖先未通过公开审核', failure: 'visible', queries: 2, counts: 1 },
    { label: '取得评论锁时记录已消失', failure: 'lockedMissing', queries: 3, counts: 1 },
  ] as const)('$label 时返回 404，停止后续查询且不修改点赞', async ({ failure, queries, counts }) => {
    const { service, transactionEm, state, target, comment } = likeSetup()
    state[failure] = failure !== 'visible'

    await expect(service.toggleLike(8, 'reader-a')).rejects.toMatchObject({ code: 30, status: 404 })

    expect(transactionEm.findOne).toHaveBeenCalledTimes(queries)
    expect(transactionEm.count).toHaveBeenCalledTimes(counts)
    expect(transactionEm.create).not.toHaveBeenCalled()
    expect(transactionEm.remove).not.toHaveBeenCalled()
    expect(transactionEm.flush).not.toHaveBeenCalled()
    expect(target.likes).toBe(99)
    expect(comment.likes).toBe(3)
  })

  it('持久化失败继续抛出错误，不返回虚假的点赞成功', async () => {
    const { service, transactionEm } = likeSetup()
    const failure = new Error('写入失败')
    transactionEm.flush.mockRejectedValueOnce(failure)

    await expect(service.toggleLike(8, 'reader-a')).rejects.toBe(failure)

    expect(transactionEm.flush).toHaveBeenCalledTimes(1)
  })
})
