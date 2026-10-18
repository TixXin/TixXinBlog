/** @file project.service.spec.ts @description 项目公开筛选、管理保存、媒体校验与提交幂等的纯单元回归 */
import 'reflect-metadata'
import { LockMode, RawQueryFragment } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { MediaAsset } from '../../entities/media-asset.entity'
import { Project } from '../../entities/project.entity'
import { lockMedia, synchronizeMediaReferences } from '../media/media-references'
import { AdminProjectQuery, ProjectQuery } from './project.dto'
import type { SaveProjectDto } from './project.dto'
import { ProjectService } from './project.service'

jest.mock('../media/media-references', () => ({
  ...jest.requireActual<typeof import('../media/media-references')>('../media/media-references'),
  lockMedia: jest.fn().mockResolvedValue(undefined),
  synchronizeMediaReferences: jest.fn().mockResolvedValue(undefined),
}))

const requestId = '12345678-1234-4123-a123-123456789abc'
const mediaId = '22345678-1234-4123-a123-123456789abc'
const publishedAt = new Date('2026-09-01T00:00:00.000Z')

function fixture() {
  const media: MediaAsset = Object.assign(new MediaAsset(), {
    id: mediaId,
    mimeType: 'image/webp',
    width: 1600,
    height: 900,
    storageKey: 'private/cover.webp',
    sha256: 'private-media-hash',
  })
  const item: Project = Object.assign(new Project(), {
    id: 7,
    title: '星图工具箱',
    description: '整理观测计划与天文影像',
    coverMedia: media,
    tags: [{ label: 'TypeScript', color: 'blue' }],
    links: [{ kind: 'source', href: 'https://example.com/star-map' }],
    progress: 'active',
    status: 'published',
    sortOrder: 9,
    revision: 2,
    publishedAt,
    requestId: '32345678-1234-4123-a123-123456789abc',
    requestHash: 'private-submission-hash',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  })
  const records = [item]
  const em = {
    findAndCount: jest.fn().mockResolvedValue([[item], 25]),
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === MediaAsset) return media.id === where.id && !media.deletedAt ? media : null
      return (
        records.find((record) =>
          where.requestId === undefined
            ? record.id === where.id && !record.deletedAt
            : record.requestId === where.requestId,
        ) ?? null
      )
    }),
    create: jest.fn((_entity: unknown, fields: Partial<Project>) => {
      const created = Object.assign(new Project(), { id: 8 }, fields)
      records.push(created)
      return created
    }),
    flush: jest.fn().mockResolvedValue(undefined),
    transactional: jest.fn(),
  }
  em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
  return { item, media, records, em, service: new ProjectService(em as unknown as EntityManager) }
}

beforeEach(() => jest.clearAllMocks())

