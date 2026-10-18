/** @file gallery-search.spec.ts @description 图库搜索与搜索内导航的字面匹配、公开过滤、稳定分页和空结果 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { NotFoundException } from '@nestjs/common'
import { GalleryPhoto } from '../../entities/gallery-photo.entity'
import { GalleryQuery } from './gallery.dto'
import { GalleryService } from './gallery.service'

const literalPatterns = [
  ['%', '%\\%%'],
  ['_', '%\\_%'],
  ['\\', '%\\\\%'],
  [String.raw`C:\100%_资料`, String.raw`%C:\\100\%\_资料%`],
  ['随笔', '%随笔%'],
]

function fixture() {
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(1),
    execute: jest.fn().mockResolvedValue([]),
  }
  const service = new GalleryService(em as unknown as EntityManager)
  return { em, service }
}

describe('图库公开搜索', () => {
  it.each(literalPatterns)('关键词 %s 在标题、描述和地点中使用相同的字面 LIKE 模式', async (q, pattern) => {
    const { em, service } = fixture()

    await service.list({ q, page: 2, pageSize: 4 })

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount).toHaveBeenCalledWith(
      GalleryPhoto,
      {
        status: 'published',
        deletedAt: null,
        $or: [{ title: { $ilike: pattern } }, { description: { $ilike: pattern } }, { location: { $ilike: pattern } }],
      },
      { populate: ['media'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 4, offset: 4 },
    )
  })

  it.each(['风景', ''])('分类 %j 与搜索取交集，公开调用忽略管理状态', async (category) => {
    const { em, service } = fixture()

    await service.list({ q: '山间', category, status: 'draft', page: 1, pageSize: 12 })

    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
      status: 'published',
      deletedAt: null,
      category,
      $or: [{ title: { $ilike: '%山间%' } }, { description: { $ilike: '%山间%' } }, { location: { $ilike: '%山间%' } }],
    })
  })

  it('外链结果不伪造图片尺寸，保留公开字段并排除管理状态和凭据', async () => {
    const { em, service } = fixture()
    const item = Object.assign(new GalleryPhoto(), {
      id: 9,
      title: '山间晨雾',
      description: '清晨远足时记录的山谷',
      category: '风景',
      location: '山谷步道',
      device: '随身相机',
      externalUrl: 'https://images.example.com/mountain.jpg',
      takenOn: '2026-06-01',
      publishedAt: new Date('2026-06-01T08:00:00Z'),
      status: 'published' as const,
      revision: 3,
      requestId: 'private-request',
      requestHash: 'private-hash',
    })
    em.findAndCount.mockResolvedValue([[item], 7])

    await expect(service.list({ q: '山间', page: 2, pageSize: 1 })).resolves.toEqual({
      items: [
        {
          id: 9,
          title: '山间晨雾',
          description: '清晨远足时记录的山谷',
          source: 'external',
          src: 'https://images.example.com/mountain.jpg',
          srcLarge: 'https://images.example.com/mountain.jpg',
          width: undefined,
          height: undefined,
          format: undefined,
          category: '风景',
          date: '2026-06-01',
          location: '山谷步道',
          device: '随身相机',
          publishedAt: '2026-06-01T08:00:00.000Z',
        },
      ],
      total: 7,
      page: 2,
      pageSize: 1,
    })
  })

  it('空搜索使用默认首屏分页，省略分类时查询全部公开分类', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new GalleryQuery(), { q: '' })

    await expect(service.list(query)).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      GalleryPhoto,
      { status: 'published', deletedAt: null },
      { populate: ['media'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 12, offset: 0 },
    )
  })

  it('越界页保留筛选后的真实总数和请求页码', async () => {
    const { em, service } = fixture()
    em.findAndCount.mockResolvedValue([[], 13])

    await expect(service.list({ q: '山间', page: 4, pageSize: 6 })).resolves.toEqual({
      items: [],
      total: 13,
      page: 4,
      pageSize: 6,
    })
    expect(em.findAndCount.mock.calls[0]?.[2]).toMatchObject({ limit: 6, offset: 18 })
  })

  it('非空关键词没有匹配作品时返回零总数和空列表', async () => {
    const { service } = fixture()

    await expect(service.list({ q: '不存在的作品', page: 1, pageSize: 6 })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 6,
    })
  })

  it('读取失败原样抛出，不能伪造空搜索结果', async () => {
    const { em, service } = fixture()
    const failure = new Error('图库查询失败')
    em.findAndCount.mockRejectedValue(failure)

    await expect(service.list({ q: '山间', page: 1, pageSize: 12 })).rejects.toBe(failure)
  })
})

describe('图库搜索内导航', () => {
  it.each(literalPatterns)('导航关键词 %s 沿用列表转义并参数化所有字段', async (q, pattern) => {
    const { em, service } = fixture()
    em.execute.mockResolvedValue([{ previousId: 10, nextId: 8, position: 12 }])

    await expect(service.navigation(9, { q, category: '', page: 1, pageSize: 12 })).resolves.toEqual({
      matched: true,
      page: 1,
      previousId: 10,
      nextId: 8,
      previousPage: 1,
      nextPage: 2,
    })
    expect(em.count).toHaveBeenCalledWith(GalleryPhoto, { id: 9, deletedAt: null, status: 'published' })
    expect(em.execute).toHaveBeenCalledTimes(1)
    const [sql, parameters] = em.execute.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("status='published' and deleted_at is null and category=?")
    expect(sql).toContain('(title ilike ? or description ilike ? or location ilike ?)')
    expect(sql).toContain('window w as (order by sort_order desc,id desc)')
    expect(sql).toContain('ordered where id=?')
    expect(parameters).toEqual(['', pattern, pattern, pattern, 9])
  })

  it('公开作品不在搜索结果内时返回未匹配，页码与相邻项均为空', async () => {
    const { em, service } = fixture()

    await expect(service.navigation(9, { q: '海边', page: 1, pageSize: 12 })).resolves.toEqual({
      matched: false,
      page: null,
      previousId: null,
      nextId: null,
      previousPage: null,
      nextPage: null,
    })
    expect(em.execute.mock.calls[0]?.[1]).toEqual(['%海边%', '%海边%', '%海边%', 9])
  })

  it('不可见或已删除的作品不继续搜索导航位置', async () => {
    const { em, service } = fixture()
    em.count.mockResolvedValue(0)

    await expect(service.navigation(9, new GalleryQuery())).rejects.toBeInstanceOf(NotFoundException)
    expect(em.count).toHaveBeenCalledWith(GalleryPhoto, { id: 9, deletedAt: null, status: 'published' })
    expect(em.execute).not.toHaveBeenCalled()
  })
})
