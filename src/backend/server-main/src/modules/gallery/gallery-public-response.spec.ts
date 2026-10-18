/** @file gallery-public-response.spec.ts @description 图库公开列表、详情、导航与统计的字段白名单及可见性回归 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { GallerySettings } from '../../entities/gallery-settings.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { GalleryQuery } from './gallery.dto'
import { GalleryService } from './gallery.service'

const publishedAt = new Date('2026-10-01T08:00:00.000Z')
const mediaId = '11111111-1111-4111-8111-111111111111'
const publicPhoto = {
  id: 1,
  title: '海边晨光',
  description: '雨后的海岸',
  source: 'media',
  src: `/api/v1/media/${mediaId}.webp`,
  srcLarge: `/api/v1/media/${mediaId}.webp`,
  width: 1600,
  height: 1000,
  format: 'image/webp',
  category: '风景',
  date: '2026-09-30',
  location: '海岸',
  device: '相机',
  publishedAt: publishedAt.toISOString(),
}

function fixture() {
  const media = Object.assign(new MediaAsset(), {
    id: mediaId,
    width: 1600,
    height: 1000,
    mimeType: 'image/webp',
    originalName: 'private-original.jpg',
    storageKey: 'private/storage/key',
    sha256: 'private-media-sha256',
    byteSize: 98765,
    description: '仅用于管理的媒体说明',
    createdAt: publishedAt,
  })
  const photo: GalleryPhoto = Object.assign(new GalleryPhoto(), {
    id: 1,
    title: '海边晨光',
    description: '雨后的海岸',
    media,
    externalUrl: null,
    category: '风景',
    takenOn: '2026-09-30',
    location: '海岸',
    device: '相机',
    status: 'published',
    publishedAt,
    deletedAt: null,
    revision: 17,
    sortOrder: 999,
    requestId: 'private-request-id',
    requestHash: 'private-request-hash',
    visitorHash: 'private-visitor-hash',
    ip: '192.0.2.17',
    email: 'private@example.invalid',
    createdAt: publishedAt,
    updatedAt: publishedAt,
  })
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[photo], 1]),
    findOne: jest.fn().mockResolvedValue(photo),
    findOneOrFail: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
    execute: jest.fn(),
  }
  return { photo, em, service: new GalleryService(em as unknown as EntityManager) }
}

describe('图库公开 GET 字段白名单', () => {
  it('列表仅序列化展示字段和媒体公开尺寸，管理筛选不能改变可见性', async () => {
    const { em, service } = fixture()
    const result = await service.list(Object.assign(new GalleryQuery(), { status: 'draft' }))
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({ items: [publicPhoto], total: 1, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      GalleryPhoto,
      { status: 'published', deletedAt: null },
      expect.objectContaining({ populate: ['media'] }),
    )
  })

  it('详情只返回公开关联卡片，排除草稿、撤回、删除和缺失目标', async () => {
    const { photo, em, service } = fixture()
    photo.relatedContent = [1, 2, 3, 4, 5].map((id) => ({ type: 'post', id }))
    em.execute.mockResolvedValue([
      { type: 'post', id: 1, title: '海边游记', slug: 'coast', status: 'published', deleted_at: null, revision: 18 },
      { type: 'post', id: 2, title: '私有草稿', status: 'draft', deleted_at: null },
      { type: 'post', id: 3, title: '撤回内容', status: 'withdrawn', deleted_at: null },
      { type: 'post', id: 4, title: '回收内容', status: 'published', deleted_at: publishedAt },
    ])
    expect(JSON.parse(JSON.stringify(await service.detail(1)))).toStrictEqual({
      ...publicPhoto,
      relatedContent: [{ type: 'post', id: 1, title: '海边游记', url: '/articles/coast' }],
    })
    expect(em.findOne).toHaveBeenCalledWith(
      GalleryPhoto,
      { id: 1, status: 'published', deletedAt: null },
      { populate: ['media'] },
    )
  })

  it('外链作品不暴露原字段名，也不虚构媒体尺寸或管理元数据', () => {
    const { photo, service } = fixture()
    photo.media = null
    photo.externalUrl = 'https://images.example/coast.jpg'
    photo.takenOn = null
    photo.publishedAt = null
    expect(JSON.parse(JSON.stringify(service.serialize(photo)))).toStrictEqual({
      id: 1,
      title: '海边晨光',
      description: '雨后的海岸',
      source: 'external',
      src: 'https://images.example/coast.jpg',
      srcLarge: 'https://images.example/coast.jpg',
      category: '风景',
      date: '',
      location: '海岸',
      device: '相机',
      publishedAt: null,
    })
  })

  it('详情与导航对不可公开目标返回不存在，导航不继续查询邻居', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    em.count.mockResolvedValue(0)
    await expect(service.detail(2)).rejects.toThrow('作品不存在或尚未公开')
    await expect(service.navigation(2, new GalleryQuery())).rejects.toThrow('作品不存在或尚未公开')
    expect(em.count).toHaveBeenCalledWith(GalleryPhoto, { id: 2, status: 'published', deletedAt: null })
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('导航仅返回公开编号和页码，不透传原始定位行或管理字段', async () => {
    const { em, service } = fixture()
    em.execute.mockResolvedValue([{ previousId: 3, nextId: 2, position: 13, revision: 99, requestHash: 'private' }])
    expect(JSON.parse(JSON.stringify(await service.navigation(1, new GalleryQuery())))).toStrictEqual({
      matched: true,
      page: 2,
      previousId: 3,
      nextId: 2,
      previousPage: 1,
      nextPage: 2,
    })
    expect(em.count).toHaveBeenCalledWith(GalleryPhoto, { id: 1, status: 'published', deletedAt: null })
    expect(em.execute.mock.calls[0]?.[0]).toContain("status='published' and deleted_at is null")
    em.execute.mockResolvedValue([])
    expect(await service.navigation(1, new GalleryQuery())).toStrictEqual({
      matched: false,
      page: null,
      previousId: null,
      nextId: null,
      previousPage: null,
      nextPage: null,
    })
  })

  it('统计只展示公开聚合及器材，站点配置的版本和更新时间不进入响应', async () => {
    const { em, service } = fixture()
    const gear = [{ icon: 'lucide:camera', name: '随身相机', description: '日常记录' }]
    em.findOneOrFail.mockResolvedValue(
      Object.assign(new GallerySettings(), { id: 'default', gear, revision: 45, updatedAt: publishedAt }),
    )
    em.execute
      .mockResolvedValueOnce([
        { value: '', count: 1 },
        { value: '风景', count: 2 },
      ])
      .mockResolvedValueOnce([{ photos: 3, locations: 2, categories: 1 }])
    expect(JSON.parse(JSON.stringify(await service.metadata()))).toStrictEqual({
      categories: [
        { value: '', count: 1, label: '未分类' },
        { value: '风景', count: 2, label: '风景' },
      ],
      stats: { photos: 3, locations: 2, categories: 1 },
      gear,
    })
    expect(em.findOneOrFail).toHaveBeenCalledWith(GallerySettings, { id: 'default' })
    for (const [sql] of em.execute.mock.calls) {
      expect(sql).toContain("deleted_at is null and status='published'")
      expect(sql).not.toMatch(/select\s+\*|revision|request_hash|storage_key/i)
    }
  })
})
