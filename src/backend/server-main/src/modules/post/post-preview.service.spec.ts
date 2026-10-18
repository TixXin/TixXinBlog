/** @file post-preview.service.spec.ts @description 草稿预览的签名、有效期、内容代次与只读可见性回归，全部使用内存替身。 */
import { createHmac } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ConfigService } from '@nestjs/config'
import { ContentContext } from '../../entities/content-context.entity'
import { Post } from '../../entities/post.entity'
import { PostRevision } from '../../entities/post-revision.entity'
import { PostPreviewService } from './post-preview.service'
import { PostService } from './post.service'

const secret = 'preview-test-secret-with-at-least-32-characters'
const generation = '24930d9a-932f-45a2-9d0e-640b914f592a'
const now = new Date('2026-10-18T08:00:00Z')

function setup() {
  const post = {
    id: 7,
    status: 'draft',
    deletedAt: null as Date | null,
    title: '尚未发布的随笔',
    revision: 3,
    summary: '',
    folder: '随笔',
    readTimeMinutes: 4,
    views: 5,
    likes: 1,
    commentCount: 2,
    contentRaw: '## 开始\n\n最新草稿正文。',
    contentSections: [
      { type: 'heading', id: 'start', text: '开始', level: 2 },
      { type: 'paragraph', text: '最新草稿正文。' },
    ],
    tags: { getItems: () => [{ label: '生活', color: 'sky' }] },
    relatedContent: [],
    publishedAt: now,
  }
  const context = { id: 'default', generation }
  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity === Post) return where.id === post.id && where.status === post.status && !post.deletedAt ? post : null
      if (entity === PostRevision) return { createdAt: now }
      return null
    }),
    findOneOrFail: jest.fn(async (entity: unknown) => {
      if (entity === ContentContext) return context
      throw new Error('不应读取其他实体')
    }),
    flush: jest.fn(),
    transactional: jest.fn(),
  }
  const manager = em as unknown as EntityManager
  const posts = new PostService(manager)
  const config = new ConfigService({ JWT_ACCESS_SECRET: secret })
  return { post, context, em, posts, service: new PostPreviewService(manager, config, posts) }
}

function signed(payload: unknown, derived = true) {
  const key = derived ? createHmac('sha256', secret).update('tixxinblog:post-preview:v1').digest() : secret
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', key).update(encoded).digest('base64url')}`
}

describe('草稿预览签名与读取', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(now))
  afterEach(() => jest.useRealTimers())

  it('签发固定七天链接，复用详情投影且禁止索引与评论，不写入或计数', async () => {
    const { service, em } = setup()
    const link = await service.issue(7)
    expect(link.expiresAt).toBe('2026-10-25T08:00:00.000Z')
    expect(link.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/)
    const detail = await service.read(link.token)
    expect(detail).toMatchObject({
      id: '7',
      title: '尚未发布的随笔',
      contentRaw: '## 开始\n\n最新草稿正文。',
      toc: [{ id: 'start', text: '开始', level: 2 }],
      tags: [{ label: '生活', color: 'sky' }],
      seoNoindex: true,
      commentEnabled: false,
      views: 5,
    })
    expect(detail).not.toHaveProperty('revision')
    expect(detail).not.toHaveProperty('content')
    expect(em.findOne).toHaveBeenCalledWith(Post, { id: 7, status: 'draft', deletedAt: null }, expect.any(Object))
    expect(em.flush).not.toHaveBeenCalled()
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it('修改并保存正文后旧链接仍读取最新内容，到期边界立即失效', async () => {
    const { service, post } = setup()
    const link = await service.issue(7)
    post.revision++
    post.title = '修改后的标题'
    post.contentRaw = '保存后的最新内容'
    jest.setSystemTime(new Date('2026-10-25T07:59:59Z'))
    expect(await service.read(link.token)).toMatchObject({ title: '修改后的标题', contentRaw: '保存后的最新内容' })
    jest.setSystemTime(new Date(link.expiresAt))
    await expect(service.read(link.token)).rejects.toMatchObject({ status: 404, message: '预览链接无效或已过期' })
  })

  it('完整恢复或重建轮换内容代次后，在读取文章前拒绝旧链接', async () => {
    const { service, context, em } = setup()
    const { token } = await service.issue(7)
    context.generation = '6bdc97e4-854c-4a17-b2ce-ce179fbd2a07'
    em.findOne.mockClear()
    await expect(service.read(token)).rejects.toMatchObject({ status: 404 })
    expect(em.findOne).not.toHaveBeenCalled()
  })

  it.each(['published', 'archived', 'deleted'])('文章成为 %s 后旧链接失效且不能再签发', async (state) => {
    const { service, post } = setup()
    const { token } = await service.issue(7)
    if (state === 'deleted') post.deletedAt = now
    else post.status = state
    await expect(service.read(token)).rejects.toMatchObject({ status: 404 })
    await expect(service.issue(7)).rejects.toMatchObject({ status: 404 })
  })

  it('普通公开详情、浏览和点赞接口继续排除草稿', async () => {
    const { posts, em } = setup()
    em.transactional.mockImplementation((run: (manager: unknown) => unknown) => run(em))
    await expect(posts.findDetail(7)).rejects.toMatchObject({ code: 1001 })
    await expect(posts.addView(7, 'visitor')).rejects.toMatchObject({ code: 1001 })
    await expect(posts.toggleLike(7, 'visitor')).rejects.toMatchObject({ code: 1001 })
    expect(em.flush).not.toHaveBeenCalled()
  })

  it.each([undefined, null, '', [], {}, 'a.b', 'a'.repeat(1025)])(
    '缺失或非法格式在任何数据库读取前拒绝 %#',
    async (token) => {
      const { service, em } = setup()
      await expect(service.read(token)).rejects.toMatchObject({ status: 404 })
      expect(em.findOneOrFail).not.toHaveBeenCalled()
      expect(em.findOne).not.toHaveBeenCalled()
    },
  )

  it('篡改文章编号、签名、根密钥直签和轮换部署密钥均无效', async () => {
    const { service, em, posts } = setup()
    const { token } = await service.issue(7)
    const [encoded, signature] = token.split('.') as [string, string]
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Record<string, unknown>
    const altered = Buffer.from(JSON.stringify({ ...payload, postId: 8 })).toString('base64url')
    for (const invalid of [
      `${altered}.${signature}`,
      `${encoded}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`,
      signed(payload, false),
    ]) {
      em.findOneOrFail.mockClear()
      await expect(service.read(invalid)).rejects.toMatchObject({ status: 404 })
      expect(em.findOneOrFail).not.toHaveBeenCalled()
    }
    const rotated = new PostPreviewService(
      em as unknown as EntityManager,
      new ConfigService({ JWT_ACCESS_SECRET: `${secret}-rotated` }),
      posts,
    )
    await expect(rotated.read(token)).rejects.toMatchObject({ status: 404 })
  })

  it.each([
    null,
    [],
    { v: 2 },
    { postId: 0 },
    { postId: 1.5 },
    { postId: '7' },
    { generation: 'invalid' },
    { exp: '9999999999' },
    { exp: 0 },
  ])('即使签名正确也拒绝非法载荷 %#', async (patch) => {
    const { service, em } = setup()
    const payload =
      patch && !Array.isArray(patch)
        ? { v: 1, postId: 7, generation, exp: Math.floor(now.getTime() / 1000) + 60, ...patch }
        : patch
    await expect(service.read(signed(payload))).rejects.toMatchObject({ status: 404 })
    expect(em.findOneOrFail).not.toHaveBeenCalled()
  })
})
