/** @file link-search.spec.ts @description 友链搜索的字面匹配、推荐筛选、公开投影与稳定分页 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { FriendLink } from '../../entities/friend-link.entity'
import { LinkQuery } from './link.dto'
import { LinkService } from './link.service'

function fixture() {
  const em = { findAndCount: jest.fn().mockResolvedValue([[], 0]) }
  const service = new LinkService(em as unknown as EntityManager)
  return { em, service }
}

describe('友链公开搜索', () => {
  it.each([
    ['%', '%\\%%'],
    ['_', '%\\_%'],
    ['\\', '%\\\\%'],
    [String.raw`C:\100%_资料`, String.raw`%C:\\100\%\_资料%`],
    ['随笔', '%随笔%'],
  ])('关键词 %s 在名称、描述和网址中使用相同的字面 LIKE 模式', async (q, pattern) => {
    const { em, service } = fixture()

    await service.list({ q, page: 3, pageSize: 4 })

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount).toHaveBeenCalledWith(
      FriendLink,
      {
        status: 'published',
        deletedAt: null,
        $or: [{ name: { $ilike: pattern } }, { description: { $ilike: pattern } }, { url: { $ilike: pattern } }],
      },
      {
        populate: ['logoMedia'],
        orderBy: { isFeatured: 'DESC', sortOrder: 'DESC', id: 'DESC' },
        limit: 4,
        offset: 8,
      },
    )
  })

  it.each([
    ['true', true],
    ['false', false],
  ] as const)('推荐筛选 %s 与搜索取交集，公开调用忽略管理状态', async (featured, isFeatured) => {
    const { em, service } = fixture()

    await service.list({ q: '山间', featured, status: 'draft', page: 1, pageSize: 12 })

    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
      status: 'published',
      deletedAt: null,
      isFeatured,
      $or: [{ name: { $ilike: '%山间%' } }, { description: { $ilike: '%山间%' } }, { url: { $ilike: '%山间%' } }],
    })
  })

  it('代表结果保留域名和外部头像，排除管理状态、版本和提交凭据', async () => {
    const { em, service } = fixture()
    const item = Object.assign(new FriendLink(), {
      id: 8,
      name: '山间来信',
      description: '分享读书与旅行的个人博客',
      url: 'https://notes.example.com/journal',
      logoUrl: 'https://images.example.com/avatar.png',
      status: 'published' as const,
      isFeatured: true,
      publishedAt: new Date('2026-06-01T08:00:00Z'),
      revision: 3,
      requestId: 'private-request',
      requestHash: 'private-hash',
    })
    em.findAndCount.mockResolvedValue([[item], 5])

    await expect(service.list({ q: '山间', page: 2, pageSize: 1 })).resolves.toEqual({
      items: [
        {
          id: 8,
          name: '山间来信',
          description: '分享读书与旅行的个人博客',
          url: 'https://notes.example.com/journal',
          domain: 'notes.example.com',
          avatar: 'https://images.example.com/avatar.png',
          width: null,
          height: null,
          isFeatured: true,
          publishedAt: '2026-06-01T08:00:00.000Z',
        },
      ],
      total: 5,
      page: 2,
      pageSize: 1,
    })
  })

  it('空搜索使用默认首屏分页，不额外筛掉非推荐友链', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new LinkQuery(), { q: '' })

    await expect(service.list(query)).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      FriendLink,
      { status: 'published', deletedAt: null },
      {
        populate: ['logoMedia'],
        orderBy: { isFeatured: 'DESC', sortOrder: 'DESC', id: 'DESC' },
        limit: 12,
        offset: 0,
      },
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

  it('非空关键词没有匹配友链时返回零总数和空列表', async () => {
    const { service } = fixture()

    await expect(service.list({ q: '不存在的友链', page: 1, pageSize: 6 })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 6,
    })
  })

  it('读取失败原样抛出，不能伪造空搜索结果', async () => {
    const { em, service } = fixture()
    const failure = new Error('友链查询失败')
    em.findAndCount.mockRejectedValue(failure)

    await expect(service.list({ q: '山间', page: 1, pageSize: 12 })).rejects.toBe(failure)
  })
})
