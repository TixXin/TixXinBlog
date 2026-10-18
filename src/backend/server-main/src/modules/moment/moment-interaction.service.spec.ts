/**
 * @file moment-interaction.service.spec.ts
 * @description 朋友圈互动回归：目标点赞、评论身份与重试、审核冲突、删除幂等和事务内媒体通知协作
 */
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConflictException } from '@nestjs/common'
import { CommentPolicy } from '../../entities/comment-policy.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import type { MomentCommentStatus } from '../../entities/moment-comment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { SiteSettings } from '../../entities/site-settings.entity'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { recordOwnerEvent } from '../operations/owner-events'
import { MomentInteractionService } from './moment-interaction.service'
import { submissionHash } from './moment-values'

jest.mock('../media/media-references', () => ({
  lockMedia: jest.fn(),
  synchronizeMediaReferences: jest.fn(),
}))
jest.mock('../operations/owner-events', () => ({ recordOwnerEvent: jest.fn() }))

const createdAt = new Date('2026-10-18T03:00:00.000Z')
const input = { requestId: '11111111-1111-4111-8111-111111111111', author: '远山', content: '这片晚霞真好看' }

function makeComment(values: Partial<MomentComment> = {}) {
  return Object.assign(new MomentComment(), {
    id: 'comment-1',
    visitorIdHash: 'visitor-1',
    author: input.author,
    avatar: '',
    content: input.content,
    requestId: input.requestId,
    requestHash: submissionHash(input),
    deletedAt: null,
    createdAt,
    ...values,
  })
}

function setup(options: { comment?: MomentComment; liked?: boolean; requireApproval?: boolean | null } = {}) {
  const note = { id: 'moment-1', likes: 99 }
  const like = options.liked ? { id: 5, moment: note, visitorIdHash: 'visitor-1' } : null
  const policy = options.requireApproval === null ? null : { requireApproval: options.requireApproval ?? false }
  const settings = { values: { ownerName: '博主', avatar: '/avatar-photo.webp' } }
  const em = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn().mockResolvedValue(settings),
    create: jest.fn((_entity: unknown, values: Record<string, unknown>) => makeComment(values)),
    remove: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(3),
    nativeDelete: jest.fn().mockResolvedValue(1),
  }
  em.findOne.mockImplementation(async (entity: unknown) => {
    if (entity === Moment) return note
    if (entity === MomentLike) return like
    if (entity === MomentComment) return options.comment ?? null
    if (entity === CommentPolicy) return policy
    throw new Error('出现未配置的实体查询')
  })
  // 根管理器只允许开启事务，所有实体读写必须使用事务传入的管理器。
  const root = { transactional: jest.fn(async (run: (manager: unknown) => unknown) => run(em)) }
  return { em, root, note, like, settings, service: new MomentInteractionService(root as unknown as EntityManager) }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(lockMedia).mockResolvedValue(undefined)
  jest.mocked(synchronizeMediaReferences).mockResolvedValue(undefined)
  jest.mocked(recordOwnerEvent).mockResolvedValue(undefined)
})

describe('MomentInteractionService 目标点赞', () => {
  it.each([
    { liked: false, desired: true, creates: 1, removes: 0 },
    { liked: true, desired: true, creates: 0, removes: 0 },
    { liked: true, desired: false, creates: 0, removes: 1 },
    { liked: false, desired: false, creates: 0, removes: 0 },
  ])('已有点赞 $liked，目标 $desired 时只执行必要变更并重新计数', async ({ liked, desired, creates, removes }) => {
    const { service, em, root, note, like } = setup({ liked })
    expect(await service.setLike(note.id, 'visitor-1', desired)).toEqual({ isLiked: desired, likes: 3 })
    expect(root.transactional).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenNthCalledWith(
      1,
      Moment,
      { id: note.id, status: 'published', deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(em.findOne).toHaveBeenNthCalledWith(2, MomentLike, { moment: note, visitorIdHash: 'visitor-1' })
    expect(em.create).toHaveBeenCalledTimes(creates)
    if (creates) expect(em.create).toHaveBeenCalledWith(MomentLike, { moment: note, visitorIdHash: 'visitor-1' })
    expect(em.remove).toHaveBeenCalledTimes(removes)
    if (removes) expect(em.remove).toHaveBeenCalledWith(like)
    expect(em.count).toHaveBeenCalledWith(MomentLike, { moment: note })
    expect(note.likes).toBe(3)
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(em.count.mock.invocationCallOrder[0]!)
    expect(em.count.mock.invocationCallOrder[0]).toBeLessThan(em.flush.mock.invocationCallOrder[1]!)
  })

  it('公开动态不存在时拒绝点赞，不访问点赞记录或写入计数', async () => {
    const { service, em, note } = setup()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.setLike(note.id, 'visitor-1', true)).rejects.toMatchObject({
      status: 404,
      message: '动态不存在或尚未公开',
    })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.remove).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(note.likes).toBe(99)
  })
})

