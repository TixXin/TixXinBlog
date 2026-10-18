/** @file post-navigation.spec.ts @description 文章上下篇的专栏隔离、公开过滤、边界与稳定排序 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Post } from '../../entities/post.entity'
import { PostDiscoveryService } from './post-discovery.service'

const publishedAt = new Date('2026-10-01T10:00:00Z')
const current = { id: 7, folder: '工程笔记', publishedAt }
const prev = { id: 8, slug: 'previous', title: '缓存设计', publishedAt, folder: '工程笔记' }
const next = { id: 6, slug: undefined, title: '请求隔离', publishedAt, folder: '工程笔记' }
const fields = ['id', 'slug', 'title', 'publishedAt', 'folder']

function setup() {
  const findOne = jest.fn()
  return { findOne, service: new PostDiscoveryService({ findOne } as unknown as EntityManager) }
}

describe('文章上下篇导航', () => {
  it.each([undefined, 'all'] as const)('范围 %s 保留全站查询与既有响应字段', async (scope) => {
    const { service, findOne } = setup()
    findOne
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...prev, folder: '生活记录' })
      .mockResolvedValueOnce(next)
    expect(await service.navigation(7, scope)).toEqual({
      prev: {
        id: '8',
        slug: 'previous',
        title: '缓存设计',
        date: '2026-10-01T10:00:00.000Z',
        category: '生活记录',
      },
      next: {
        id: '6',
        slug: undefined,
        title: '请求隔离',
        date: '2026-10-01T10:00:00.000Z',
        category: '工程笔记',
      },
    })
    expect(findOne).toHaveBeenCalledTimes(3)
    expect(findOne).toHaveBeenNthCalledWith(
      1,
      Post,
      { id: 7, status: 'published', deletedAt: null },
      { fields: ['id', 'publishedAt', 'folder'] },
    )
    for (const [, where] of findOne.mock.calls.slice(1)) {
      expect(where).toMatchObject({ status: 'published', deletedAt: null })
      expect(where).not.toHaveProperty('folder')
    }
  })

  it('同专栏查询保持公开过滤，并按发布时间及同时间编号找到最近上下篇', async () => {
    const { service, findOne } = setup()
    findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(prev).mockResolvedValueOnce(next)
    expect(await service.navigation(7, 'folder')).toMatchObject({ prev: { id: '8' }, next: { id: '6' } })
    expect(findOne).toHaveBeenNthCalledWith(
      2,
      Post,
      {
        status: 'published',
        deletedAt: null,
        folder: '工程笔记',
        $or: [{ publishedAt: { $gt: publishedAt } }, { publishedAt, id: { $gt: 7 } }],
      },
      { fields, orderBy: { publishedAt: 'asc', id: 'asc' } },
    )
    expect(findOne).toHaveBeenNthCalledWith(
      3,
      Post,
      {
        status: 'published',
        deletedAt: null,
        folder: '工程笔记',
        $or: [{ publishedAt: { $lt: publishedAt } }, { publishedAt, id: { $lt: 7 } }],
      },
      { fields, orderBy: { publishedAt: 'desc', id: 'desc' } },
    )
  })

  it.each([
    { previous: null, following: next },
    { previous: prev, following: null },
    { previous: null, following: null },
  ])('专栏边界保留空侧，不另查全站：%j', async ({ previous, following }) => {
    const { service, findOne } = setup()
    findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(previous).mockResolvedValueOnce(following)
    const result = await service.navigation(7, 'folder')
    expect(result.prev?.id ?? null).toBe(previous ? String(previous.id) : null)
    expect(result.next?.id ?? null).toBe(following ? String(following.id) : null)
    expect(findOne).toHaveBeenCalledTimes(3)
    for (const [, where] of findOne.mock.calls.slice(1)) expect(where.folder).toBe('工程笔记')
  })

  it.each(['', '  ', undefined])('当前文章无专栏时双空且不读取候选：%j', async (folder) => {
    const { service, findOne } = setup()
    findOne.mockResolvedValueOnce({ ...current, folder })
    expect(await service.navigation(7, 'folder')).toEqual({ prev: null, next: null })
    expect(findOne).toHaveBeenCalledTimes(1)
  })

  it.each(['all', 'folder'] as const)('当前文章不存在或不可公开时，范围 %s 统一返回 404', async (scope) => {
    const { service, findOne } = setup()
    findOne.mockResolvedValueOnce(null)
    await expect(service.navigation(7, scope)).rejects.toMatchObject({ status: 404 })
    expect(findOne).toHaveBeenCalledTimes(1)
    expect(findOne).toHaveBeenCalledWith(
      Post,
      { id: 7, status: 'published', deletedAt: null },
      { fields: ['id', 'publishedAt', 'folder'] },
    )
  })

  it('候选读取失败保留错误，不伪造无同专栏结果', async () => {
    const { service, findOne } = setup()
    const error = new Error('读取失败')
    findOne.mockResolvedValueOnce(current).mockRejectedValueOnce(error).mockResolvedValueOnce(next)
    await expect(service.navigation(7, 'folder')).rejects.toBe(error)
    expect(findOne).toHaveBeenCalledTimes(3)
  })
})
