/** @file link-public-response.spec.ts @description 友链公开列表、详情及规则统计的字段白名单和可见性回归 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FriendLink } from '../../entities/friend-link.entity'
import { LinkSettings } from '../../entities/link-settings.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { LinkQuery } from './link.dto'
import { LinkService } from './link.service'

const publishedAt = new Date('2026-10-01T08:00:00.000Z')
const mediaId = '11111111-1111-4111-8111-111111111111'
const publicLink = {
  id: 1,
  name: '山间笔记',
  description: '朋友的摄影与生活记录',
  url: 'https://example.com/journal',
  domain: 'example.com',
  avatar: `/api/v1/media/${mediaId}.webp`,
  width: 300,
  height: 300,
  isFeatured: true,
  publishedAt: publishedAt.toISOString(),
}

function fixture() {
  const logoMedia = Object.assign(new MediaAsset(), {
    id: mediaId,
    width: 300,
    height: 300,
    mimeType: 'image/webp',
    originalName: 'private-avatar.jpg',
    storageKey: 'private/storage/key',
    sha256: 'private-media-sha256',
    byteSize: 98765,
    createdAt: publishedAt,
  })
  const link: FriendLink = Object.assign(new FriendLink(), {
    id: 1,
    name: '山间笔记',
    description: '朋友的摄影与生活记录',
    url: 'https://example.com/journal',
    logoMedia,
    logoUrl: null,
    isFeatured: true,
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
    findAndCount: jest.fn().mockResolvedValue([[link], 1]),
    findOne: jest.fn().mockResolvedValue(link),
    findOneOrFail: jest.fn(),
    execute: jest.fn(),
  }
  return { link, em, service: new LinkService(em as unknown as EntityManager) }
}

describe('友链公开 GET 字段白名单', () => {
  it('列表只暴露名片字段，管理状态输入不能覆盖公开可见性', async () => {
    const { em, service } = fixture()
    const result = await service.list(Object.assign(new LinkQuery(), { status: 'draft', featured: 'true' }))
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({ items: [publicLink], total: 1, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      FriendLink,
      { status: 'published', deletedAt: null, isFeatured: true },
      expect.objectContaining({ populate: ['logoMedia'] }),
    )
  })

  it('详情沿用公开投影，不返回头像实体、提交信息或版本', async () => {
    const { em, service } = fixture()
    expect(JSON.parse(JSON.stringify(await service.detail(1)))).toStrictEqual(publicLink)
    expect(em.findOne).toHaveBeenCalledWith(
      FriendLink,
      { id: 1, status: 'published', deletedAt: null },
      { populate: ['logoMedia'] },
    )
  })

  it.each([null, 'https://images.example/avatar.png'])('外部或缺省头像 %s 只使用公开 avatar 字段', (logoUrl) => {
    const { link, service } = fixture()
    link.logoMedia = null
    link.logoUrl = logoUrl
    link.publishedAt = null
    expect(JSON.parse(JSON.stringify(service.serialize(link)))).toStrictEqual({
      ...publicLink,
      avatar: logoUrl,
      width: null,
      height: null,
      publishedAt: null,
    })
  })

  it('不可公开详情不会使用管理查询或返回草稿占位', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(2)).rejects.toThrow('友链不存在或暂未公开')
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(
      FriendLink,
      { id: 2, status: 'published', deletedAt: null },
      { populate: ['logoMedia'] },
    )
  })

  it('统计和规则不携带设置版本，统计查询只读取公开未删除友链', async () => {
    const { em, service } = fixture()
    em.execute.mockResolvedValue([{ links: 3, featured: 1, domains: 2 }])
    em.findOneOrFail.mockResolvedValue(
      Object.assign(new LinkSettings(), {
        id: 'default',
        rules: ['保持独立创作', '请使用有效的网站地址'],
        revision: 32,
        updatedAt: publishedAt,
      }),
    )
    expect(JSON.parse(JSON.stringify(await service.metadata()))).toStrictEqual({
      stats: { links: 3, featured: 1, domains: 2 },
      rules: ['保持独立创作', '请使用有效的网站地址'],
    })
    expect(em.findOneOrFail).toHaveBeenCalledWith(LinkSettings, { id: 'default' })
    expect(em.execute).toHaveBeenCalledTimes(1)
    const sql = em.execute.mock.calls[0]?.[0] as string
    expect(sql).toContain("from friend_link where status='published' and deleted_at is null")
    expect(sql).not.toMatch(/select\s+\*|revision|request_hash|storage_key/i)
  })
})
