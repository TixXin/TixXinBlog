/**
 * @file comment.service.spec.ts
 * @description 评论业务回归：审核策略、回复边界、头像白名单、幂等提交与访客身份隔离
 */
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import type { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { Comment } from '../../../entities/comment.entity'
import { CommentLike } from '../../../entities/comment-like.entity'
import { CommentPolicy } from '../../../entities/comment-policy.entity'
import { CommentSubmission } from '../../../entities/comment-submission.entity'
import { MediaAsset } from '../../../entities/media-asset.entity'
import { MediaReference } from '../../../entities/media-reference.entity'
import { Post } from '../../../entities/post.entity'
import { CommentService } from '../comment.service'
import { CreateCommentDto } from '../dto/create-comment.dto'

const input = { author: '联调测试', content: '评论正文' }
function setup(status = 'published', parentDepth = 0) {
  const post = { id: 1, status, commentCount: 99, deletedAt: null as Date | null }
  const parent = { id: 10, depth: parentDepth }
  const comments: Comment[] = []
  const submissions = new Map<string, CommentSubmission>()
  const state = {
    post: post as typeof post | null,
    parent: parent as typeof parent | null,
    policy: null as Pick<CommentPolicy, 'requireApproval'> | null,
    mediaAvailable: true,
  }
  const em = {
    transactional: jest.fn(),
    execute: jest.fn().mockResolvedValue([]),
    nativeDelete: jest.fn().mockResolvedValue(0),
    // 按实体区分返回值，避免把父评论误当成审核策略或历史提交。
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === Post) return state.post
      if (entity === Comment) return state.parent
      if (entity === CommentPolicy) return state.policy
      if (entity === CommentSubmission) return submissions.get(String(where.id)) ?? null
      throw new Error('未配置的实体查询')
    }),
    count: jest.fn(async (entity: unknown) => {
      if (entity === Comment) return 2
      if (entity === MediaAsset) return state.mediaAvailable ? 1 : 0
      throw new Error('未配置的实体计数')
    }),
    create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
      if (entity === Comment) {
        const comment = { id: 20 + comments.length, ...data } as unknown as Comment
        comments.push(comment)
        return comment
      }
      if (entity === CommentSubmission) {
        const submission = data as unknown as CommentSubmission
        submissions.set(submission.id, submission)
        return submission
      }
      if (entity === MediaReference) return data
      throw new Error('未配置的实体创建')
    }),
    getReference: jest.fn((_entity: unknown, id: string) => ({ id })),
    flush: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { em, post, parent, state, comments, submissions, service: new CommentService(em as unknown as EntityManager) }
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

  it('接受 UUID v4 提交标识与整数回复编号，拒绝非法提交标识', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      ...input,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      parentId: '10',
    })
    expect(await validate(dto)).toHaveLength(0)
    expect(dto.parentId).toBe(10)
    for (const requestId of ['invalid', 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa']) {
      const errors = await validate(plainToInstance(CreateCommentDto, { ...input, requestId }))
      expect(errors.map((error) => error.property)).toContain('requestId')
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
    const { service, em, state } = setup()
    state.parent = null
    await expect(service.create(1, { ...input, parentId: 999 }, 'hash')).rejects.toMatchObject({
      message: '父评论不存在',
    })
    expect(em.findOne).toHaveBeenCalledWith(
      Comment,
      expect.objectContaining({ id: 999, post: expect.objectContaining({ id: 1 }) }),
    )
    expect(em.create).not.toHaveBeenCalled()
  })

  it('头像复用白名单：拒绝非 HTTP(S) 协议，默认头像与 HTTPS 地址可用', async () => {
    for (const avatar of [
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      '//evil.example/a.png',
      'https://u:p@x.example/a',
    ]) {
      const { service, em } = setup()
      await expect(service.create(1, { ...input, avatar }, 'hash')).rejects.toMatchObject({ status: 400 })
      expect(em.create).not.toHaveBeenCalled()
    }
    for (const [avatar, stored] of [
      [undefined, '/avatar.svg'],
      ['/avatar.svg', '/avatar.svg'],
      ['https://q1.qlogo.cn/g?b=qq&nk=10001&s=100', 'https://q1.qlogo.cn/g?b=qq&nk=10001&s=100'],
    ] as const) {
      const { service, em } = setup()
      await service.create(1, { ...input, avatar }, 'hash')
      expect(em.create).toHaveBeenCalledWith(
        Comment,
        expect.objectContaining({ authorSnapshot: expect.objectContaining({ avatar: stored }) }),
      )
    }
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

describe('公开评论创建与审核', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T04:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('所有创建查询与写入使用事务回调中的 EntityManager', async () => {
    const { em, comments } = setup()
    const outerEm = {
      transactional: jest.fn(async (run: (manager: typeof em) => Promise<unknown>) => run(em)),
    }
    const service = new CommentService(outerEm as unknown as EntityManager)

    await expect(service.create(1, input, 'visitor-hash')).resolves.toMatchObject({ id: 20 })

    expect(outerEm.transactional).toHaveBeenCalledTimes(1)
    expect(em.transactional).not.toHaveBeenCalled()
    expect(comments).toHaveLength(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
  })

  it.each([
    { policy: null, isOwner: false, status: 'published', count: 3, reason: 'new_comment' },
    { policy: { requireApproval: false }, isOwner: false, status: 'published', count: 3, reason: 'new_comment' },
    { policy: { requireApproval: true }, isOwner: false, status: 'pending', count: 2, reason: 'pending_review' },
    { policy: { requireApproval: true }, isOwner: true, status: 'published', count: 3, reason: null },
  ])('策略 $policy、博主 $isOwner 时保存为 $status', async ({ policy, isOwner, status, count, reason }) => {
    const { service, em, post, state, comments, submissions } = setup()
    state.policy = policy

    const result = await service.create(1, input, 'visitor-hash', isOwner)

    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(Post, { id: 1 }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    expect(em.findOne).toHaveBeenCalledWith(CommentPolicy, { id: 'default' }, { refresh: true })
    expect(em.count).toHaveBeenCalledWith(Comment, {
      post,
      status: 'published',
      $or: [
        { parent: null },
        { parent: { status: 'published', $or: [{ parent: null }, { parent: { status: 'published', parent: null } }] } },
      ],
    })
    expect(comments).toHaveLength(1)
    expect(comments[0]).toMatchObject({
      status,
      post,
      depth: 0,
      parent: undefined,
      authorSnapshot: { name: input.author, avatar: '/avatar.svg', visitorIdHash: 'visitor-hash' },
      content: input.content,
      likes: 0,
      isOwner,
      createdAt: new Date('2026-10-18T04:00:00Z'),
    })
    expect(result).toEqual({
      moderationStatus: status,
      id: 20,
      author: input.author,
      avatar: '/avatar.svg',
      content: input.content,
      time: '2026-10-18T04:00:00.000Z',
      likes: 0,
      liked: false,
      isOwner,
      replies: [],
    })
    expect(post.commentCount).toBe(count)
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'comment:20' })
    expect(submissions.size).toBe(0)
    expect(em.findOne.mock.calls.some(([entity]) => entity === CommentSubmission)).toBe(false)
    const events = em.execute.mock.calls.filter(([sql]) => String(sql).startsWith('insert into owner_notification'))
    if (reason) {
      expect(events).toEqual([[expect.any(String), [expect.any(String), 'comment:20', 'comment', '20', reason]]])
    } else {
      expect(events).toEqual([])
    }
  })

  it('每次提交重新读取审核策略，修改后立即决定新评论状态', async () => {
    const { service, state, comments, em } = setup()
    state.policy = { requireApproval: false }
    await expect(service.create(1, input, 'visitor-hash')).resolves.toMatchObject({ moderationStatus: 'published' })
    state.policy = { requireApproval: true }
    await expect(service.create(1, input, 'visitor-hash')).resolves.toMatchObject({ moderationStatus: 'pending' })
    expect(comments.map((comment) => comment.status)).toEqual(['published', 'pending'])
    expect(em.findOne.mock.calls.filter(([entity]) => entity === CommentPolicy)).toHaveLength(2)
  })

  it.each([
    { label: '文章不存在', status: 'missing', deleted: false, code: 1001, httpStatus: 404 },
    { label: '草稿', status: 'draft', deleted: false, code: 1001, httpStatus: 404 },
    { label: '归档', status: 'archived', deleted: false, code: 1002, httpStatus: 422 },
    { label: '已回收的公开文章', status: 'published', deleted: true, code: 1001, httpStatus: 404 },
    { label: '已回收的归档文章', status: 'archived', deleted: true, code: 1001, httpStatus: 404 },
  ])('$label 拒绝创建且不写入评论、计数或通知', async ({ status, deleted, code, httpStatus }) => {
    const { service, em, post, state } = setup(status)
    if (status === 'missing') state.post = null
    if (deleted) post.deletedAt = new Date()
    await expect(service.create(1, input, 'visitor-hash')).rejects.toMatchObject({ code, status: httpStatus })
    expect(post.commentCount).toBe(99)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.execute).toHaveBeenCalledTimes(1)
  })

  it.each([0, 1])('第 %i 层父评论可回复，并使用完整祖先审核条件定位父评论', async (parentDepth) => {
    const { service, em, post, parent, state, comments } = setup('published', parentDepth)
    state.policy = { requireApproval: true }
    const result = await service.create(1, { ...input, parentId: 10 }, 'visitor-hash')
    expect(em.findOne).toHaveBeenCalledWith(Comment, {
      id: 10,
      post,
      status: 'published',
      $or: [
        { parent: null },
        { parent: { status: 'published', $or: [{ parent: null }, { parent: { status: 'published', parent: null } }] } },
      ],
    })
    expect(comments[0]).toMatchObject({ parent, depth: parentDepth + 1, status: 'pending' })
    expect(result.moderationStatus).toBe('pending')
    expect(post.commentCount).toBe(2)
  })

  it.each([2, 3])('父评论深度 %i 拒绝继续嵌套，也不查询审核或写入计数', async (parentDepth) => {
    const { service, em, post } = setup('published', parentDepth)
    await expect(service.create(1, { ...input, parentId: 10 }, 'visitor-hash')).rejects.toMatchObject({
      code: 1003,
      status: 409,
    })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.findOne.mock.calls.some(([entity]) => entity === CommentPolicy)).toBe(false)
    expect(post.commentCount).toBe(99)
  })

  it('父评论被公开查询排除时，返回 404 且不产生持久副作用', async () => {
    const { service, em, state, post } = setup()
    state.parent = null
    await expect(service.create(1, { ...input, parentId: 10 }, 'visitor-hash')).rejects.toMatchObject({
      status: 404,
      message: '父评论不存在',
    })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(post.commentCount).toBe(99)
  })
})

