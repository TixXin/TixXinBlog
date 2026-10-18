/** @file prompts.service.spec.ts @description 提示词公开查询、管理保存、幂等版本与媒体引用的隔离单元测试 */
import 'reflect-metadata'
import { LockMode, RawQueryFragment } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { ImagePrompt } from '../../entities/image-prompt.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { lockMedia, mediaUrl, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { AdminPromptQuery, PromptQuery } from './prompts.dto'
import type { SavePromptDto } from './prompts.dto'
import { promptValues } from './prompts-values'
import { PromptsService } from './prompts.service'

jest.mock('../media/media-references', () => ({
  ...jest.requireActual<typeof import('../media/media-references')>('../media/media-references'),
  lockMedia: jest.fn(),
  synchronizeMediaReferences: jest.fn(),
}))

const requestId = '6c739629-ff26-4d07-9acb-d80f99b8e001'
const mediaId = 'a43ea969-9dd4-4ef6-ae78-46a0056c674b'
const createdAt = new Date('2026-10-01T00:00:00.000Z')
const publishedAt = new Date('2026-10-02T00:00:00.000Z')
const updatedAt = new Date('2026-10-03T00:00:00.000Z')
const externalImageUrl = 'https://images.example.com/night.png'
const lockMediaMock = jest.mocked(lockMedia)
const synchronizeMediaReferencesMock = jest.mocked(synchronizeMediaReferences)

function promptFixture(overrides: Partial<ImagePrompt> = {}) {
  return Object.assign(new ImagePrompt(), {
    id: 42,
    title: '城市夜色',
    description: '雨后街角的暖色灯光',
    prompt: '夜色街景\n保留建筑的垂直线条',
    negativePrompt: '模糊、过曝',
    model: 'Flux',
    tags: ['夜色', 'Film'],
    media: null,
    externalImageUrl,
    imageAlt: '雨夜路口与暖色橱窗',
    sourceUrl: 'https://example.com/notes/night',
    status: 'published',
    revision: 3,
    requestId,
    requestHash: 'private-submission-hash',
    createdAt,
    publishedAt,
    updatedAt,
    ...overrides,
  })
}

function fixture(overrides: Partial<ImagePrompt> = {}) {
  const item = promptFixture(overrides)
  const media = Object.assign(new MediaAsset(), { id: mediaId, mimeType: 'image/webp', width: 960, height: 640 })
  const em = {
    findOne: jest.fn().mockResolvedValue(item),
    findAndCount: jest.fn().mockResolvedValue([[item], 17]),
    execute: jest.fn(),
    transactional: jest.fn(),
  }
  // 区分事务内管理器与读取管理器，防止保存流程意外脱离同一事务。
  const transaction = {
    findOne: jest.fn().mockImplementation(async (entity: unknown, where: { requestId?: string }) => {
      if (entity === MediaAsset) return media
      if (where.requestId) return null
      return item
    }),
    create: jest.fn().mockImplementation((_entity: unknown, fields: Partial<ImagePrompt>) => {
      const created = Object.assign(new ImagePrompt(), { id: 43, createdAt, updatedAt }, fields)
      em.findOne.mockResolvedValue(created)
      return created
    }),
    flush: jest.fn().mockResolvedValue(undefined),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(transaction))
  const service = new PromptsService(em as unknown as EntityManager)
  return { item, media, em, transaction, service }
}

function createInput(overrides: Partial<SavePromptDto> = {}): SavePromptDto {
  return { requestId, title: '城市夜色', prompt: '雨后城市与暖色灯光', externalImageUrl, ...overrides }
}

beforeEach(() => {
  jest.clearAllMocks()
  lockMediaMock.mockReset().mockResolvedValue(undefined)
  synchronizeMediaReferencesMock.mockReset().mockResolvedValue(undefined)
})

