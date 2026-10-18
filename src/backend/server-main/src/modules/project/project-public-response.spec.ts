/** @file project-public-response.spec.ts @description 项目公开列表、详情与标签统计的完整字段白名单回归 */
import 'reflect-metadata'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Project } from '../../entities/project.entity'
import { MediaAsset } from '../../entities/media-asset.entity'
import { ProjectQuery } from './project.dto'
import { ProjectService } from './project.service'

const publishedAt = new Date('2026-10-01T08:00:00.000Z')
const mediaId = '11111111-1111-4111-8111-111111111111'
const publicProject = {
  id: 1,
  title: '个人博客',
  description: '记录生活与开发',
  cover: `/api/v1/media/${mediaId}.webp`,
  width: 1600,
  height: 1000,
  progress: 'active',
  tags: [{ label: 'TypeScript', color: 'blue' }],
  links: [
    { kind: 'source', href: 'https://example.com/source', label: '源代码', icon: 'lucide:github' },
    { kind: 'demo', href: 'https://example.com/demo', label: '在线预览', icon: 'lucide:external-link' },
    { kind: 'docs', href: 'https://example.com/docs', label: '文档', icon: 'lucide:book-open' },
    { kind: 'download', href: 'https://example.com/download', label: '下载', icon: 'lucide:download' },
  ],
  publishedAt: publishedAt.toISOString(),
}

function fixture() {
  const coverMedia = Object.assign(new MediaAsset(), {
    id: mediaId,
    width: 1600,
    height: 1000,
    mimeType: 'image/webp',
    originalName: 'private-cover.jpg',
    storageKey: 'private/storage/key',
    sha256: 'private-media-sha256',
    byteSize: 98765,
    createdAt: publishedAt,
  })
  const project: Project = Object.assign(new Project(), {
    id: 1,
    title: '个人博客',
    description: '记录生活与开发',
    coverMedia,
    progress: 'active',
    tags: [{ label: 'TypeScript', color: 'blue' }],
    links: ['source', 'demo', 'docs', 'download'].map((kind) => ({ kind, href: `https://example.com/${kind}` })),
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
    findAndCount: jest.fn().mockResolvedValue([[project], 1]),
    findOne: jest.fn().mockResolvedValue(project),
    execute: jest.fn(),
  }
  return { project, em, service: new ProjectService(em as unknown as EntityManager) }
}

describe('项目公开 GET 字段白名单', () => {
  it('列表保留进展、技术标签和四类链接，不暴露发布状态、版本或媒体存储信息', async () => {
    const { em, service } = fixture()
    const result = await service.list(Object.assign(new ProjectQuery(), { status: 'draft' }))
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      items: [publicProject],
      total: 1,
      page: 1,
      pageSize: 12,
    })
    expect(em.findAndCount).toHaveBeenCalledWith(
      Project,
      { status: 'published', deletedAt: null },
      expect.objectContaining({ populate: ['coverMedia'] }),
    )
  })

  it('详情仅增加公开关联卡片，关联目标的版本、可用性和发布状态不透传', async () => {
    const { project, em, service } = fixture()
    project.relatedContent = [1, 2, 3, 4, 5].map((id) => ({ type: 'gallery', id }))
    em.execute.mockResolvedValue([
      { type: 'gallery', id: 1, title: '公开作品', status: 'published', deleted_at: null, revision: 99 },
      { type: 'gallery', id: 2, title: '私有草稿', status: 'draft', deleted_at: null },
      { type: 'gallery', id: 3, title: '撤回内容', status: 'withdrawn', deleted_at: null },
      { type: 'gallery', id: 4, title: '回收内容', status: 'published', deleted_at: publishedAt },
    ])
    expect(JSON.parse(JSON.stringify(await service.detail(1)))).toStrictEqual({
      ...publicProject,
      relatedContent: [{ type: 'gallery', id: 1, title: '公开作品', url: '/gallery?photo=1' }],
    })
    expect(em.findOne).toHaveBeenCalledWith(
      Project,
      { id: 1, status: 'published', deletedAt: null },
      { populate: ['coverMedia'] },
    )
  })

  it('缺省封面和空集合保留明确公开契约', () => {
    const { project, service } = fixture()
    project.coverMedia = null
    project.tags = []
    project.links = []
    project.publishedAt = null
    expect(JSON.parse(JSON.stringify(service.serialize(project)))).toStrictEqual({
      ...publicProject,
      cover: null,
      width: null,
      height: null,
      tags: [],
      links: [],
      publishedAt: null,
    })
  })

  it('不存在或不可公开的详情不会回退到管理读取', async () => {
    const { em, service } = fixture()
    em.findOne.mockResolvedValue(null)
    await expect(service.detail(2)).rejects.toThrow('项目不存在或尚未公开')
    expect(em.findOne).toHaveBeenCalledTimes(1)
    expect(em.findOne).toHaveBeenCalledWith(
      Project,
      { id: 2, status: 'published', deletedAt: null },
      { populate: ['coverMedia'] },
    )
    expect(em.execute).not.toHaveBeenCalled()
  })

  it('标签覆盖率和统计只来自公开未删除项目，聚合白名单保留真实计数', async () => {
    const { em, service } = fixture()
    em.execute.mockResolvedValue([
      {
        stats: { projects: 3, active: 1, dev: 1, archived: 1, tags: 1 },
        tags: [{ label: 'TypeScript', color: 'blue', count: 2, percent: 67 }],
      },
    ])
    expect(JSON.parse(JSON.stringify(await service.metadata()))).toStrictEqual({
      stats: { projects: 3, active: 1, dev: 1, archived: 1, tags: 1 },
      tags: [{ label: 'TypeScript', color: 'blue', count: 2, percent: 67 }],
    })
    expect(em.execute).toHaveBeenCalledTimes(1)
    const sql = em.execute.mock.calls[0]?.[0] as string
    expect(sql).toContain("from project where status='published' and deleted_at is null")
    expect(sql).toContain(
      "jsonb_build_object('projects',c.projects,'active',c.active,'dev',c.dev,'archived',c.archived,'tags'",
    )
    expect(sql).toContain("jsonb_build_object('label',t.label,'color',t.color,'count',t.count,'percent'")
    expect(sql).not.toMatch(/row_to_json|to_jsonb|revision|request_hash|storage_key/i)
  })
})
