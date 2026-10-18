/** @file project-search.spec.ts @description 项目搜索的字面匹配、公开过滤、稳定分页与响应边界 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Project } from '../../entities/project.entity'
import { ProjectQuery } from './project.dto'
import { ProjectService } from './project.service'

function fixture() {
  const em = { findAndCount: jest.fn().mockResolvedValue([[], 0]) }
  const service = new ProjectService(em as unknown as EntityManager)
  return { em, service }
}

describe('项目公开搜索', () => {
  it.each([
    ['%', '%\\%%'],
    ['_', '%\\_%'],
    ['\\', '%\\\\%'],
    [String.raw`C:\100%_资料`, String.raw`%C:\\100\%\_资料%`],
    ['随笔', '%随笔%'],
  ])('关键词 %s 在标题和描述中使用相同的字面 LIKE 模式', async (q, pattern) => {
    const { em, service } = fixture()

    await service.list({ q, page: 2, pageSize: 3 })

    expect(em.findAndCount).toHaveBeenCalledTimes(1)
    expect(em.findAndCount).toHaveBeenCalledWith(
      Project,
      {
        status: 'published',
        deletedAt: null,
        $or: [{ title: { $ilike: pattern } }, { description: { $ilike: pattern } }],
      },
      { populate: ['coverMedia'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 3, offset: 3 },
    )
  })

  it('搜索与项目进展取交集，公开调用不能用管理状态覆盖可见性', async () => {
    const { em, service } = fixture()

    await service.list({ q: '笔记', progress: 'archived', status: 'draft', page: 1, pageSize: 12 })

    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({
      status: 'published',
      deletedAt: null,
      progress: 'archived',
      $or: [{ title: { $ilike: '%笔记%' } }, { description: { $ilike: '%笔记%' } }],
    })
  })

  it('代表结果保留公开展示字段并排除管理状态、版本和提交凭据', async () => {
    const { em, service } = fixture()
    const item = Object.assign(new Project(), {
      id: 7,
      title: '山间笔记',
      description: '记录徒步路线的小工具',
      progress: 'active' as const,
      status: 'published' as const,
      tags: [{ label: 'Vue', color: 'emerald' as const }],
      links: [{ kind: 'source' as const, href: 'https://example.com/source' }],
      publishedAt: new Date('2026-06-01T08:00:00Z'),
      revision: 3,
      requestId: 'private-request',
      requestHash: 'private-hash',
    })
    em.findAndCount.mockResolvedValue([[item], 9])

    await expect(service.list({ q: '山间', page: 2, pageSize: 1 })).resolves.toEqual({
      items: [
        {
          id: 7,
          title: '山间笔记',
          description: '记录徒步路线的小工具',
          cover: null,
          width: null,
          height: null,
          progress: 'active',
          tags: [{ label: 'Vue', color: 'emerald' }],
          links: [{ kind: 'source', href: 'https://example.com/source', label: '源代码', icon: 'lucide:github' }],
          publishedAt: '2026-06-01T08:00:00.000Z',
        },
      ],
      total: 9,
      page: 2,
      pageSize: 1,
    })
  })

  it('空搜索使用默认首屏分页，未命中时返回真实零总数', async () => {
    const { em, service } = fixture()
    const query = Object.assign(new ProjectQuery(), { q: '' })

    await expect(service.list(query)).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 12 })
    expect(em.findAndCount).toHaveBeenCalledWith(
      Project,
      { status: 'published', deletedAt: null },
      { populate: ['coverMedia'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 12, offset: 0 },
    )
  })

  it('越界页保留筛选后的真实总数和请求页码', async () => {
    const { em, service } = fixture()
    em.findAndCount.mockResolvedValue([[], 13])

    await expect(service.list({ q: '笔记', page: 4, pageSize: 6 })).resolves.toEqual({
      items: [],
      total: 13,
      page: 4,
      pageSize: 6,
    })
    expect(em.findAndCount.mock.calls[0]?.[2]).toMatchObject({ limit: 6, offset: 18 })
  })

  it('非空关键词没有匹配项目时返回零总数和空列表', async () => {
    const { service } = fixture()

    await expect(service.list({ q: '不存在的项目', page: 1, pageSize: 6 })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 6,
    })
  })

  it('读取失败原样抛出，不能伪造空搜索结果', async () => {
    const { em, service } = fixture()
    const failure = new Error('项目查询失败')
    em.findAndCount.mockRejectedValue(failure)

    await expect(service.list({ q: '笔记', page: 1, pageSize: 12 })).rejects.toBe(failure)
  })
})