describe('提示词公开与管理读取', () => {
  it('公开列表限制发布状态，使用稳定倒序、真实总数和分页偏移', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new AdminPromptQuery(), { page: 2, pageSize: 12, status: 'draft' })

    const result = await service.list(query)

    expect(em.findAndCount).toHaveBeenCalledWith(
      ImagePrompt,
      { status: 'published' },
      { populate: ['media'], orderBy: { id: 'DESC' }, limit: 12, offset: 12 },
    )
    expect(result).toMatchObject({ total: 17, page: 2, pageSize: 12, items: [{ id: 42, title: '城市夜色' }] })
    expect(result.items[0]).not.toHaveProperty('status')
    expect(result.items[0]).not.toHaveProperty('revision')
  })

  it('列表同时应用正文搜索、模型和标签过滤，搜索通配符按字面处理', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new PromptQuery(), { q: '100%_夜色', model: 'Flux_1', tag: "FiLm_%' OR 1=1 --" })

    await service.list(query)

    const where = em.findAndCount.mock.calls[0]![1]
    expect(where).toMatchObject({
      status: 'published',
      model: { $ilike: 'Flux\\_1' },
      $or: expect.arrayContaining([
        { title: { $ilike: '%100\\%\\_夜色%' } },
        { description: { $ilike: '%100\\%\\_夜色%' } },
        { prompt: { $ilike: '%100\\%\\_夜色%' } },
        { model: { $ilike: '%100\\%\\_夜色%' } },
      ]),
    })
    expect(where.$and).toHaveLength(1)
    expect(where.$or).toHaveLength(5)
    // 标签使用精确的小写参数绑定，不能把用户输入拼进 SQL 或解释为通配符。
    const tagKey = Object.keys(where.$and[0])[0]!
    const tagFragment = RawQueryFragment.getKnownFragment(tagKey, true)
    expect(tagFragment?.sql).toContain('jsonb_array_elements_text(')
    expect(tagFragment?.sql).toContain('where lower(tag)=?')
    expect(tagFragment?.sql).not.toContain(query.tag)
    expect(tagFragment?.params).toEqual(["film_%' or 1=1 --"])
    expect(where.$and[0][tagKey]).toBe(true)
    const searchKey = Object.keys(where.$or[4])[0]!
    expect(RawQueryFragment.getKnownFragment(searchKey, true)?.sql).toContain('.tags::text')
    expect(where.$or[4][searchKey]).toEqual({ $ilike: '%100\\%\\_夜色%' })
  })

  it.each([
    ['all', {}],
    ['draft', { status: 'draft' }],
    ['published', { status: 'published' }],
  ] as const)('管理列表按 %s 状态查询并带编辑所需字段', async (status, expected) => {
    const itemStatus = status === 'published' ? 'published' : 'draft'
    const { em, service } = fixture({ status: itemStatus })

    const result = await service.list(Object.assign(new AdminPromptQuery(), { status }), true)

    expect(em.findAndCount.mock.calls[0]![1]).toEqual(expected)
    expect(result.items[0]).toMatchObject({ status: itemStatus, revision: 3, mediaId: null, externalImageUrl })
  })

  it('空结果保留请求页码，读取失败直接传播而不返回样本或假空列表', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new PromptQuery(), { page: 3 })
    em.findAndCount.mockResolvedValueOnce([[], 0])
    await expect(service.list(query)).resolves.toEqual({ items: [], total: 0, page: 3, pageSize: 12 })

    const failure = new Error('查询失败')
    em.findAndCount.mockRejectedValueOnce(failure)
    await expect(service.list(query)).rejects.toBe(failure)
  })

  it('公开投影保留完整配方与日期，隐藏管理状态、媒体关联及提交身份', () => {
    const { item, service } = fixture()

    expect(service.serialize(item)).toEqual({
      id: 42,
      title: '城市夜色',
      description: '雨后街角的暖色灯光',
      prompt: '夜色街景\n保留建筑的垂直线条',
      negativePrompt: '模糊、过曝',
      model: 'Flux',
      tags: ['夜色', 'Film'],
      imageUrl: externalImageUrl,
      imageAlt: '雨夜路口与暖色橱窗',
      width: null,
      height: null,
      sourceUrl: 'https://example.com/notes/night',
      publishedAt: publishedAt.toISOString(),
    })
    const admin = service.serialize(item, true)
    expect(admin).toMatchObject({
      mediaId: null,
      externalImageUrl,
      status: 'published',
      revision: 3,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
    expect(admin).not.toHaveProperty('requestId')
    expect(admin).not.toHaveProperty('requestHash')
  })

  it('受管媒体使用正式地址与真实宽高，未发布内容没有虚构发布日期', () => {
    const { item, media, service } = fixture({ status: 'draft', externalImageUrl: null, publishedAt: null })
    item.media = media

    expect(service.serialize(item, true)).toMatchObject({
      imageUrl: `/api/v1/media/${mediaId}.webp`,
      mediaId,
      externalImageUrl: null,
      width: 960,
      height: 640,
      publishedAt: null,
    })
  })

  it('公开详情强制过滤草稿，管理详情可以读取草稿', async () => {
    const { em, service } = fixture({ status: 'draft' })
    em.findOne.mockResolvedValueOnce(null)

    await expect(service.detail(42)).rejects.toThrow(NotFoundException)
    await expect(service.detail(42, true)).resolves.toMatchObject({ status: 'draft', revision: 3 })

    expect(em.findOne).toHaveBeenNthCalledWith(1, ImagePrompt, { id: 42, status: 'published' }, { populate: ['media'] })
    expect(em.findOne).toHaveBeenNthCalledWith(2, ImagePrompt, { id: 42 }, { populate: ['media'] })
  })

  it.each([false, true])('不存在或不可见详情返回 404，管理模式为 %s', async (admin) => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(42, admin)).rejects.toThrow(NotFoundException)
  })

  it('非法编号在读取或打开保存事务之前拒绝', async () => {
    const { em, service } = fixture()
    await expect(service.detail(0)).rejects.toThrow(BadRequestException)
    await expect(service.save(0, { revision: 3 })).rejects.toThrow(BadRequestException)
    expect(em.findOne).not.toHaveBeenCalled()
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('提交核查返回已有管理记录，未知提交返回 404', async () => {
    const { em, service } = fixture({ status: 'draft' })
    await expect(service.submission(requestId)).resolves.toMatchObject({
      state: 'saved',
      item: { id: 42, status: 'draft', revision: 3 },
    })
    expect(em.findOne).toHaveBeenCalledWith(ImagePrompt, { requestId }, { populate: ['media'] })
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.submission(requestId)).rejects.toThrow(NotFoundException)
  })

  it('筛选元数据在同一查询快照中限定公开内容，模型和标签忽略大小写计数', async () => {
    const { em, service } = fixture()
    const metadata = {
      stats: { prompts: 3, models: 1, tags: 2 },
      models: [{ label: 'Flux', count: 2 }],
      tags: [
        { label: 'Film', count: 2 },
        { label: '夜色', count: 1 },
      ],
    }
    em.execute.mockResolvedValue([metadata])

    await expect(service.metadata()).resolves.toEqual(metadata)

    expect(em.execute).toHaveBeenCalledTimes(1)
    const sql = String(em.execute.mock.calls[0]![0]).replace(/\s+/g, ' ')
    expect(sql).toContain("with public_prompts as (select id,model,tags from image_prompt where status='published')")
    expect(sql).toContain('count(distinct p.id)::int')
    expect(sql).toContain('group by lower(tag)')
    expect(sql).toContain("from public_prompts where model<>'' group by lower(model)")
    expect(sql).toContain('order by count desc,label')
    expect(em.findAndCount).not.toHaveBeenCalled()
  })

  it('元数据允许真实零计数，查询失败不生成零统计', async () => {
    const { em, service } = fixture()
    const empty = { stats: { prompts: 0, models: 0, tags: 0 }, models: [], tags: [] }
    em.execute.mockResolvedValueOnce([empty])
    await expect(service.metadata()).resolves.toEqual(empty)
    const failure = new Error('统计失败')
    em.execute.mockRejectedValueOnce(failure)
    await expect(service.metadata()).rejects.toBe(failure)
  })
})