describe('项目公开列表与投影', () => {
  it('默认只查公开且未删除的项目，使用稳定排序和默认分页', async () => {
    const { service, em } = fixture()
    const result = await service.list(new ProjectQuery())
    expect(em.findAndCount).toHaveBeenCalledWith(
      Project,
      { status: 'published', deletedAt: null },
      { populate: ['coverMedia'], orderBy: { sortOrder: 'DESC', id: 'DESC' }, limit: 12, offset: 0 },
    )
    expect(result).toMatchObject({ total: 25, page: 1, pageSize: 12 })
    expect(result.items).toHaveLength(1)
  })

  it('进展、大小写无关标签与搜索可以组合，并使用页码计算偏移', async () => {
    const { service, em } = fixture()
    const tag = "TypeScript' OR 1=1 --"
    await service.list(
      Object.assign(new ProjectQuery(), { progress: 'archived', tag, q: '100%_\\路径', page: 3, pageSize: 5 }),
    )
    const where = em.findAndCount.mock.calls[0]?.[1] as {
      $and: Record<string, unknown>[]
      [key: string]: unknown
    }
    expect(where).toEqual({
      status: 'published',
      deletedAt: null,
      progress: 'archived',
      $and: [expect.any(Object)],
      $or: [{ title: { $ilike: '%100\\%\\_\\\\路径%' } }, { description: { $ilike: '%100\\%\\_\\\\路径%' } }],
    })
    const rawKey = Object.keys(where.$and[0]!)[0]!
    const fragment = RawQueryFragment.getKnownFragment(rawKey)
    expect(where.$and[0]![rawKey]).toBe(true)
    expect(fragment?.sql).toContain("lower(tag->>'label')=?")
    expect(fragment?.sql).not.toContain(tag)
    expect(fragment?.params).toEqual([tag.toLowerCase()])
    expect(em.findAndCount.mock.calls[0]?.[2]).toEqual({
      populate: ['coverMedia'],
      orderBy: { sortOrder: 'DESC', id: 'DESC' },
      limit: 5,
      offset: 10,
    })
  })

  it('公开入口忽略管理状态参数，空搜索不增加过滤条件', async () => {
    const { service, em } = fixture()
    await service.list(Object.assign(new AdminProjectQuery(), { status: 'draft', q: '', tag: '' }))
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual({ status: 'published', deletedAt: null })
  })

  it.each([
    [undefined, { deletedAt: null }],
    ['all', { deletedAt: null }],
    ['draft', { deletedAt: null, status: 'draft' }],
    ['withdrawn', { deletedAt: null, status: 'withdrawn' }],
  ] as const)('管理列表状态 %s 仍排除已删除项目', async (status, expected) => {
    const { service, em } = fixture()
    await service.list(Object.assign(new AdminProjectQuery(), { status }), true)
    expect(em.findAndCount.mock.calls[0]?.[1]).toEqual(expected)
  })

  it('越界空页保留真实总数和请求页码', async () => {
    const { service, em } = fixture()
    em.findAndCount.mockResolvedValueOnce([[], 25])
    await expect(service.list(Object.assign(new ProjectQuery(), { page: 10 }))).resolves.toEqual({
      items: [],
      total: 25,
      page: 10,
      pageSize: 12,
    })
  })

  it('公开投影仅返回展示字段，媒体存储键和管理提交信息均不泄露', () => {
    const { service, item } = fixture()
    expect(service.serialize(item)).toEqual({
      id: 7,
      title: '星图工具箱',
      description: '整理观测计划与天文影像',
      cover: `/api/v1/media/${mediaId}.webp`,
      width: 1600,
      height: 900,
      progress: 'active',
      tags: [{ label: 'TypeScript', color: 'blue' }],
      links: [{ kind: 'source', href: 'https://example.com/star-map', label: '源代码', icon: 'lucide:github' }],
      publishedAt: publishedAt.toISOString(),
    })
    expect(service.serialize(item, true)).toMatchObject({
      coverMediaId: mediaId,
      relatedContent: [],
      status: 'published',
      sortOrder: 9,
      revision: 2,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })
    expect(service.serialize(item, true)).not.toHaveProperty('requestHash')
  })

  it('无封面或发布时间时返回明确空值，四种外链用途映射正式文案和图标', () => {
    const { service, item } = fixture()
    item.coverMedia = null
    item.publishedAt = null
    item.links = [
      { kind: 'source', href: 'https://example.com/source' },
      { kind: 'demo', href: 'https://example.com/demo' },
      { kind: 'docs', href: 'https://example.com/docs' },
      { kind: 'download', href: 'https://example.com/download' },
    ]
    expect(service.serialize(item)).toMatchObject({
      cover: null,
      width: null,
      height: null,
      publishedAt: null,
      links: [
        { kind: 'source', label: '源代码', icon: 'lucide:github' },
        { kind: 'demo', label: '在线预览', icon: 'lucide:external-link' },
        { kind: 'docs', label: '文档', icon: 'lucide:book-open' },
        { kind: 'download', label: '下载', icon: 'lucide:download' },
      ],
    })
  })

  it('公开详情和管理详情使用各自的可见性条件', async () => {
    const { service, em } = fixture()
    await service.detail(7)
    expect(em.findOne).toHaveBeenLastCalledWith(
      Project,
      { id: 7, status: 'published', deletedAt: null },
      { populate: ['coverMedia'] },
    )
    await service.detail(7, true)
    expect(em.findOne).toHaveBeenLastCalledWith(Project, { id: 7, deletedAt: null }, { populate: ['coverMedia'] })
    em.findOne.mockResolvedValueOnce(null)
    await expect(service.detail(7)).rejects.toMatchObject({ status: 404 })
  })
})

