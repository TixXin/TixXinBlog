/** @file moment-write.service.spec.ts @description 朋友圈创建去重、版本编辑、引用同步与软删除的服务契约回归 */
import 'reflect-metadata'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { Moment } from '../../entities/moment.entity'
import { MomentComment } from '../../entities/moment-comment.entity'
import { MomentLike } from '../../entities/moment-like.entity'
import { Post } from '../../entities/post.entity'
import { SaveMomentDto } from './moment.dto'
import type { MomentReadService } from './moment-read.service'
import { momentValues, submissionHash } from './moment-values'
import { MomentWriteService } from './moment-write.service'

const now = new Date('2026-10-18T10:20:30.000Z')
const requestId = '12345678-1234-4123-a123-123456789abc'
const mediaId = '22345678-1234-4123-a123-123456789abc'
const secondMediaId = '32345678-1234-4123-a123-123456789abc'
const mediaUrl = `/api/v1/media/${mediaId}.webp`
const secondMediaUrl = `/api/v1/media/${secondMediaId}.webp`

function fixture(overrides: Partial<Moment> = {}) {
  const note = Object.assign(new Moment(), { id: 'moment-1', content: '雨后的散步', ...overrides })
  const em = {
    findOne: jest.fn().mockResolvedValue(note),
    create: jest.fn((entity: unknown, values: object) => {
      if (entity === Moment) return Object.assign(note, values)
      return Object.assign(new MediaReference(), values)
    }),
    execute: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    getReference: jest.fn((_entity: unknown, id: string) => ({ id })),
    nativeDelete: jest.fn().mockResolvedValue(0),
    nativeUpdate: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  // 根管理器只提供事务入口，防止服务绕过事务管理器进行写入。
  const root = {
    transactional: jest.fn(async (run: (manager: EntityManager) => Promise<unknown>) =>
      run(em as unknown as EntityManager),
    ),
  }
  const detail = { id: note.id, content: '已保存的动态' }
  const read = { detail: jest.fn().mockResolvedValue(detail) }
  const service = new MomentWriteService(root as unknown as EntityManager, read as unknown as MomentReadService)
  return { note, em, root, read, detail, service }
}

describe('朋友圈管理写入', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each<SaveMomentDto>([{ requestId }, { requestId, content: '  ' }, { content: '雨后的散步' }])(
    '创建缺少正文或提交标识时不进入事务：%j',
    async (input) => {
      const { root, read, service } = fixture()
      await expect(service.save(null, input)).rejects.toBeInstanceOf(BadRequestException)
      expect(root.transactional).not.toHaveBeenCalled()
      expect(read.detail).not.toHaveBeenCalled()
    },
  )

  it.each<SaveMomentDto>([{ content: '新的正文' }, { revision: 0, requestId, content: '新的正文' }])(
    '编辑缺少版本或携带创建标识时拒绝：%j',
    async (input) => {
      const { root, service } = fixture()
      await expect(service.save('moment-1', input)).rejects.toBeInstanceOf(BadRequestException)
      expect(root.transactional).not.toHaveBeenCalled()
    },
  )

  it('创建保存规范化话题和图片，草稿不设置公开日期，完成后读取管理详情', async () => {
    const { note, em, root, read, detail, service } = fixture()
    em.findOne.mockResolvedValue(null)
    em.count.mockResolvedValue(1)
    const input = plainToInstance(SaveMomentDto, {
      requestId,
      content: ' 雨后的散步 ',
      topics: [' ##城市 ', '城市', '  ', '#摄影'],
      images: [mediaUrl, mediaUrl.toUpperCase().replace('/API/V1/MEDIA/', '/api/v1/media/')],
    })

    await expect(service.save(null, input)).resolves.toEqual(detail)

    expect(root.transactional).toHaveBeenCalledTimes(1)
    expect(em.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(em.execute.mock.invocationCallOrder[0]).toBeLessThan(em.findOne.mock.invocationCallOrder[0]!)
    expect(em.findOne).toHaveBeenCalledWith(Moment, { requestId })
    expect(note).toMatchObject({
      content: '雨后的散步',
      topics: ['城市', '摄影'],
      images: [mediaUrl],
      status: 'draft',
      revision: 0,
      requestId,
      requestHash: submissionHash(momentValues(input)),
    })
    expect(note.publishedAt).toBeUndefined()
    expect(read.detail).toHaveBeenCalledWith(note.id, '', true)
    expect(read.detail.mock.invocationCallOrder[0]).toBeGreaterThan(em.flush.mock.invocationCallOrder[1]!)
  })

  it('相同标识与等价规范化输入重试复用记录，不再次写入或更新版本', async () => {
    const { note, em, read, service } = fixture()
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(note)
    const input = { requestId, content: '雨后的散步', topics: [' #城市 ', '城市'] }
    await service.save(null, input)
    await service.save(null, { requestId, content: '雨后的散步', topics: ['城市'] })

    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.nativeDelete).toHaveBeenCalledTimes(1)
    expect(note.revision).toBe(0)
    expect(read.detail).toHaveBeenCalledTimes(2)
  })

  it.each(['不同正文', '已删除记录'])('创建重试遇到%s时返回冲突且不复活或覆盖', async (scenario) => {
    const input = { requestId, content: '雨后的散步' }
    const { note, em, read, service } = fixture({
      requestId,
      requestHash: submissionHash(momentValues(input)),
      deletedAt: scenario === '已删除记录' ? new Date('2026-10-17T00:00:00Z') : null,
    })

    await expect(
      service.save(null, scenario === '不同正文' ? { ...input, content: '新的正文' } : input),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(note.content).toBe('雨后的散步')
    expect(note.revision).toBe(0)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('编辑查询排除已删除动态并加写锁，不存在时不写入', async () => {
    const { em, read, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.save('missing', { revision: 0, content: '新的正文' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(em.findOne).toHaveBeenCalledWith(
      Moment,
      { id: 'missing', deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(em.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('过期版本在修改正文、话题和引用前返回冲突', async () => {
    const { note, em, read, service } = fixture({ revision: 3, topics: ['城市'] })
    await expect(
      service.save(note.id, { revision: 2, content: '新的正文', topics: [], linkedArticleId: 99 }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(note).toMatchObject({ revision: 3, content: '雨后的散步', topics: ['城市'] })
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.flush).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('部分编辑保留省略的字段和创建指纹，更新后的话题可再显式清空', async () => {
    const publishedAt = new Date('2026-10-01T00:00:00Z')
    const { note, service } = fixture({
      status: 'published',
      publishedAt,
      images: ['https://example.com/photo.webp'],
      topics: ['城市'],
      requestId,
      requestHash: 'original-hash',
      location: '湖边',
    })
    await service.save(note.id, { revision: 0, topics: [' #旅行 ', '旅行', '#摄影'] })
    expect(note).toMatchObject({
      content: '雨后的散步',
      images: ['https://example.com/photo.webp'],
      topics: ['旅行', '摄影'],
      location: '湖边',
      status: 'published',
      publishedAt,
      requestId,
      requestHash: 'original-hash',
      revision: 1,
    })

    await service.save(note.id, { revision: 1, topics: [], location: null })
    expect(note.topics).toEqual([])
    expect(note.location).toBeNull()
    expect(note.revision).toBe(2)
  })

  it.each([null, 'moment-1'])('首次发布在服务端设置公开日期：%s', async (id) => {
    const { note, em, service } = fixture()
    if (!id) em.findOne.mockResolvedValue(null)
    await service.save(
      id,
      id ? { revision: 0, status: 'published' } : { requestId, content: '雨后', status: 'published' },
    )
    expect(note.publishedAt).toEqual(now)
  })

  it.each(['draft', 'archived', 'published'] as const)('有公开日期的动态改为 %s 时保留原日期', async (status) => {
    const publishedAt = new Date('2026-10-01T00:00:00Z')
    const { note, service } = fixture({ status: 'published', publishedAt })
    await service.save(note.id, { revision: 0, status })
    expect(note.status).toBe(status)
    expect(note.publishedAt).toBe(publishedAt)
  })

  it('新增站内引用只选择已公开且未删除文章，并清除旧外链', async () => {
    const post = Object.assign(new Post(), { id: 42, status: 'published' })
    const { note, em, service } = fixture({ linkedLink: { url: 'https://example.com/', title: '旧外链' } })
    em.findOne.mockResolvedValueOnce(note).mockResolvedValueOnce(post)
    await service.save(note.id, { revision: 0, linkedArticleId: 42 })
    expect(em.findOne).toHaveBeenNthCalledWith(2, Post, { id: 42, deletedAt: null, status: 'published' })
    expect(note.linkedArticle).toBe(post)
    expect(note.linkedLink).toBeNull()
  })

  it('不可选的新文章引用返回参数错误，保留原外链与版本', async () => {
    const linkedLink = { url: 'https://example.com/', title: '旧外链' }
    const { note, em, service } = fixture({ linkedLink })
    em.findOne.mockResolvedValueOnce(note).mockResolvedValueOnce(null)
    await expect(service.save(note.id, { revision: 0, linkedArticleId: 42 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(note.linkedLink).toBe(linkedLink)
    expect(note.revision).toBe(0)
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('原文章已撤回时允许保留相同引用，无需重新查找公开文章', async () => {
    const post = Object.assign(new Post(), { id: 42, status: 'draft', deletedAt: now })
    const { note, em, service } = fixture({ linkedArticle: post })
    await service.save(note.id, { revision: 0, content: '补充说明', linkedArticleId: 42 })
    expect(note.linkedArticle).toBe(post)
    expect(note.content).toBe('补充说明')
    expect(em.findOne).toHaveBeenCalledTimes(1)
  })

  it('显式清除文章引用和切换外链都不重新选择文章', async () => {
    const post = Object.assign(new Post(), { id: 42 })
    const { note, em, service } = fixture({ linkedArticle: post })
    await service.save(note.id, { revision: 0, linkedArticleId: null })
    expect(note.linkedArticle).toBeNull()
    note.linkedArticle = post
    await service.save(note.id, { revision: 1, linkedLink: { url: 'https://EXAMPLE.com:443', title: '阅读记录' } })
    expect(note.linkedArticle).toBeNull()
    expect(note.linkedLink).toEqual({ url: 'https://example.com/', title: '阅读记录' })
    expect(em.findOne).toHaveBeenCalledTimes(2)
    await service.save(note.id, { revision: 2, linkedLink: null })
    expect(note.linkedLink).toBeNull()
  })

  it('同时提交文章和外链在事务开始前拒绝', async () => {
    const { root, service } = fixture()
    await expect(
      service.save(null, {
        requestId,
        content: '阅读记录',
        linkedArticleId: 42,
        linkedLink: { url: 'https://example.com/', title: '阅读记录' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(root.transactional).not.toHaveBeenCalled()
  })

  it('正文、图片和链接卡片中的受管媒体统一去重，保存动态后同步所属引用', async () => {
    const { note, em, service } = fixture()
    em.count.mockResolvedValue(2)
    await service.save(note.id, {
      revision: 0,
      content: `雨后照片 ![湖面](${mediaUrl})`,
      images: [mediaUrl],
      linkedLink: { url: 'https://example.com/', title: '相册', image: secondMediaUrl, favicon: mediaUrl },
    })
    expect(em.count).toHaveBeenCalledWith(MediaAsset, { id: { $in: [mediaId, secondMediaId] }, deletedAt: null })
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: `moment:${note.id}` })
    expect(em.create).toHaveBeenCalledTimes(2)
    for (const id of [mediaId, secondMediaId]) {
      expect(em.create).toHaveBeenCalledWith(MediaReference, {
        asset: { id },
        sourceKey: `moment:${note.id}`,
        kind: 'moment',
        moment: note,
      })
    }
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(em.flush.mock.invocationCallOrder[0]).toBeLessThan(em.nativeDelete.mock.invocationCallOrder[0]!)
    expect(em.nativeDelete.mock.invocationCallOrder[0]).toBeLessThan(em.flush.mock.invocationCallOrder[1]!)
  })

  it('受管媒体不存在时让事务失败，不清除旧引用或返回成功详情', async () => {
    const { note, em, read, service } = fixture()
    em.count.mockResolvedValue(0)
    await expect(service.save(note.id, { revision: 0, images: [mediaUrl] })).rejects.toBeInstanceOf(ConflictException)
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('数据库提交失败时传播原始错误，不读取成功详情', async () => {
    const { em, read, service } = fixture()
    const failure = new Error('事务写入失败')
    em.flush.mockRejectedValueOnce(failure)
    await expect(service.save('moment-1', { revision: 0, content: '新的正文' })).rejects.toBe(failure)
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('删除加锁并保留提交墓碑，同时隐藏评论、删除点赞与媒体引用', async () => {
    const { note, em, read, service } = fixture({ revision: 3, likes: 12, requestId, requestHash: 'original-hash' })
    await expect(service.remove(note.id, 3)).resolves.toEqual({ ok: true })
    expect(em.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(em.execute.mock.invocationCallOrder[0]).toBeLessThan(em.findOne.mock.invocationCallOrder[0]!)
    expect(em.findOne).toHaveBeenCalledWith(Moment, { id: note.id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    expect(note).toMatchObject({ deletedAt: now, revision: 4, likes: 0, requestId, requestHash: 'original-hash' })
    expect(em.nativeUpdate).toHaveBeenCalledWith(MomentComment, { moment: note, deletedAt: null }, { deletedAt: now })
    expect(em.nativeDelete).toHaveBeenCalledTimes(2)
    expect(em.nativeDelete).toHaveBeenCalledWith(MomentLike, { moment: note })
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { moment: note })
    expect(em.flush).toHaveBeenCalledTimes(1)
    expect(read.detail).not.toHaveBeenCalled()
  })

  it('重复删除直接返回成功，即使旧版本也不重复级联或增加版本', async () => {
    const { note, em, service } = fixture({ deletedAt: now, revision: 4 })
    await expect(service.remove(note.id, 3)).resolves.toEqual({ ok: true })
    expect(note.revision).toBe(4)
    expect(note.deletedAt).toBe(now)
    expect(em.nativeUpdate).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('删除不存在的动态返回不存在且不执行级联', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.remove('missing', 0)).rejects.toBeInstanceOf(NotFoundException)
    expect(em.nativeUpdate).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('删除版本过期时保留动态、计数和关联', async () => {
    const { note, em, service } = fixture({ revision: 3, likes: 12 })
    await expect(service.remove(note.id, 2)).rejects.toBeInstanceOf(ConflictException)
    expect(note.deletedAt).toBeUndefined()
    expect(note.revision).toBe(3)
    expect(note.likes).toBe(12)
    expect(em.nativeUpdate).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })
})