describe('提示词管理保存与并发边界', () => {
  it.each([{ title: undefined }, { prompt: undefined }, { requestId: undefined }, { revision: 0 }])(
    '创建缺少必要字段或携带编辑版本时不启动事务：%j',
    async (overrides) => {
      const { em, service } = fixture()
      await expect(service.save(null, createInput(overrides))).rejects.toThrow(BadRequestException)
      expect(em.transactional).not.toHaveBeenCalled()
    },
  )

  it.each([{}, { revision: 3, requestId }])('编辑缺少版本或携带创建标识时不启动事务：%j', async (input) => {
    const { em, service } = fixture()
    await expect(service.save(42, input)).rejects.toThrow(BadRequestException)
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('地址校验失败发生在事务和媒体引用变更之前', async () => {
    const { em, service } = fixture()
    await expect(service.save(null, createInput({ externalImageUrl: 'javascript:alert(1)' }))).rejects.toThrow(
      BadRequestException,
    )
    expect(em.transactional).not.toHaveBeenCalled()
    expect(lockMediaMock).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('新建默认草稿，规范化输入后以同一事务保存并登记空外链引用', async () => {
    const { em, transaction, service } = fixture()
    const input = createInput({
      title: '  城市夜色  ',
      prompt: '  雨后城市\n暖色灯光  ',
      tags: [' Film ', 'film', '夜色'],
      sourceUrl: ' HTTPS://EXAMPLE.COM:443/notes ',
    })

    const result = await service.save(null, input)

    expect(lockMediaMock).toHaveBeenCalledWith(transaction)
    expect(transaction.findOne).toHaveBeenCalledWith(ImagePrompt, { requestId })
    const created = transaction.create.mock.results[0]!.value as ImagePrompt
    expect(created).toMatchObject({
      title: '城市夜色',
      prompt: '雨后城市\n暖色灯光',
      tags: ['Film', '夜色'],
      sourceUrl: 'https://example.com/notes',
      status: 'draft',
      revision: 0,
      requestId,
      requestHash: submissionHash(promptValues(input)),
    })
    expect(created.publishedAt).toBeUndefined()
    expect(result).toMatchObject({ id: 43, title: '城市夜色', status: 'draft', revision: 0, publishedAt: null })
    expect(synchronizeMediaReferencesMock).toHaveBeenCalledWith(transaction, 'image-prompt:43', 'image-prompt', [], {
      imagePrompt: created,
    })
    expect(transaction.flush).toHaveBeenCalledTimes(2)
    expect(lockMediaMock.mock.invocationCallOrder[0]).toBeLessThan(transaction.findOne.mock.invocationCallOrder[0]!)
    expect(transaction.flush.mock.invocationCallOrder[0]).toBeLessThan(
      synchronizeMediaReferencesMock.mock.invocationCallOrder[0]!,
    )
    expect(synchronizeMediaReferencesMock.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.flush.mock.invocationCallOrder[1]!,
    )
    expect(transaction.flush.mock.invocationCallOrder[1]).toBeLessThan(em.findOne.mock.invocationCallOrder[0]!)
    expect(input.title).toBe('  城市夜色  ')
  })

  it('相同提交标识与规范化内容复用原记录，不重复创建或更新引用', async () => {
    const { item, transaction, service } = fixture()
    const input = createInput({ title: ' 城市夜色 ', tags: [' Film ', 'film'] })
    item.requestHash = submissionHash(promptValues(createInput({ tags: ['Film'] })))
    transaction.findOne.mockResolvedValueOnce(item)

    await expect(service.save(null, input)).resolves.toMatchObject({ id: 42, revision: 3 })

    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
    expect(item.revision).toBe(3)
  })

  it('相同提交标识携带不同内容返回冲突，保留原记录', async () => {
    const { item, transaction, service } = fixture()
    transaction.findOne.mockResolvedValueOnce(item)

    await expect(service.save(null, createInput({ title: '另一个作品' }))).rejects.toThrow(ConflictException)

    expect(item.title).toBe('城市夜色')
    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('局部编辑在行锁后检查版本，仅修改给定字段并递增一次版本', async () => {
    const { item, transaction, service } = fixture()

    await expect(service.save(42, { revision: 3, title: '  街角夜色  ' })).resolves.toMatchObject({
      id: 42,
      title: '街角夜色',
      revision: 4,
    })

    expect(transaction.findOne).toHaveBeenCalledWith(ImagePrompt, { id: 42 }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    expect(item).toMatchObject({
      prompt: '夜色街景\n保留建筑的垂直线条',
      tags: ['夜色', 'Film'],
      externalImageUrl,
      status: 'published',
      publishedAt,
      requestId,
      requestHash: 'private-submission-hash',
    })
    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).toHaveBeenCalledTimes(2)
  })

  it('版本冲突在字段和版本修改前拒绝，且不写入媒体引用', async () => {
    const { item, transaction, service } = fixture()
    await expect(service.save(42, { revision: 2, title: '不应保存' })).rejects.toThrow(ConflictException)
    expect(item.title).toBe('城市夜色')
    expect(item.revision).toBe(3)
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('待编辑记录不存在时返回 404，不能创建同编号替代内容', async () => {
    const { transaction, service } = fixture()
    transaction.findOne.mockResolvedValueOnce(null)
    await expect(service.save(42, { revision: 3, title: '已移除' })).rejects.toThrow(NotFoundException)
    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
  })

  it('首次发布记录时间，收回草稿后再次发布保留原始发布时间', async () => {
    const now = new Date('2026-10-18T10:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now)
    try {
      const { item, service } = fixture({ status: 'draft', publishedAt: null })
      await service.save(42, { revision: 3, status: 'published' })
      expect(item.publishedAt).toEqual(now)
      jest.setSystemTime(new Date('2026-10-19T10:00:00.000Z'))
      await service.save(42, { revision: 4, status: 'draft' })
      await service.save(42, { revision: 5, status: 'published' })
      expect(item.publishedAt).toEqual(now)
      expect(item.revision).toBe(6)
    } finally {
      jest.useRealTimers()
    }
  })

  it('媒体锁失败中止整个保存流程并传播原因', async () => {
    const { em, transaction, service } = fixture()
    const failure = new Error('媒体锁失败')
    lockMediaMock.mockRejectedValueOnce(failure)

    await expect(service.save(42, { revision: 3, title: '夜色' })).rejects.toBe(failure)

    expect(transaction.findOne).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(em.findOne).not.toHaveBeenCalled()
  })
})

describe('提示词图片来源与引用保护', () => {
  it('受管图片创建登记正式引用，保存后的响应包含真实宽高', async () => {
    const { media, transaction, service } = fixture()

    const result = await service.save(null, createInput({ mediaId, externalImageUrl: null, status: 'published' }))

    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    const created = transaction.create.mock.results[0]!.value as ImagePrompt
    expect(created.media).toBe(media)
    expect(created.publishedAt).toBeInstanceOf(Date)
    expect(result).toMatchObject({ mediaId, imageUrl: mediaUrl(mediaId), width: 960, height: 640, status: 'published' })
    expect(synchronizeMediaReferencesMock).toHaveBeenCalledWith(
      transaction,
      'image-prompt:43',
      'image-prompt',
      [mediaUrl(mediaId)],
      { imagePrompt: created },
    )
  })

  it.each([
    ['不存在或已删除', null],
    ['非图片', { mimeType: 'application/pdf', width: 960, height: 640 }],
    ['宽度无效', { mimeType: 'image/webp', width: 0, height: 640 }],
    ['高度无效', { mimeType: 'image/webp', width: 960, height: 0 }],
  ])('拒绝%s的媒体，且不创建内容或同步引用', async (_label, invalidMedia) => {
    const { transaction, service } = fixture()
    transaction.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(invalidMedia)

    await expect(service.save(null, createInput({ mediaId, externalImageUrl: null }))).rejects.toThrow(
      BadRequestException,
    )

    expect(transaction.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(transaction.create).not.toHaveBeenCalled()
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it.each([
    { mediaId: null, externalImageUrl: null },
    { mediaId, externalImageUrl },
  ])('新建必须恰有一种图片来源：%j', async (sources) => {
    const { transaction, service } = fixture()
    await expect(service.save(null, createInput(sources))).rejects.toThrow(BadRequestException)
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('外链切换受管图片必须明确清空原来源', async () => {
    const { transaction, service } = fixture()
    await expect(service.save(42, { revision: 3, mediaId })).rejects.toThrow(BadRequestException)
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('受管图片切换外链必须明确清空原来源', async () => {
    const { item, media, transaction, service } = fixture({ externalImageUrl: null })
    item.media = media
    await expect(service.save(42, { revision: 3, externalImageUrl })).rejects.toThrow(BadRequestException)
    expect(transaction.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferencesMock).not.toHaveBeenCalled()
  })

  it('显式切换外链为受管图片后登记当前内容引用', async () => {
    const { item, media, transaction, service } = fixture()

    await service.save(42, { revision: 3, mediaId, externalImageUrl: null })

    expect(item.media).toBe(media)
    expect(item.externalImageUrl).toBeNull()
    expect(synchronizeMediaReferencesMock).toHaveBeenCalledWith(
      transaction,
      'image-prompt:42',
      'image-prompt',
      [mediaUrl(mediaId)],
      { imagePrompt: item },
    )
  })

  it('显式切换受管图片为外链只释放当前内容引用，不伪造外链尺寸', async () => {
    const { item, media, transaction, service } = fixture({ externalImageUrl: null })
    item.media = media

    const result = await service.save(42, { revision: 3, mediaId: null, externalImageUrl })

    expect(item.media).toBeNull()
    expect(result).toMatchObject({ imageUrl: externalImageUrl, mediaId: null, width: null, height: null })
    expect(transaction.findOne).not.toHaveBeenCalledWith(MediaAsset, expect.anything())
    expect(synchronizeMediaReferencesMock).toHaveBeenCalledWith(transaction, 'image-prompt:42', 'image-prompt', [], {
      imagePrompt: item,
    })
  })

  it('媒体引用同步失败向事务传播，不返回已保存结果', async () => {
    const { em, transaction, service } = fixture()
    const failure = new ConflictException('媒体引用失效')
    synchronizeMediaReferencesMock.mockRejectedValueOnce(failure)

    await expect(service.save(42, { revision: 3, title: '街角' })).rejects.toBe(failure)

    expect(transaction.flush).toHaveBeenCalledTimes(1)
    expect(em.findOne).not.toHaveBeenCalled()
  })
})