describe('项目管理保存校验', () => {
  it.each<[string, number | null, SaveProjectDto]>([
    ['创建缺少标题', null, { requestId }],
    ['创建缺少提交标识', null, { title: '星图' }],
    ['创建不能携带版本', null, { title: '星图', requestId, revision: 0 }],
    ['编辑缺少版本', 7, { title: '星图' }],
    ['编辑不能携带创建标识', 7, { revision: 2, requestId }],
    ['编号非法', 0, { revision: 2 }],
    ['编号超出数据库范围', 2147483648, { revision: 2 }],
    ['空白标签', 7, { revision: 2, tags: [{ label: '  ', color: 'blue' }] }],
    ['危险链接', 7, { revision: 2, links: [{ kind: 'source', href: 'javascript:alert(1)' }] }],
    [
      '重复链接用途',
      7,
      {
        revision: 2,
        links: [
          { kind: 'source', href: 'https://example.com/a' },
          { kind: 'source', href: 'https://example.com/b' },
        ],
      },
    ],
  ])('%s 在打开事务和写入前拒绝', async (_name, id, input) => {
    const { service, em } = fixture()
    await expect(service.save(id, input)).rejects.toMatchObject({ status: 400 })
    expect(em.transactional).not.toHaveBeenCalled()
    expect(em.findOne).not.toHaveBeenCalled()
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it.each<[string, Partial<MediaAsset> | null]>([
    ['不存在', null],
    ['已删除', { deletedAt: new Date('2026-10-01T00:00:00.000Z') }],
    ['不是图片', { mimeType: 'application/pdf' }],
    ['缺少宽度', { width: 0 }],
    ['缺少高度', { height: 0 }],
    ['负尺寸', { width: -1, height: -1 }],
  ])('拒绝%s的媒体封面，保留原项目字段与版本', async (_name, changes) => {
    const { service, item, media, em } = fixture()
    if (changes) Object.assign(media, changes)
    else media.id = '42345678-1234-4123-a123-123456789abc'
    await expect(service.save(7, { revision: 2, title: '不应保存', coverMediaId: mediaId })).rejects.toMatchObject({
      status: 400,
    })
    expect(em.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(item.title).toBe('星图工具箱')
    expect(item.revision).toBe(2)
    expect(em.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
  })

  it('过期版本在修改字段、媒体引用和版本前拒绝', async () => {
    const { service, item, em } = fixture()
    await expect(service.save(7, { revision: 1, title: '不应保存', coverMediaId: null })).rejects.toMatchObject({
      status: 409,
    })
    expect(em.findOne).toHaveBeenCalledWith(
      Project,
      { id: 7, deletedAt: null },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
    expect(item.title).toBe('星图工具箱')
    expect(item.coverMedia?.id).toBe(mediaId)
    expect(item.revision).toBe(2)
    expect(em.flush).not.toHaveBeenCalled()
    expect(synchronizeMediaReferences).not.toHaveBeenCalled()
  })

  it('编辑不存在的项目返回 404，不创建替代记录', async () => {
    const { service, em } = fixture()
    await expect(service.save(99, { revision: 0, title: '不应创建' })).rejects.toMatchObject({ status: 404 })
    expect(em.create).not.toHaveBeenCalled()
    expect(em.flush).not.toHaveBeenCalled()
  })

  it('只修改标题保留省略字段，提交时继续同步既有封面引用', async () => {
    const { service, item, media, em } = fixture()
    const result = await service.save(7, { revision: 2, title: '星图工具箱新版' })
    expect(item).toMatchObject({
      title: '星图工具箱新版',
      description: '整理观测计划与天文影像',
      coverMedia: media,
      tags: [{ label: 'TypeScript', color: 'blue' }],
      links: [{ kind: 'source', href: 'https://example.com/star-map' }],
      progress: 'active',
      status: 'published',
      sortOrder: 9,
      revision: 3,
      publishedAt,
    })
    expect(result).toMatchObject({ id: 7, title: '星图工具箱新版', revision: 3 })
    expect(lockMedia).toHaveBeenCalledWith(em)
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(
      em,
      'project:7',
      'project',
      [`/api/v1/media/${mediaId}.webp`],
      {
        project: item,
      },
    )
    expect(em.flush).toHaveBeenCalledTimes(2)
  })

  it('显式空值与空数组清除封面、标签和链接，零排序值保留', async () => {
    const { service, item, em } = fixture()
    await service.save(7, {
      revision: 2,
      coverMediaId: null,
      description: '',
      tags: [],
      links: [],
      relatedContent: [],
      sortOrder: 0,
    })
    expect(item).toMatchObject({
      coverMedia: null,
      description: '',
      tags: [],
      links: [],
      relatedContent: [],
      sortOrder: 0,
    })
    expect(em.findOne.mock.calls.some(([entity]) => entity === MediaAsset)).toBe(false)
    expect(synchronizeMediaReferences).toHaveBeenCalledWith(em, 'project:7', 'project', [], { project: item })
  })

  it('创建验证真实媒体并规范化标签和外链，保留默认草稿与开发中状态', async () => {
    const { service, em } = fixture()
    const result = await service.save(null, {
      title: '观测日志',
      requestId,
      coverMediaId: mediaId,
      tags: [
        { label: ' TypeScript ', color: 'blue' },
        { label: 'typescript', color: 'rose' },
      ],
      links: [{ kind: 'demo', href: 'HTTPS://EXAMPLE.COM:443/Observatory' }],
    })
    expect(result).toMatchObject({
      id: 8,
      coverMediaId: mediaId,
      status: 'draft',
      progress: 'dev',
      revision: 0,
      publishedAt: null,
      tags: [{ label: 'TypeScript', color: 'blue' }],
      links: [{ kind: 'demo', href: 'https://example.com/Observatory' }],
    })
    expect(em.findOne).toHaveBeenCalledWith(MediaAsset, { id: mediaId, deletedAt: null })
    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
  })

  it('已归档项目可以首次发布，随后撤回不改进展和首次发布时间', async () => {
    const { service, item } = fixture()
    item.status = 'draft'
    item.progress = 'archived'
    item.publishedAt = null
    const before = Date.now()
    await service.save(7, { revision: 2, status: 'published' })
    const firstPublishedAt = item.publishedAt as Date | null
    expect(item.progress).toBe('archived')
    expect(firstPublishedAt).toBeInstanceOf(Date)
    expect(firstPublishedAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(firstPublishedAt!.getTime()).toBeLessThanOrEqual(Date.now())
    await service.save(7, { revision: 3, status: 'withdrawn' })
    expect(item.progress).toBe('archived')
    expect(item.publishedAt).toBe(firstPublishedAt)
    await service.save(7, { revision: 4, status: 'published' })
    expect(item.publishedAt).toBe(firstPublishedAt)
  })

  it('调整项目进展不会隐式发布草稿或生成发布时间', async () => {
    const { service, item } = fixture()
    item.status = 'draft'
    item.publishedAt = null
    await service.save(7, { revision: 2, progress: 'active' })
    expect(item.status).toBe('draft')
    expect(item.publishedAt).toBeNull()
  })
})

describe('项目创建提交幂等', () => {
  it('相同提交重试沿用原项目，空关联与省略关联等价且不重复写入', async () => {
    const { service, em } = fixture()
    const input = { requestId, title: '观测日志' }
    const first = await service.save(null, input)
    const retried = await service.save(null, { ...input, relatedContent: [] })
    expect(retried).toEqual(first)
    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(synchronizeMediaReferences).toHaveBeenCalledTimes(1)
  })

  it('同一提交标识携带不同内容返回冲突，不覆盖原项目', async () => {
    const { service, em, records } = fixture()
    await service.save(null, { requestId, title: '观测日志' })
    await expect(service.save(null, { requestId, title: '变更内容' })).rejects.toMatchObject({ status: 409 })
    expect(records[1]?.title).toBe('观测日志')
    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
    expect(synchronizeMediaReferences).toHaveBeenCalledTimes(1)
  })

  it('已删除提交不复活，提交查询返回删除状态', async () => {
    const { service, records, em } = fixture()
    const input = { requestId, title: '观测日志' }
    const first = await service.save(null, input)
    records[1]!.deletedAt = new Date('2026-10-01T00:00:00.000Z')
    await expect(service.save(null, input)).rejects.toMatchObject({ status: 409 })
    await expect(service.submission(requestId)).resolves.toEqual({ state: 'deleted', id: first.id })
    expect(em.create).toHaveBeenCalledTimes(1)
    expect(em.flush).toHaveBeenCalledTimes(2)
  })

  it('提交查询返回已保存的管理投影，未知提交返回 404', async () => {
    const { service } = fixture()
    const saved = await service.save(null, { requestId, title: '观测日志' })
    await expect(service.submission(requestId)).resolves.toEqual({ state: 'saved', item: saved })
    await expect(service.submission('42345678-1234-4123-a123-123456789abc')).rejects.toMatchObject({ status: 404 })
  })
})