describe('评论头像白名单', () => {
  it('DTO 接受的 null 头像使用默认头像，并与省略头像的重试保持幂等', async () => {
    const { service, comments } = setup()
    const dto = plainToInstance(CreateCommentDto, {
      ...input,
      avatar: null,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(await validate(dto)).toHaveLength(0)
    const result = await service.create(1, dto, 'visitor-hash')
    expect(result.avatar).toBe('/avatar.svg')
    await expect(service.create(1, { ...dto, avatar: undefined }, 'visitor-hash')).resolves.toEqual(result)
    expect(comments).toHaveLength(1)
  })

  it.each([
    ['', ''],
    ['   ', ''],
    ['/avatar-photo.webp', '/avatar-photo.webp'],
    ['  /avatar.svg  ', '/avatar.svg'],
    ['http://images.example/avatar.png', 'http://images.example/avatar.png'],
    ['  HTTPS://Images.Example:443/avatar.png  ', 'https://images.example/avatar.png'],
  ])('接受并规范化允许的头像 %j', async (avatar, stored) => {
    const { service, comments } = setup()
    await expect(service.create(1, { ...input, avatar }, 'visitor-hash')).resolves.toMatchObject({ avatar: stored })
    expect(comments[0]?.authorSnapshot.avatar).toBe(stored)
  })

  it.each([
    'file:///etc/passwd',
    'ftp://images.example/avatar.png',
    '/uploads/avatar.png',
    '/avatar.svg?redirect=1',
    '/api/v1/media/not-a-uuid.webp',
    '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png',
    '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp/extra',
    'https://user@images.example/avatar.png',
    'not-a-url',
  ])('非法头像 %j 在开启事务前被拒绝', async (avatar) => {
    const { service, em } = setup()
    await expect(service.create(1, { ...input, avatar }, 'visitor-hash')).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
    expect(em.findOne).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
  })

  it('本站媒体头像规范化编号，并登记受管引用', async () => {
    const { service, em, comments, post } = setup()
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const result = await service.create(1, { ...input, avatar: ` /api/v1/media/${id.toUpperCase()}.webp ` }, 'hash')
    expect(result.avatar).toBe(`/api/v1/media/${id}.webp`)
    expect(em.count).toHaveBeenCalledWith(MediaAsset, { id: { $in: [id] }, deletedAt: null })
    expect(em.getReference).toHaveBeenCalledWith(MediaAsset, id)
    expect(em.create).toHaveBeenCalledWith(MediaReference, {
      asset: { id },
      sourceKey: 'comment:20',
      kind: 'comment',
      post,
      comment: comments[0],
    })
  })

  it('受管头像不存在或已删除时返回冲突，不登记引用、幂等凭据或通知', async () => {
    const { service, em, state, submissions } = setup()
    state.mediaAvailable = false
    await expect(
      service.create(
        1,
        {
          ...input,
          avatar: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
          requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
        'visitor-hash',
      ),
    ).rejects.toMatchObject({ status: 409, message: '内容引用的媒体已移除或不存在，请重新选择图片' })
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.getReference).not.toHaveBeenCalled()
    expect(em.create.mock.calls.map(([entity]) => entity)).toEqual([Comment])
    expect(submissions.size).toBe(0)
    expect(em.execute).toHaveBeenCalledTimes(1)
    // 此处只校验事务错误向外传播；数据库回滚由真实事务保证，不用内存 mock 冒充回滚验证。
    expect(em.flush).toHaveBeenCalledTimes(1)
  })
})

describe('评论幂等提交', () => {
  const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const dto = { ...input, requestId }

  it('固定输入生成稳定 SHA-256 标识，并在评论保存后登记请求哈希', async () => {
    const { service, em, submissions, comments } = setup()
    await service.create(1, dto, 'visitor-hash')
    // 固定向量独立约束持久凭据格式，避免实现与测试共用同一哈希函数而一起漂移。
    const id = '141b03bcdb8ca8c61fb10b1b722e1a807f6e6c20b68478978a92f8e63325a163'
    expect(em.findOne).toHaveBeenCalledWith(CommentSubmission, { id }, { populate: ['comment'] })
    expect(submissions.get(id)).toEqual({
      id,
      requestHash: 'f1ac040b4d020862713a181f5ccd5f9375bde17aa1a97d39f2a9cd107d8f248e',
      comment: comments[0],
      createdAt: expect.any(Date),
    })
    const submissionCall = em.create.mock.calls.findIndex(([entity]) => entity === CommentSubmission)
    expect(em.create.mock.invocationCallOrder[submissionCall]).toBeGreaterThan(em.flush.mock.invocationCallOrder[0]!)
    expect(em.create.mock.invocationCallOrder[submissionCall]).toBeLessThan(em.flush.mock.invocationCallOrder[1]!)
  })

  it.each([false, true])('重复提交复用原结果且不重复计数或通知，需审核：%s', async (requireApproval) => {
    const { service, em, state, comments, post } = setup()
    state.policy = { requireApproval }
    const original = await service.create(1, dto, 'visitor-hash')
    comments[0]!.likes = 7
    state.policy = { requireApproval: !requireApproval }
    const count = post.commentCount
    jest.clearAllMocks()

    const replay = await service.create(1, { ...dto, avatar: '/avatar.svg' }, 'visitor-hash')

    expect(replay).toEqual({ ...original, likes: 7 })
    expect(post.commentCount).toBe(count)
    expect(comments).toHaveLength(1)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(em.findOne.mock.calls.some(([entity]) => entity === CommentPolicy)).toBe(false)
  })

  it('规范化后等价的 HTTP(S) 头像与空父编号复用同一提交', async () => {
    const { service, comments } = setup()
    const original = await service.create(1, { ...dto, avatar: ' HTTPS://Images.Example:443/avatar.png ' }, 'hash')
    const replay = await service.create(
      1,
      plainToInstance(CreateCommentDto, { ...dto, avatar: 'https://images.example/avatar.png', parentId: null }),
      'hash',
    )
    expect(replay).toEqual(original)
    expect(comments).toHaveLength(1)
  })

  it.each([
    { author: '另一位读者' },
    { avatar: 'https://images.example/changed.png' },
    { content: '修改后的正文' },
    { parentId: 10 },
  ])('同一提交标识修改请求字段 %j 返回冲突', async (patch) => {
    const { service, em, post } = setup()
    await service.create(1, dto, 'visitor-hash')
    const count = post.commentCount
    jest.clearAllMocks()

    await expect(service.create(1, { ...dto, ...patch }, 'visitor-hash')).rejects.toMatchObject({ status: 409 })

    expect(em.create).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(post.commentCount).toBe(count)
  })

  it.each(['hidden', 'spam', 'deleted'] as const)('原评论变为 %s 后重试不能复活评论', async (status) => {
    const { service, em, comments, submissions, post } = setup()
    await service.create(1, dto, 'visitor-hash')
    if (status === 'deleted') submissions.values().next().value!.comment = null
    else comments[0]!.status = status
    const count = post.commentCount
    jest.clearAllMocks()

    await expect(service.create(1, dto, 'visitor-hash')).rejects.toMatchObject({ status: 409 })

    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.execute).toHaveBeenCalledTimes(1)
    expect(post.commentCount).toBe(count)
  })

  it.each([
    { label: '文章', postId: 2, visitorIdHash: 'visitor-hash', isOwner: false, nextRequestId: requestId },
    { label: '访客', postId: 1, visitorIdHash: 'another-visitor', isOwner: false, nextRequestId: requestId },
    { label: '博主身份', postId: 1, visitorIdHash: 'visitor-hash', isOwner: true, nextRequestId: requestId },
    {
      label: '请求编号',
      postId: 1,
      visitorIdHash: 'visitor-hash',
      isOwner: false,
      nextRequestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    },
  ])('$label 不同的提交使用独立凭据', async ({ postId, visitorIdHash, isOwner, nextRequestId }) => {
    const { service, comments, submissions, post } = setup()
    const original = await service.create(1, dto, 'visitor-hash')
    post.id = postId
    const second = await service.create(postId, { ...dto, requestId: nextRequestId }, visitorIdHash, isOwner)
    expect(second.id).not.toBe(original.id)
    expect(comments).toHaveLength(2)
    expect(submissions.size).toBe(2)
    expect(new Set([...submissions.values()].map((submission) => submission.requestHash)).size).toBe(1)
    expect(comments[1]).toMatchObject({ isOwner, authorSnapshot: { visitorIdHash } })
  })

  it('重试前文章已归档时仍返回归档错误，不泄露旧评论结果', async () => {
    const { service, em, post } = setup()
    await service.create(1, dto, 'visitor-hash')
    post.status = 'archived'
    jest.clearAllMocks()

    await expect(service.create(1, dto, 'visitor-hash')).rejects.toMatchObject({ code: 1002, status: 422 })
    expect(em.findOne.mock.calls.some(([entity]) => entity === CommentSubmission)).toBe(false)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })
})
