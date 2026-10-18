/** @file link.service.spec.ts @description 友链公开查询、推荐排序、管理写入与媒体引用边界的隔离单元测试 */
import 'reflect-metadata'
import { LockMode } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FriendLink } from '../../entities/friend-link.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { submissionHash } from '../moment/moment-values'
import { AdminLinkQuery, LinkQuery } from './link.dto'
import type { SaveLinkDto } from './link.dto'
import { linkValues } from './link-values'
import { LinkService } from './link.service'

jest.mock('../media/media-references', () => ({
  ...jest.requireActual<typeof import('../media/media-references')>('../media/media-references'),
  lockMedia: jest.fn().mockResolvedValue(undefined),
  synchronizeMediaReferences: jest.fn().mockResolvedValue(undefined),
}))

const requestId = '19752e9a-7cf7-4cb1-859b-2c25b171541f'
const mediaId = '65383da2-028a-4be9-a686-ebd066f7241b'
const createdAt = new Date('2026-10-01T01:00:00.000Z')
const publishedAt = new Date('2026-10-02T01:00:00.000Z')

function fixture() {
  const item: FriendLink = Object.assign(new FriendLink(), {
    id: 7,
    name: '山间来信',
    description: '记录技术与日常',
    url: 'https://example.com/journal',
    status: 'published',
    isFeatured: true,
    sortOrder: 12,
    revision: 3,
    requestId,
    requestHash: 'private-hash',
    publishedAt,
    createdAt,
    updatedAt: createdAt,
  })
  const media = Object.assign(new MediaAsset(), {
    id: mediaId,
    mimeType: 'image/webp',
    width: 240,
    height: 180,
    storageKey: 'private/logo.webp',
  })
  const settings = Object.assign(new LinkSettings(), {
    id: 'default',
    rules: ['分享原创内容，保持交流。'],
    revision: 2,
    updatedAt: createdAt,
  })
  let savedItem = item
  const tx = {
    findOne: jest.fn().mockImplementation((entity: unknown, where: { id?: unknown }) => {
      if (entity === MediaAsset) return Promise.resolve(media)
      return Promise.resolve(entity === FriendLink && where.id === item.id ? item : null)
    }),
    findOneOrFail: jest.fn().mockResolvedValue(settings),
    create: jest.fn().mockImplementation((_entity: unknown, values: Partial<FriendLink>) => {
      savedItem = Object.assign(new FriendLink(), { id: 42 }, values)
      return savedItem
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    nativeDelete: jest.fn().mockResolvedValue(1),
  }
  const em = {
    findOne: jest.fn().mockImplementation(() => Promise.resolve(savedItem)),
    findOneOrFail: jest.fn().mockResolvedValue(settings),
    findAndCount: jest.fn().mockResolvedValue([[item], 1]),
    execute: jest.fn().mockResolvedValue([{ links: 8, featured: 3, domains: 5 }]),
    transactional: jest
      .fn()
      .mockImplementation((run: (manager: EntityManager) => Promise<unknown>) => run(tx as unknown as EntityManager)),
  }
  const service = new LinkService(em as unknown as EntityManager)
  return { item, media, settings, tx, em, service }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('友链公开读取与推荐', () => {
  it('公开列表仅查询已发布且未删除记录，推荐、排序值和编号依次倒序', async () => {
    const { service, em } = fixture()
    const result = await service.list(Object.assign(new LinkQuery(), { page: 3, pageSize: 5 }))

    expect(em.findAndCount).toHaveBeenCalledWith(
      FriendLink,
      { status: 'published', deletedAt: null },
      {
        populate: ['logoMedia'],
        orderBy: { isFeatured: 'DESC', sortOrder: 'DESC', id: 'DESC' },
        limit: 5,
        offset: 10,
      },
    )
    expect(result).toEqual({
      items: [expect.objectContaining({ id: 7, isFeatured: true })],
      total: 1,
      page: 3,
      pageSize: 5,
    })
    expect(result.items[0]).not.toHaveProperty('revision')
    expect(result.items[0]).not.toHaveProperty('status')
  })

  it.each([
    ['true', true],
    ['false', false],
  ] as const)('推荐筛选 %s 保持公开边界', async (featured, expected) => {
    const { service, em } = fixture()
    await service.list(Object.assign(new LinkQuery(), { featured }))
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
      status: 'published',
      deletedAt: null,
      isFeatured: expected,
    })
  })

  it('搜索同时覆盖名称、描述与网址，并按字面转义通配符和反斜杠', async () => {
    const { service, em } = fixture()
    await service.list(Object.assign(new LinkQuery(), { q: "100%_\\' OR 1=1 --", featured: 'true' }))
    const pattern = String.raw`%100\%\_\\' OR 1=1 --%`
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
      status: 'published',
      deletedAt: null,
      isFeatured: true,
      $or: [{ name: { $ilike: pattern } }, { description: { $ilike: pattern } }, { url: { $ilike: pattern } }],
    })
  })

  it('空搜索保留默认分页，越界页保持真实总数和空列表', async () => {
    const { service, em } = fixture()
    em.findAndCount.mockResolvedValue([[], 13])
    await expect(service.list(Object.assign(new LinkQuery(), { q: '', page: 8 }))).resolves.toEqual({
      items: [],
      total: 13,
      page: 8,
      pageSize: 12,
    })
    expect(em.findAndCount.mock.calls[0]?.[1]).not.toHaveProperty('$or')
  })

  it.each([undefined, 'all', 'draft', 'published', 'withdrawn'] as const)(
    '管理列表状态 %s 始终排除删除记录并返回管理字段',
    async (status) => {
      const { service, em, item } = fixture()
      item.isFeatured = false
      if (status && status !== 'all') item.status = status
      const result = await service.list(Object.assign(new AdminLinkQuery(), { status, featured: 'false' }), true)
      expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
        deletedAt: null,
        isFeatured: false,
        ...(status && status !== 'all' ? { status } : {}),
      })
      expect(result.items[0]).toMatchObject({ revision: 3, status: item.status, sortOrder: 12, isFeatured: false })
    },
  )

  it('公开调用不能通过附带管理状态参数读取草稿', async () => {
    const { service, em } = fixture()
    await service.list(Object.assign(new AdminLinkQuery(), { status: 'draft' }))
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({ status: 'published', deletedAt: null })
  })

  it('公开投影只包含展示字段，受管头像使用媒体地址和真实尺寸', () => {
    const { service, item, media } = fixture()
    item.logoMedia = media
    expect(service.serialize(item)).toEqual({
      id: 7,
      name: '山间来信',
      description: '记录技术与日常',
      url: 'https://example.com/journal',
      domain: 'example.com',
      avatar: `/api/v1/media/${mediaId}.webp`,
      width: 240,
      height: 180,
      isFeatured: true,
      publishedAt: publishedAt.toISOString(),
    })
    expect(service.serialize(item, true)).toMatchObject({
      logoMediaId: mediaId,
      logoUrl: null,
      status: 'published',
      sortOrder: 12,
      revision: 3,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    })
    expect(service.serialize(item, true)).not.toHaveProperty('requestHash')
    expect(service.serialize(item, true)).not.toHaveProperty('requestId')
    expect(service.serialize(item, true)).not.toHaveProperty('storageKey')
  })

  it.each([null, 'https://images.example.com/logo.webp'])('外部或空头像 %s 不虚构尺寸', (logoUrl) => {
    const { service, item } = fixture()
    item.logoUrl = logoUrl
    item.publishedAt = null
    item.url = 'https://example.com:8443/journal'
    expect(service.serialize(item)).toMatchObject({
      avatar: logoUrl,
      width: null,
      height: null,
      publishedAt: null,
      domain: 'example.com:8443',
    })
  })

  it.each([false, true])('详情按管理权限 %s 限定状态并返回对应投影', async (admin) => {
    const { service, em } = fixture()
    const result = await service.detail(7, admin)
    expect(em.findOne).toHaveBeenCalledWith(
      FriendLink,
      { id: 7, deletedAt: null, ...(admin ? {} : { status: 'published' }) },
      { populate: ['logoMedia'] },
    )
    expect('revision' in result).toBe(admin)
  })

  it('详情不存在时返回 404，不伪造公开内容', async () => {
    const { service, em } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(7)).rejects.toMatchObject({ status: 404 })
  })

  it('非法详情编号在查询之前拒绝', async () => {
    const { service, em } = fixture()
    await expect(service.detail(0)).rejects.toMatchObject({ status: 400 })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it('统计只聚合公开未删除记录，并独立返回友链规则', async () => {
    const { service, em, settings } = fixture()
    await expect(service.metadata()).resolves.toEqual({
      stats: { links: 8, featured: 3, domains: 5 },
      rules: settings.rules,
    })
    const sql = em.execute.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/count\(\*\)::int as links/)
    expect(sql).toMatch(/count\(\*\) filter\(where is_featured\)::int as featured/)
    expect(sql).toMatch(/count\(distinct substring\(url/)
    expect(sql).toMatch(/where status='published' and deleted_at is null/)
    expect(sql).not.toMatch(/\b(limit|offset)\b/i)
    expect(em.findOneOrFail).toHaveBeenCalledWith(LinkSettings, { id: 'default' })
  })

  it('列表和统计读取失败时保留真实错误', async () => {
    const { service, em } = fixture()
    const failure = new Error('读取失败')
    em.findAndCount.mockRejectedValue(failure)
    em.execute.mockRejectedValue(failure)
    await expect(service.list(new LinkQuery())).rejects.toBe(failure)
    await expect(service.metadata()).rejects.toBe(failure)
  })
})

describe('友链管理保存与提交核查', () => {
  it.each([
    ['缺少名称', null, { url: 'https://example.com/new', requestId }],
    ['缺少地址', null, { name: '新朋友', requestId }],
    ['缺少提交标识', null, { name: '新朋友', url: 'https://example.com/new' }],
    ['创建携带版本', null, { name: '新朋友', url: 'https://example.com/new', requestId, revision: 0 }],
    ['编辑缺少版本', 7, { name: '新朋友' }],
    ['编辑携带提交标识', 7, { revision: 3, requestId }],
    ['编辑编号非法', -1, { revision: 3 }],
  ] satisfies [string, number | null, SaveLinkDto][])('%s 在事务前拒绝', async (_label, id, input) => {
    const { service, em } = fixture()
    await expect(service.save(id, input)).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('新建先校验规范地址与重复记录，再创建草稿并登记空媒体引用', async () => {
    const { service, em, tx } = fixture()
    const input = { name: '新朋友', url: 'HTTPS://NEW.EXAMPLE.COM:443/Notes', requestId }
    const result = await service.save(null, input)
    expect(lockMedia).toHaveBeenCalledWith(tx)
    expect(tx.findOne).toHaveBeenNthCalledWith(1, FriendLink, { requestId })
    expect(tx.findOne).toHaveBeenNthCalledWith(2, FriendLink, {
      url: 'https://new.example.com/Notes',
      deletedAt: null,
    })
    expect(tx.create).toHaveBeenCalledWith(FriendLink, {
      name: '新朋友',
      url: 'https://new.example.com/Notes',
      requestId,
      requestHash: submissionHash(linkValues(input)),
    })
    expect(tx.findOne.mock.invocationCallOrder[1]).toBeLessThan(tx.create.mock.invocationCallOrder[0]!)
    expect(result).toMatchObject({ id: 42, status: 'draft', revision: 0, publishedAt: null, avatar: null })
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(tx, 'link:42', 'link', [], {
      friendLink: expect.objectContaining({ id: 42 }),
    })
    expect(tx.flush).toHaveBeenCalledTimes(2)
    expect(em.findOne).toHaveBeenCalledWith(FriendLink, { id: 42, deletedAt: null }, { populate: ['logoMedia'] })
  })

  it('同一提交及规范化输入重试返回原记录，不重复校验或写入', async () => {
    const { service, item, tx } = fixture()
    const input = { name: '山间来信', url: 'HTTPS://EXAMPLE.COM:443/journal', requestId }
    item.requestHash = submissionHash({ name: '山间来信', url: 'https://example.com/journal' })
    tx.findOne.mockResolvedValueOnce(item)
    await expect(service.save(null, input)).resolves.toMatchObject({ id: item.id, revision: 3 })
    expect(tx.findOne).toHaveBeenCalledTimes(1)
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
  })

  it.each(['输入变化', '原记录已删除'])('同一提交在%s时返回冲突', async (scenario) => {
    const { service, item, tx } = fixture()
    const input = { name: '山间来信', url: item.url, requestId }
    if (scenario === '原记录已删除') {
      item.requestHash = submissionHash(linkValues(input))
      item.deletedAt = createdAt
    }
    tx.findOne.mockResolvedValueOnce(item)
    await expect(service.save(null, input)).rejects.toMatchObject({ status: 409 })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('普通新建与任意未删除状态的规范地址冲突时拒绝', async () => {
    const { service, item, tx } = fixture()
    item.status = 'withdrawn'
    tx.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(item)
    await expect(
      service.save(null, { name: '新朋友', url: 'HTTPS://EXAMPLE.COM:443/journal', requestId }),
    ).rejects.toMatchObject({ status: 400 })
    expect(tx.findOne).toHaveBeenNthCalledWith(2, FriendLink, { url: item.url, deletedAt: null })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('编辑锁定当前记录，版本过期时不修改任何字段', async () => {
    const { service, item, tx } = fixture()
    await expect(service.save(7, { revision: 2, name: '不应保存' })).rejects.toMatchObject({ status: 409 })
    expect(tx.findOne).toHaveBeenCalledWith(
      FriendLink,
      { id: 7, deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(item.name).toBe('山间来信')
    expect(item.revision).toBe(3)
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('编辑不存在或已删除记录返回 404', async () => {
    const { service, tx } = fixture()
    tx.findOne.mockResolvedValueOnce(null)
    await expect(service.save(7, { revision: 3, name: '新朋友' })).rejects.toMatchObject({ status: 404 })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('修改网址检查所有未删除记录并排除当前编号', async () => {
    const { service, item, tx } = fixture()
    tx.findOne.mockResolvedValueOnce(item).mockResolvedValueOnce(Object.assign(new FriendLink(), { id: 9 }))
    await expect(service.save(7, { revision: 3, url: 'https://other.example.com/' })).rejects.toMatchObject({
      status: 400,
    })
    expect(tx.findOne).toHaveBeenNthCalledWith(2, FriendLink, {
      url: 'https://other.example.com/',
      deletedAt: null,
      id: { $ne: 7 },
    })
    expect(item.url).toBe('https://example.com/journal')
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('复制导入的同址草稿允许不改址编辑，不执行全状态重复检查', async () => {
    const { service, item, tx } = fixture()
    item.status = 'draft'
    item.publishedAt = null
    await expect(service.save(7, { revision: 3, name: '新的名称' })).resolves.toMatchObject({
      name: '新的名称',
      status: 'draft',
      revision: 4,
      publishedAt: null,
    })
    expect(tx.findOne).toHaveBeenCalledTimes(1)
    expect(item.url).toBe('https://example.com/journal')
    expect(item.description).toBe('记录技术与日常')
    expect(item.isFeatured).toBe(true)
  })

  it('同址草稿发布时阻止第二条公开记录', async () => {
    const { service, item, tx } = fixture()
    item.status = 'draft'
    tx.findOne.mockResolvedValueOnce(item).mockResolvedValueOnce(Object.assign(new FriendLink(), { id: 9 }))
    await expect(service.save(7, { revision: 3, status: 'published' })).rejects.toMatchObject({ status: 400 })
    expect(tx.findOne).toHaveBeenNthCalledWith(2, FriendLink, {
      url: item.url,
      status: 'published',
      deletedAt: null,
      id: { $ne: 7 },
    })
    expect(item.status).toBe('draft')
    expect(item.revision).toBe(3)
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('初次发布登记发布时间，后续撤回和重新发布保留原时间', async () => {
    const { service, item } = fixture()
    item.status = 'draft'
    item.publishedAt = null
    await service.save(7, { revision: 3, status: 'published' })
    const firstPublishedAt = item.publishedAt
    expect(firstPublishedAt).toBeInstanceOf(Date)
    await service.save(7, { revision: 4, status: 'withdrawn' })
    await service.save(7, { revision: 5, status: 'published' })
    expect(item.publishedAt).toBe(firstPublishedAt)
    expect(item.revision).toBe(6)
  })

  it.each(['补充外链', '补充受管图片'])('部分更新%s时合并原头像后执行互斥校验', async (scenario) => {
    const { service, item, media, tx } = fixture()
    const input: SaveLinkDto = { revision: 3 }
    if (scenario === '补充外链') {
      item.logoMedia = media
      input.logoUrl = 'https://images.example.com/logo.webp'
    } else {
      item.logoUrl = 'https://images.example.com/logo.webp'
      input.logoMediaId = mediaId
    }
    await expect(service.save(7, input)).rejects.toMatchObject({ status: 400 })
    expect(item.revision).toBe(3)
    expect(tx.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
  })

  it.each([
    ['不存在', null],
    ['不是图片', { mimeType: 'application/pdf', width: 240, height: 180 }],
    ['宽度无效', { mimeType: 'image/webp', width: 0, height: 180 }],
    ['高度无效', { mimeType: 'image/webp', width: 240, height: 0 }],
  ])('受管头像%s时拒绝创建且不留下实体', async (_label, asset) => {
    const { service, tx } = fixture()
    tx.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(asset)
    await expect(
      service.save(null, { name: '新朋友', url: 'https://new.example.com/', requestId, logoMediaId: mediaId }),
    ).rejects.toMatchObject({ status: 400 })
    expect(tx.findOne).toHaveBeenLastCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(tx.create).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('外部头像切换为受管头像必须显式清空外链，并登记本记录引用', async () => {
    const { service, item, media, tx } = fixture()
    item.logoUrl = 'https://images.example.com/logo.webp'
    const result = await service.save(7, { revision: 3, logoMediaId: mediaId, logoUrl: null })
    expect(item.logoMedia).toBe(media)
    expect(item.logoUrl).toBeNull()
    expect(result).toMatchObject({
      avatar: `/api/v1/media/${mediaId}.webp`,
      logoMediaId: mediaId,
      width: 240,
      height: 180,
    })
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(tx, 'link:7', 'link', [`/api/v1/media/${mediaId}.webp`], {
      friendLink: item,
    })
  })

  it('受管头像切换为外链时清空旧引用，不查询外部图片尺寸', async () => {
    const { service, item, media, tx } = fixture()
    item.logoMedia = media
    const result = await service.save(7, {
      revision: 3,
      logoMediaId: null,
      logoUrl: 'https://images.example.com/logo.webp',
    })
    expect(item.logoMedia).toBeNull()
    expect(result).toMatchObject({ avatar: 'https://images.example.com/logo.webp', width: null, height: null })
    expect(tx.findOne.mock.calls.every(([entity]) => entity === FriendLink)).toBe(true)
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(tx, 'link:7', 'link', [], { friendLink: item })
  })

  it('仅更新文字时保留受管头像并同步其引用', async () => {
    const { service, item, media, tx } = fixture()
    item.logoMedia = media
    await service.save(7, { revision: 3, description: '更新后的介绍' })
    expect(item.logoMedia).toBe(media)
    expect(tx.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(tx, 'link:7', 'link', [`/api/v1/media/${mediaId}.webp`], {
      friendLink: item,
    })
  })

  it('提交核查分别返回已保存、已删除和未找到状态', async () => {
    const { service, item, em } = fixture()
    await expect(service.submission(requestId)).resolves.toMatchObject({ state: 'saved', item: { id: 7, revision: 3 } })
    expect(em.findOne).toHaveBeenCalledWith(FriendLink, { requestId }, { populate: ['logoMedia'] })
    item.deletedAt = createdAt
    await expect(service.submission(requestId)).resolves.toEqual({ state: 'deleted', id: 7 })
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.submission(requestId)).rejects.toMatchObject({ status: 404 })
  })
})

describe('友链规则与删除版本保护', () => {
  it('规则读取返回完整规则、版本和更新时间', async () => {
    const { service, settings } = fixture()
    await expect(service.settings()).resolves.toEqual({
      rules: settings.rules,
      revision: 2,
      updatedAt: createdAt.toISOString(),
    })
  })

  it('规则保存锁定当前版本，成功后增加版本并重新读取', async () => {
    const { service, settings, tx, em } = fixture()
    const result = await service.saveSettings({ revision: 2, rules: ['坚持原创，欢迎来信。'] })
    expect(lockMedia).toHaveBeenCalledWith(tx)
    expect(tx.findOneOrFail).toHaveBeenCalledWith(
      LinkSettings,
      { id: 'default' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(settings.rules).toEqual(['坚持原创，欢迎来信。'])
    expect(result).toMatchObject({ revision: 3, rules: settings.rules })
    expect(tx.flush).toHaveBeenCalledTimes(1)
    expect(em.findOneOrFail).toHaveBeenCalledWith(LinkSettings, { id: 'default' })
  })

  it('规则版本冲突不覆盖原规则', async () => {
    const { service, settings, tx } = fixture()
    await expect(service.saveSettings({ revision: 1, rules: [] })).rejects.toMatchObject({ status: 409 })
    expect(settings.rules).toEqual(['分享原创内容，保持交流。'])
    expect(settings.revision).toBe(2)
    expect(settings.updatedAt).toBe(createdAt)
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('删除检查版本后软删除，并且只移除本友链媒体引用', async () => {
    const { service, item, tx } = fixture()
    await expect(service.remove(7, 3)).resolves.toEqual({ ok: true })
    expect(lockMedia).toHaveBeenCalledWith(tx)
    expect(tx.findOne).toHaveBeenCalledWith(FriendLink, { id: 7 }, { lockMode: LockMode.PESSIMISTIC_WRITE })
    expect(item.deletedAt).toBeInstanceOf(Date)
    expect(item.revision).toBe(4)
    expect(tx.nativeDelete).toHaveBeenCalledTimes(1)
    expect(tx.nativeDelete).toHaveBeenCalledWith(MediaReference, { friendLink: item })
    expect(tx.flush).toHaveBeenCalledTimes(1)
  })

  it('已删除记录重复删除保持幂等，即使提交旧版本也不重复写入', async () => {
    const { service, item, tx } = fixture()
    item.deletedAt = createdAt
    await expect(service.remove(7, 0)).resolves.toEqual({ ok: true })
    expect(item.revision).toBe(3)
    expect(item.deletedAt).toBe(createdAt)
    expect(tx.nativeDelete).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })

  it('删除版本冲突或目标不存在时不释放媒体引用', async () => {
    const { service, item, tx } = fixture()
    await expect(service.remove(7, 2)).rejects.toMatchObject({ status: 409 })
    expect(item.deletedAt).toBeUndefined()
    tx.findOne.mockResolvedValueOnce(null)
    await expect(service.remove(7, 3)).rejects.toMatchObject({ status: 404 })
    expect(tx.nativeDelete).not.toHaveBeenCalled()
    expect(tx.flush).not.toHaveBeenCalled()
  })
})
