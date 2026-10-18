/** @file gallery.service.spec.ts @description 图库公开筛选分页、图片来源互斥与管理保存的纯单元回归 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { LockMode } from '@mikro-orm/core'
import { plainToInstance } from 'class-transformer'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { MediaReference } from '../../entities/media-reference.entity'
import { mediaUrl } from '../media/media-references'
import { AdminGalleryQuery, GalleryQuery, SaveGalleryDto } from './gallery.dto'
import { GalleryService } from './gallery.service'

const mediaId = '89d07bb6-4c0e-4ca2-9bf0-1cafb6f3bd76'
const requestId = '3fdb53f0-c024-43a7-9496-432b2acb4043'
const externalUrl = 'https://images.example.com/coast.jpg?width=1600&name=%E6%B5%B7'
const publishedAt = new Date('2026-10-01T08:00:00.000Z')

function fixture() {
  const media = Object.assign(new MediaAsset(), {
    id: mediaId,
    storageKey: 'private/coast-original.jpg',
    originalName: 'coast.jpg',
    mimeType: 'image/jpeg',
    width: 1600,
    height: 900,
  })
  const photo = Object.assign(new GalleryPhoto(), {
    id: 8,
    title: '潮汐之间',
    description: '清晨的海岸',
    media,
    externalUrl: null,
    category: '风景',
    takenOn: '2026-09-30',
    location: '海边',
    device: '相机',
    status: 'published',
    publishedAt,
    revision: 3,
    sortOrder: 10,
    requestId,
    requestHash: 'private-submission-hash',
  })
  const state: { photo: GalleryPhoto | null; prior: GalleryPhoto | null; media: MediaAsset | null } = {
    photo,
    prior: null,
    media,
  }
  // 只模拟持久化边界，媒体引用同步及服务本身的校验仍执行真实实现。
  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === MediaAsset) return state.media
      if (entity === GalleryPhoto) return 'requestId' in where ? state.prior : state.photo
      throw new Error('出现未约定的实体查询')
    }),
    findAndCount: jest.fn().mockResolvedValue([[photo], 17]),
    execute: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
    flush: jest.fn().mockResolvedValue(undefined),
    nativeDelete: jest.fn().mockResolvedValue(0),
    getReference: jest.fn().mockReturnValue(media),
    create: jest.fn((entity: unknown, values: Record<string, unknown>) => {
      if (entity === GalleryPhoto) {
        state.photo = Object.assign(new GalleryPhoto(), { id: 12 }, values)
        return state.photo
      }
      if (entity === MediaReference) return Object.assign(new MediaReference(), values)
      throw new Error('出现未约定的实体创建')
    }),
    transactional: jest.fn(),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { photo, media, state, em, service: new GalleryService(em as unknown as EntityManager) }
}

describe('图库公开列表与投影', () => {
  it('默认读取公开且未删除的作品，按排序值和编号倒序分页', async () => {
    const { em, service } = fixture()
    const result = await service.list(new GalleryQuery())
    expect(em.findAndCount).toHaveBeenCalledWith(
      GalleryPhoto,
      { status: 'published', deletedAt: null },
      { populate: ['media'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 12, offset: 0 },
    )
    expect(result).toMatchObject({ total: 17, page: 1, pageSize: 12 })
    expect(result.items).toHaveLength(1)
  })

  it('组合分类、搜索和页码，搜索通配符及反斜杠按普通字符处理', async () => {
    const { em, service } = fixture()
    const query = plainToInstance(GalleryQuery, { q: '海_100%\\岸', category: '风景', page: '3', pageSize: '5' })
    const result = await service.list(query)
    expect(em.findAndCount).toHaveBeenCalledWith(
      GalleryPhoto,
      {
        status: 'published',
        deletedAt: null,
        category: '风景',
        $or: [
          { title: { $ilike: '%海\\_100\\%\\\\岸%' } },
          { description: { $ilike: '%海\\_100\\%\\\\岸%' } },
          { location: { $ilike: '%海\\_100\\%\\\\岸%' } },
        ],
      },
      { populate: ['media'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 5, offset: 10 },
    )
    expect(result).toMatchObject({ total: 17, page: 3, pageSize: 5 })
  })

  it('空分类表示未分类，空搜索不增加条件，越界页保留真实总数', async () => {
    const { em, service } = fixture()
    em.findAndCount.mockResolvedValue([[], 17])
    const result = await service.list(Object.assign(new GalleryQuery(), { category: '', q: '', page: 5 }))
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({ status: 'published', deletedAt: null, category: '' })
    expect(result).toEqual({ items: [], total: 17, page: 5, pageSize: 12 })
  })

  it('公开查询忽略管理状态，管理查询可筛选草稿或全部未删除状态', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new AdminGalleryQuery(), { status: 'draft' })
    await service.list(query)
    await service.list(query, true)
    await service.list(Object.assign(new AdminGalleryQuery(), { status: 'all' }), true)
    expect(em.findAndCount.mock.calls.map((call) => call[1])).toEqual([
      { deletedAt: null, status: 'published' },
      { deletedAt: null, status: 'draft' },
      { deletedAt: null },
    ])
  })

  it('受管图片的公开投影只含展示字段，不泄露管理状态、版本和存储信息', async () => {
    const { service } = fixture()
    const result = await service.list(new GalleryQuery())
    expect(result.items[0]).toEqual({
      id: 8,
      title: '潮汐之间',
      description: '清晨的海岸',
      source: 'media',
      src: mediaUrl(mediaId),
      srcLarge: mediaUrl(mediaId),
      width: 1600,
      height: 900,
      format: 'image/jpeg',
      category: '风景',
      date: '2026-09-30',
      location: '海边',
      device: '相机',
      publishedAt: publishedAt.toISOString(),
    })
  })

  it('外链原样展示，未知尺寸、格式和拍摄日期不伪造', () => {
    const { photo, service } = fixture()
    Object.assign(photo, { media: null, externalUrl, takenOn: null, publishedAt: null })
    expect(service.serialize(photo)).toMatchObject({
      source: 'external',
      src: externalUrl,
      srcLarge: externalUrl,
      width: undefined,
      height: undefined,
      format: undefined,
      date: '',
      publishedAt: null,
    })
  })

  it('公开详情限定公开且未删除，找不到记录时返回不存在', async () => {
    const { em, state, service } = fixture()
    state.photo = null
    await expect(service.detail(8)).rejects.toMatchObject({ status: 404 })
    expect(em.findOne).toHaveBeenCalledWith(
      GalleryPhoto,
      { id: 8, status: 'published', deletedAt: null },
      { populate: ['media'] },
    )
  })
})

describe('图库管理保存前置校验', () => {
  it.each<[string, number | null, SaveGalleryDto]>([
    ['创建缺少标题', null, { requestId, mediaId }],
    ['创建缺少提交标识', null, { title: '潮汐之间', mediaId }],
    ['创建携带编辑版本', null, { requestId, mediaId, title: '潮汐之间', revision: 0 }],
    ['编辑缺少版本', 8, { title: '新标题' }],
    ['编辑携带创建标识', 8, { revision: 3, requestId }],
    ['编号为零', 0, { revision: 3 }],
    ['编号为小数', 1.5, { revision: 3 }],
    ['编号超出数据库整数范围', 2147483648, { revision: 3 }],
  ])('%s 在进入事务前拒绝', async (_label, id, input) => {
    const { em, service } = fixture()
    await expect(service.save(id, input)).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '/coast.jpg',
    'https://user:pass@images.example.com/coast.jpg',
    'https://images.example.com/with space.jpg',
    'https://images.example.com/with\\slash.jpg',
    `https://blog.example.com${mediaUrl(mediaId)}`,
  ])('外链 %s 未通过校验时不进入事务', async (url) => {
    const { em, service } = fixture()
    await expect(service.save(null, { title: '潮汐之间', requestId, externalUrl: url })).rejects.toMatchObject({
      status: 400,
    })
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('过期版本在写入字段、版本及媒体引用前拒绝', async () => {
    const { photo, em, service } = fixture()
    await expect(service.save(8, { revision: 2, title: '不应保存' })).rejects.toMatchObject({ status: 409 })
    expect(em.findOne).toHaveBeenCalledWith(
      GalleryPhoto,
      { id: 8, deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(photo.title).toBe('潮汐之间')
    expect(photo.revision).toBe(3)
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
  })

  it('不存在或已删除的编辑目标不会重新创建', async () => {
    const { state, em, service } = fixture()
    state.photo = null
    await expect(service.save(8, { revision: 3, title: '潮汐之间' })).rejects.toMatchObject({ status: 404 })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })
})

describe('图库图片来源互斥与媒体引用', () => {
  it.each<[string, SaveGalleryDto]>([
    ['未提交任何来源', {}],
    ['同时清空两个来源', { mediaId: null, externalUrl: null }],
    ['同时提交两种来源', { mediaId, externalUrl }],
  ])('创建时%s会拒绝且不持久化', async (_label, source) => {
    const { em, service } = fixture()
    await expect(service.save(null, { title: '潮汐之间', requestId, ...source })).rejects.toThrow('恰好选择一种')
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
  })

  it.each(['不存在或已删除', '非图片类型', '宽度为零', '高度为零', '负数尺寸'])('%s的媒体不能保存', async (kind) => {
    const { media, state, em, service } = fixture()
    if (kind === '不存在或已删除') state.media = null
    if (kind === '非图片类型') media.mimeType = 'video/mp4'
    if (kind === '宽度为零') media.width = 0
    if (kind === '高度为零') media.height = 0
    if (kind === '负数尺寸') media.height = -1
    await expect(service.save(null, { title: '潮汐之间', requestId, mediaId })).rejects.toThrow('有效的媒体库图片')
    expect(em.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('受管图片创建默认为草稿，并同步对应作品的媒体引用', async () => {
    const { state, em, service } = fixture()
    const result = await service.save(null, { title: '潮汐之间', requestId, mediaId })
    expect(result).toMatchObject({ id: 12, source: 'media', status: 'draft', revision: 0, publishedAt: null })
    expect(em.execute).toHaveBeenCalledWith('select pg_advisory_xact_lock(742912)')
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'gallery:12' })
    expect(em.create).toHaveBeenCalledWith(
      MediaReference,
      expect.objectContaining({ sourceKey: 'gallery:12', kind: 'gallery', galleryPhoto: state.photo }),
    )
    expect(em.getReference).toHaveBeenCalledWith(MediaAsset, mediaId)
    expect(em.flush).toHaveBeenCalledTimes(2)
  })

  it.each(['https://images.example.com/coast.jpg', 'http://images.example.com/coast.jpg'])(
    '纯外链 %s 创建不查媒体、不生成媒体引用或尺寸',
    async (url) => {
      const { em, service } = fixture()
      const result = await service.save(null, { title: '潮汐之间', requestId, externalUrl: url })
      expect(result).toMatchObject({
        source: 'external',
        externalUrl: url,
        mediaId: null,
        width: undefined,
        height: undefined,
      })
      expect(em.findOne.mock.calls.every(([entity]) => entity !== MediaAsset)).toBe(true)
      expect(em.create.mock.calls.every(([entity]) => entity === GalleryPhoto)).toBe(true)
      expect(em.count).not.toHaveBeenCalled()
      expect(em.getReference).not.toHaveBeenCalled()
    },
  )

  it.each(['受管图片转外链', '外链转受管图片'])('%s省略清空旧来源时拒绝', async (direction) => {
    const { photo, em, service } = fixture()
    if (direction === '外链转受管图片') Object.assign(photo, { media: null, externalUrl })
    const source = direction === '受管图片转外链' ? { externalUrl } : { mediaId }
    await expect(service.save(8, { revision: 3, ...source })).rejects.toThrow('切换时请明确清空另一来源')
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
  })

  it('受管图片转外链时显式清空媒体，保留编号与发布日期并清除旧引用', async () => {
    const { photo, em, service } = fixture()
    const result = await service.save(8, { revision: 3, mediaId: null, externalUrl })
    expect(result).toMatchObject({ id: 8, source: 'external', mediaId: null, externalUrl, revision: 4 })
    expect(photo.publishedAt).toBe(publishedAt)
    expect(em.nativeDelete).toHaveBeenCalledWith(MediaReference, { sourceKey: 'gallery:8' })
    expect(em.create).not.toHaveBeenCalled()
  })

  it('外链转受管图片时显式清空外链，保留编号并建立媒体引用', async () => {
    const { photo, media, em, service } = fixture()
    Object.assign(photo, { media: null, externalUrl })
    const result = await service.save(8, { revision: 3, mediaId, externalUrl: null })
    expect(result).toMatchObject({ id: 8, source: 'media', mediaId, externalUrl: null, revision: 4 })
    expect(photo.media).toBe(media)
    expect(em.create).toHaveBeenCalledWith(
      MediaReference,
      expect.objectContaining({ sourceKey: 'gallery:8', galleryPhoto: photo, asset: media }),
    )
  })

  it('局部编辑不能把唯一来源清空', async () => {
    const { em, service } = fixture()
    await expect(service.save(8, { revision: 3, mediaId: null })).rejects.toThrow('恰好选择一种')
    expect(em.flush).not.toHaveBeenCalled()
  })
})

describe('图库局部更新与创建幂等', () => {
  it('DTO 中省略字段的 undefined 不覆盖旧值，显式空文本和空日期可以清除', async () => {
    const { photo, media, service } = fixture()
    const input = plainToInstance(SaveGalleryDto, { revision: 3, title: '海岸晨光', description: '', takenOn: null })
    await service.save(8, input)
    expect(photo).toMatchObject({
      title: '海岸晨光',
      description: '',
      category: '风景',
      location: '海边',
      device: '相机',
      takenOn: null,
      revision: 4,
      status: 'published',
      requestId,
      requestHash: 'private-submission-hash',
    })
    expect(photo.media).toBe(media)
    expect(photo.publishedAt).toBe(publishedAt)
  })

  it('首次发布记录公开时间，后续编辑不改写首次公开时间', async () => {
    const { photo, service } = fixture()
    Object.assign(photo, { status: 'draft', publishedAt: null })
    const now = new Date('2026-10-18T09:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now)
    try {
      await service.save(8, { revision: 3, status: 'published' })
      expect(photo.publishedAt).toEqual(now)
      jest.setSystemTime(new Date('2026-10-19T09:00:00.000Z'))
      await service.save(8, { revision: 4, title: '海岸晨光' })
      expect(photo.publishedAt).toEqual(now)
    } finally {
      jest.useRealTimers()
    }
  })

  it('相同提交重试兼容省略与显式空外链、空关联，不重复创建或更新引用', async () => {
    const { state, em, service } = fixture()
    const input = { title: '潮汐之间', requestId, mediaId }
    const first = await service.save(null, input)
    state.prior = state.photo
    em.create.mockClear()
    em.flush.mockClear()
    em.nativeDelete.mockClear()
    const second = await service.save(null, { ...input, externalUrl: null, relatedContent: [] })
    expect(second).toEqual(first)
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.nativeDelete).not.toHaveBeenCalled()
  })

  it.each(['内容发生变化', '原作品已删除'])('同一提交标识但%s时返回冲突', async (reason) => {
    const { state, em, service } = fixture()
    const input = { title: '潮汐之间', requestId, mediaId }
    await service.save(null, input)
    state.prior = state.photo
    if (reason === '原作品已删除') state.prior!.deletedAt = new Date()
    em.flush.mockClear()
    em.create.mockClear()
    await expect(
      service.save(null, { ...input, title: reason === '内容发生变化' ? '另一张作品' : input.title }),
    ).rejects.toMatchObject({
      status: 409,
    })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })
})