describe('MomentInteractionService 评论身份、审核与媒体通知', () => {
  it.each([
    { requireApproval: true, status: 'pending', reason: 'pending_review' },
    { requireApproval: false, status: 'published', reason: 'new_comment' },
    { requireApproval: null, status: 'published', reason: 'new_comment' },
  ])('访客在审核策略 $requireApproval 下保存为 $status，按公开评论重新计数', async (scenario) => {
    const { service, em, note } = setup(scenario)
    const body = { ...input, avatar: ' /api/v1/media/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.webp ' }
    const result = await service.comment(note.id, body, 'visitor-1')
    expect(lockMedia).toHaveBeenCalledWith(em)
    expect(jest.mocked(lockMedia).mock.invocationCallOrder[0]).toBeLessThan(em.findOne.mock.invocationCallOrder[0]!)
    expect(em.findOne).toHaveBeenCalledWith(
      Moment,
      { id: note.id, status: 'published', deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(em.findOne).toHaveBeenCalledWith(MomentComment, {
      moment: note,
      visitorIdHash: 'visitor-1',
      requestId: input.requestId,
    })
    expect(em.findOne).toHaveBeenCalledWith(CommentPolicy, { id: 'default' }, { refresh: true })
    expect(em.findOneOrFail).not.toHaveBeenCalled()
    expect(em.create).toHaveBeenCalledWith(MomentComment, {
      moment: note,
      visitorIdHash: 'visitor-1',
      author: input.author,
      avatar: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      content: input.content,
      isOwner: false,
      status: scenario.status,
      requestId: input.requestId,
      requestHash: submissionHash(body),
    })
    const comment = em.create.mock.results[0]!.value as MomentComment
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(
      em,
      'moment-comment:comment-1',
      'moment-comment',
      [comment.avatar],
      { moment: note, momentComment: comment },
    )
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(synchronizeMediaReferences).mock.invocationCallOrder[0]!,
    )
    expect(em.flush.mock.invocationCallOrder[1]).toBeLessThan(
      jest.mocked(recordOwnerEvent).mock.invocationCallOrder[0]!,
    )
    expect(recordOwnerEvent).toHaveBeenCalledWith(em, 'moment-comment', comment.id, scenario.reason)
    expect(em.count).toHaveBeenCalledWith(MomentComment, { moment: note, status: 'published', deletedAt: null })
    expect(result).toEqual({
      id: comment.id,
      author: input.author,
      avatar: comment.avatar,
      content: input.content,
      time: createdAt.toISOString(),
      isOwner: false,
      moderationStatus: scenario.status,
      commentCount: 3,
    })
  })

  it('访客请求中的伪造身份不影响服务端作者身份与审核状态，缺省头像为空', async () => {
    const { service, em } = setup({ requireApproval: true })
    const forged = { ...input, isOwner: true, status: 'published', visitorIdHash: 'admin:owner' }
    const result = await service.comment('moment-1', forged, 'visitor-1')
    expect(em.create).toHaveBeenCalledWith(
      MomentComment,
      expect.objectContaining({ visitorIdHash: 'visitor-1', isOwner: false, status: 'pending', avatar: '' }),
    )
    expect(result).toMatchObject({ isOwner: false, moderationStatus: 'pending', avatar: '' })
  })

  it('博主回复使用站点姓名头像和管理员身份，审核开启时仍直接公开且不通知自己', async () => {
    const { service, em, note, settings } = setup({ requireApproval: true })
    const result = await service.comment(note.id, { ...input, avatar: 'javascript:alert(1)' }, 'visitor-1', 'owner-1')
    expect(em.findOneOrFail).toHaveBeenCalledWith(SiteSettings, { id: 'default' })
    expect(em.findOne).toHaveBeenCalledWith(MomentComment, {
      moment: note,
      visitorIdHash: 'admin:owner-1',
      requestId: input.requestId,
    })
    expect(em.create).toHaveBeenCalledWith(
      MomentComment,
      expect.objectContaining({
        author: settings.values.ownerName,
        avatar: settings.values.avatar,
        visitorIdHash: 'admin:owner-1',
        isOwner: true,
        status: 'published',
      }),
    )
    expect(result).toMatchObject({
      author: '博主',
      avatar: '/avatar-photo.webp',
      isOwner: true,
      moderationStatus: 'published',
    })
    expect(synchronizeMediaReferences).toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it.each(['javascript:alert(1)', '//outside.example/avatar.png', 'https://user:password@example.com/avatar.png'])(
    '拒绝非法访客头像 %s，创建和通知均不执行',
    async (avatar) => {
      const { service, em } = setup()
      await expect(service.comment('moment-1', { ...input, avatar }, 'visitor-1')).rejects.toMatchObject({
        status: 400,
      })
      expect(em.create).not.toHaveBeenCalled()
      expect(em.flush).not.toHaveBeenCalled()
      expect(synchronizeMediaReferences).not.toHaveBeenCalled()
      expect(recordOwnerEvent).not.toHaveBeenCalled()
    },
  )

  it('动态不公开或不存在时拒绝评论，不查询提交或产生写入', async () => {
    const { service, em } = setup()
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.comment('moment-1', input, 'visitor-1')).rejects.toMatchObject({ status: 404 })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('媒体引用失败向上传播，不生成通知或返回成功计数', async () => {
    const { service, em } = setup()
    const failure = new ConflictException('引用媒体已移除')
    jest.mocked(synchronizeMediaReferences).mockRejectedValueOnce(failure)
    await expect(service.comment('moment-1', input, 'visitor-1')).rejects.toBe(failure)
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(recordOwnerEvent).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
  })

  it('事务内通知记录失败向上传播，不伪装为评论成功', async () => {
    const { service, em } = setup()
    const failure = new Error('通知记录失败')
    jest.mocked(recordOwnerEvent).mockRejectedValueOnce(failure)
    await expect(service.comment('moment-1', input, 'visitor-1')).rejects.toBe(failure)
    expect(em.count).not.toHaveBeenCalled()
  })
})

describe('MomentInteractionService 评论重试', () => {
  it.each(['published', 'pending'] as const)('相同请求重试返回原有 %s 评论，不重复写媒体或通知', async (status) => {
    const comment = makeComment({ status })
    const { service, em, note } = setup({ comment })
    const result = await service.comment(note.id, input, 'visitor-1')
    expect(result).toMatchObject({ id: comment.id, moderationStatus: status, commentCount: 3 })
    expect(em.findOne).toHaveBeenCalledTimes(2)
    expect(em.findOneOrFail).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
    expect(em.count).toHaveBeenCalledWith(MomentComment, { moment: note, status: 'published', deletedAt: null })
  })

  it.each([
    { reason: '已删除', values: { deletedAt: new Date('2026-10-17T00:00:00.000Z') } },
    { reason: '输入改变', values: { requestHash: submissionHash({ ...input, content: '另一条评论' }) } },
    { reason: '访客评论已隐藏', values: { status: 'hidden' as const } },
  ])('$reason 的旧提交返回冲突且不恢复或重新创建', async ({ values }) => {
    const comment = makeComment(values)
    const { service, em } = setup({ comment })
    await expect(service.comment('moment-1', input, 'visitor-1')).rejects.toMatchObject({
      status: 409,
      message: '此评论提交已处理，请确认原评论',
    })
    expect(comment).toMatchObject(values)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it('博主可核查隐藏的原回复，重试保持隐藏状态', async () => {
    const comment = makeComment({ status: 'hidden', isOwner: true, visitorIdHash: 'admin:owner-1' })
    const { service, em } = setup({ comment })
    expect(await service.comment('moment-1', input, 'visitor-1', 'owner-1')).toMatchObject({
      id: comment.id,
      moderationStatus: 'hidden',
      isOwner: true,
    })
    expect(comment.status).toBe('hidden')
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })
})

describe('MomentInteractionService 审核', () => {
  it.each([
    { current: 'pending', target: 'published', expected: 'pending' },
    { current: 'published', target: 'hidden', expected: 'published' },
    { current: 'published', target: 'published', expected: 'pending' },
  ] satisfies { current: MomentCommentStatus; target: MomentCommentStatus; expected: MomentCommentStatus }[])(
    '$current 审核到 $target，预期 $expected 时更新或幂等返回',
    async ({ current, target, expected }) => {
      const comment = makeComment({ status: current })
      const { service, em, note } = setup({ comment })
      const result = await service.moderate(note.id, comment.id, target, expected)
      expect(em.findOne).toHaveBeenNthCalledWith(
        1,
        Moment,
        { id: note.id, deletedAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      )
      expect(em.findOne).toHaveBeenNthCalledWith(2, MomentComment, {
        id: comment.id,
        moment: note,
        deletedAt: null,
      })
      expect(comment.status).toBe(target)
      expect(result).toMatchObject({ id: comment.id, moderationStatus: target, commentCount: 3 })
      expect(em.flush).toHaveBeenCalledTimes(1)
      expect(em.count).toHaveBeenCalledWith(MomentComment, { moment: note, status: 'published', deletedAt: null })
      expect(recordOwnerEvent).not.toHaveBeenCalled()
    },
  )

  it('当前状态既非预期也非目标时拒绝覆盖', async () => {
    const comment = makeComment({ status: 'hidden' })
    const { service, em } = setup({ comment })
    await expect(service.moderate('moment-1', comment.id, 'published', 'pending')).rejects.toMatchObject({
      status: 409,
      message: '评论状态已改变，请重新加载后再操作',
    })
    expect(comment.status).toBe('hidden')
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
  })

  it.each(['动态', '评论'])('%s 不存在时拒绝审核，评论查询限定动态且排除删除项', async (missing) => {
    const { service, em } = setup()
    if (missing === '动态') em.findOne.mockResolvedValueOnce(null)
    await expect(service.moderate('moment-1', 'comment-1', 'published', 'pending')).rejects.toMatchObject({
      status: 404,
      message: `${missing}不存在`,
    })
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
  })
})

describe('MomentInteractionService 评论删除', () => {
  it('首次删除标记时间并清理媒体引用，重复删除保留原时间且返回公开计数', async () => {
    const comment = makeComment()
    const { service, em, note } = setup({ comment })
    const before = Date.now()
    expect(await service.removeComment(note.id, comment.id)).toEqual({ ok: true, commentCount: 3 })
    const deletedAt = comment.deletedAt!
    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(deletedAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(await service.removeComment(note.id, comment.id)).toEqual({ ok: true, commentCount: 3 })
    expect(comment.deletedAt).toBe(deletedAt)
    expect(lockMedia).toHaveBeenCalledTimes(2)
    expect(lockMedia).toHaveBeenCalledWith(em)
    expect(jest.mocked(lockMedia).mock.invocationCallOrder[0]).toBeLessThan(em.findOne.mock.invocationCallOrder[0]!)
    expect(em.findOne).toHaveBeenCalledWith(
      Moment,
      { id: note.id, deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(em.findOne).toHaveBeenCalledWith(MomentComment, { id: comment.id, moment: note })
    expect(em.nativeDelete).toHaveBeenCalledTimes(2)
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { momentComment: comment })
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.count).toHaveBeenCalledWith(MomentComment, { moment: note, status: 'published', deletedAt: null })
    expect(em.remove).not.toHaveBeenCalled()
    expect(recordOwnerEvent).not.toHaveBeenCalled()
  })

  it.each(['动态', '评论'])('%s 不存在时不删除任何媒体引用', async (missing) => {
    const { service, em } = setup()
    if (missing === '动态') em.findOne.mockResolvedValueOnce(null)
    await expect(service.removeComment('moment-1', 'comment-1')).rejects.toMatchObject({
      status: 404,
      message: `${missing}不存在`,
    })
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.count).not.toHaveBeenCalled()
  })
})
