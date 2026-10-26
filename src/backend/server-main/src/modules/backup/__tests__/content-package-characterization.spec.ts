/**
 * @file content-package-characterization.spec.ts
 * @description 内容包导出、迁入计划与迁入流程的特征快照：以内存实体覆盖各内容域、关系、媒体引用、草稿与回收状态，固定 v14 导出字节及 v14/v13 迁入计划。
 */
import 'reflect-metadata'
import { createHash } from 'node:crypto'
import { Post } from '../../../entities/post.entity'
import { Comment } from '../../../entities/comment.entity'
import { FlashNote } from '../../../entities/flash-note.entity'
import { FlashComment } from '../../../entities/flash-comment.entity'
import { Moment } from '../../../entities/moment.entity'
import { MomentComment } from '../../../entities/moment-comment.entity'
import { GuestbookMessage } from '../../../entities/guestbook-message.entity'
import { GalleryPhoto } from '../../../entities/gallery-photo.entity'
import { GallerySettings } from '../../../entities/gallery-settings.entity'
import { Project } from '../../../entities/project.entity'
import { FriendLink } from '../../../entities/friend-link.entity'
import { Subscription } from '../../../entities/subscription.entity'
import { ImagePrompt } from '../../../entities/image-prompt.entity'
import { LinkSettings } from '../../../entities/link-settings.entity'
import { PostFolder } from '../../../entities/post-folder.entity'
import { PostTag } from '../../../entities/post-tag.entity'
import { MediaAsset } from '../../../entities/media-asset.entity'
import { SiteSettings } from '../../../entities/site-settings.entity'
import { CommentPolicy } from '../../../entities/comment-policy.entity'
import { PostAddress } from '../../../entities/post-address.entity'
import { TaxonomyAlias } from '../../../entities/taxonomy-alias.entity'
import { ContentContext } from '../../../entities/content-context.entity'
import { ContentImport } from '../../../entities/content-import.entity'
import { AdminSession } from '../../../entities/admin-session.entity'
import { ContentExportService } from '../content-export.service'
import { ContentImportService } from '../content-import.service'
import { makeContentPlan } from '../content-import-plan'
import { packageHash, parseContentPackage } from '../content-package'
import type { ContentPackage } from '../content-package'
import * as execution from '../content-import-execution'

jest.mock('../content-import-execution', () => ({
  ...jest.requireActual('../content-import-execution'),
  applyImportPayload: jest.fn(),
  handleImportFailure: jest.fn(),
}))

const at = (day: number) => new Date(Date.UTC(2026, 8, day, 8, 30))
const bytes = (id: string) => Buffer.from(`webp:${id}`)
const sha = (id: string) => createHash('sha256').update(bytes(id)).digest('hex')
const M1 = 'a1111111-1111-4111-8111-111111111111'
const M2 = 'a2222222-2222-4222-8222-222222222222'
const F1 = 'f1111111-1111-4111-8111-111111111111'
const F2 = 'f2222222-2222-4222-8222-222222222222'
const MO1 = 'b1111111-1111-4111-8111-111111111111'
const MO2 = 'b2222222-2222-4222-8222-222222222222'

const tag = (label: string, color: string) => ({ label, color })
const posts = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(2),
    deletedAt: undefined,
    relatedContent: [
      { type: 'project', id: 1 },
      { type: 'gallery', id: 1 },
      { type: 'post', id: 3 },
    ],
    slug: 'mountain-walk',
    coverAlt: '山脊',
    seoTitle: '',
    seoDescription: '',
    seoNoindex: false,
    title: '山间散步',
    summary: '沿着山脊走到天黑',
    cover: `/api/v1/media/${M1}.webp`,
    folder: '随笔日记',
    category: 'life',
    contentRaw: `![山脊](/api/v1/media/${M1}.webp)\n\n傍晚的风很大。`,
    contentSections: [],
    readTimeMinutes: 3,
    status: 'published',
    pinned: true,
    tags: { getItems: () => [tag('徒步', 'emerald')] },
  },
  {
    id: 2,
    createdAt: at(3),
    publishedAt: at(3),
    deletedAt: undefined,
    relatedContent: undefined,
    slug: undefined,
    coverAlt: undefined,
    seoTitle: undefined,
    seoDescription: undefined,
    seoNoindex: true,
    title: '旧版正文草稿',
    summary: '',
    cover: undefined,
    folder: '前端开发',
    category: 'tech',
    contentRaw: undefined,
    contentSections: [
      { type: 'heading', level: 2, text: '小标题' },
      { type: 'code', language: 'ts', text: 'const a = 1' },
      { type: 'list', items: ['一', '二'] },
    ],
    readTimeMinutes: 1,
    status: 'draft',
    pinned: false,
    tags: { getItems: () => [tag('技术分享', 'sky'), tag('徒步', 'emerald')] },
  },
  {
    id: 3,
    createdAt: at(4),
    publishedAt: at(4),
    deletedAt: at(10),
    relatedContent: [{ type: 'post', id: 1 }],
    slug: 'recycled-post',
    coverAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoNoindex: false,
    title: '已回收文章',
    summary: '',
    cover: '',
    folder: '随笔日记',
    category: 'life',
    contentRaw: '已移入回收站',
    contentSections: [],
    readTimeMinutes: 1,
    status: 'published',
    pinned: false,
    tags: { getItems: () => [] },
  },
]
const comments = [
  {
    id: 11,
    post: { id: 1 },
    parent: undefined,
    authorSnapshot: { name: '晨曦', avatar: `/api/v1/media/${M1}.webp` },
    content: '风景真好',
    isOwner: false,
    status: 'published',
    createdAt: at(5),
  },
  {
    id: 12,
    post: { id: 1 },
    parent: { id: 11 },
    authorSnapshot: { name: 'tixxin', avatar: '/avatar.svg' },
    content: '谢谢',
    isOwner: true,
    status: 'pending',
    createdAt: at(6),
  },
  {
    id: 13,
    post: { id: 3 },
    parent: undefined,
    authorSnapshot: { name: '路人', avatar: '' },
    content: '回收文章下的评论',
    isOwner: false,
    status: 'hidden',
    createdAt: at(6),
  },
]
const flashes = [
  {
    id: F1,
    createdAt: at(2),
    content: '今天看到云海',
    tags: ['生活'],
    images: [`/api/v1/media/${M1}.webp`],
    type: 'idea',
    isPinned: true,
    isDraft: false,
    isArchived: false,
  },
  {
    id: F2,
    createdAt: at(3),
    content: '待整理的想法',
    tags: [],
    images: [],
    type: 'todo',
    isPinned: false,
    isDraft: true,
    isArchived: true,
  },
]
const flashComments = [
  {
    flashNote: { id: F1 },
    authorName: '晨曦',
    authorAvatar: '/avatar.svg',
    content: '好看',
    status: 'published',
    createdAt: at(4),
  },
  {
    flashNote: { id: F1 },
    authorName: '访客',
    authorAvatar: '',
    content: '待审核',
    status: 'pending',
    createdAt: at(5),
  },
]
const moments = [
  {
    id: MO1,
    createdAt: at(4),
    publishedAt: at(4),
    deletedAt: undefined,
    content: '读完了一本书',
    topics: ['阅读'],
    images: [`/api/v1/media/${M1}.webp`],
    location: '深圳',
    device: undefined,
    mood: '平静',
    linkedArticle: { id: 1 },
    linkedLink: undefined,
    status: 'published',
    isPinned: false,
  },
  {
    id: MO2,
    createdAt: at(5),
    publishedAt: undefined,
    deletedAt: at(11),
    content: '已删除的动态',
    topics: [],
    images: [],
    location: undefined,
    device: 'iPhone',
    mood: undefined,
    linkedArticle: undefined,
    linkedLink: { url: 'https://example.org/', title: '示例' },
    status: 'draft',
    isPinned: false,
  },
]
const momentComments = [
  {
    id: 'c1111111-1111-4111-8111-111111111111',
    moment: { id: MO1 },
    author: '驴友',
    avatar: '/avatar.svg',
    content: '同读过',
    isOwner: false,
    status: 'published',
    deletedAt: undefined,
    createdAt: at(6),
  },
  {
    id: 'c2222222-2222-4222-8222-222222222222',
    moment: { id: MO1 },
    author: '路人',
    avatar: '',
    content: '已删除评论',
    isOwner: false,
    status: 'hidden',
    deletedAt: at(7),
    createdAt: at(7),
  },
]
const guestbook = [
  {
    id: 21,
    createdAt: at(1),
    deletedAt: undefined,
    author: '老朋友',
    avatar: `/api/v1/media/${M1}.webp`,
    content: '来踩踩',
    isOwner: false,
    status: 'published',
    isPinned: true,
    replyTo: undefined,
    browser: 'Edge 155',
    region: '广东',
  },
  {
    id: 22,
    createdAt: at(2),
    deletedAt: undefined,
    author: 'tixxin',
    avatar: '/avatar.svg',
    content: '欢迎',
    isOwner: true,
    status: 'published',
    isPinned: false,
    replyTo: { id: 21 },
    browser: undefined,
    region: undefined,
  },
  {
    id: 23,
    createdAt: at(3),
    deletedAt: at(9),
    author: '广告',
    avatar: '',
    content: '已回收留言',
    isOwner: false,
    status: 'hidden',
    isPinned: false,
    replyTo: undefined,
    browser: undefined,
    region: undefined,
  },
]
const gallery = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(1),
    deletedAt: undefined,
    media: { id: M1 },
    relatedContent: [{ type: 'post', id: 1 }],
    externalUrl: undefined,
    title: '山脊',
    description: '傍晚',
    category: '风景',
    takenOn: '2026-08-30',
    location: '梧桐山',
    device: 'Sony A7M4',
    status: 'published',
    sortOrder: 2,
  },
  {
    id: 2,
    createdAt: at(2),
    publishedAt: undefined,
    deletedAt: at(9),
    media: undefined,
    relatedContent: undefined,
    externalUrl: 'https://images.example.org/a.jpg',
    title: '外链照片',
    description: '',
    category: '城市',
    takenOn: undefined,
    location: '',
    device: '',
    status: 'draft',
    sortOrder: 0,
  },
]
const projects = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(1),
    deletedAt: undefined,
    title: '博客工作台',
    relatedContent: [
      { type: 'post', id: 1 },
      { type: 'project', id: 2 },
    ],
    description: '内容组织工具',
    coverMedia: { id: M1 },
    tags: [{ color: 'emerald', label: 'Vue' }],
    links: [{ href: 'https://example.org/repo', kind: 'source' }],
    progress: 'active',
    status: 'published',
    sortOrder: 1,
  },
  {
    id: 2,
    createdAt: at(2),
    publishedAt: undefined,
    deletedAt: at(8),
    title: '废弃项目',
    relatedContent: undefined,
    description: '',
    coverMedia: undefined,
    tags: [],
    links: [],
    progress: 'archived',
    status: 'draft',
    sortOrder: 0,
  },
]
const links = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(1),
    deletedAt: undefined,
    name: '山友博客',
    description: '记录徒步',
    url: 'https://friend.example.org/',
    logoMedia: { id: M1 },
    logoUrl: undefined,
    status: 'published',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    id: 2,
    createdAt: at(2),
    publishedAt: undefined,
    deletedAt: at(9),
    name: '失联站点',
    description: '',
    url: 'https://gone.example.org/',
    logoMedia: undefined,
    logoUrl: 'https://gone.example.org/logo.png',
    status: 'draft',
    isFeatured: false,
    sortOrder: 0,
  },
]
const prompts = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(2),
    title: '雾中山色',
    description: '摄影参考',
    prompt: 'misty mountains at dusk',
    negativePrompt: 'text',
    model: 'sdxl',
    tags: ['风景'],
    media: { id: M1 },
    externalImageUrl: undefined,
    imageAlt: '雾中山',
    sourceUrl: '',
    status: 'published',
  },
  {
    id: 2,
    createdAt: at(3),
    publishedAt: undefined,
    title: '草稿提示词',
    description: '',
    prompt: 'city night',
    negativePrompt: '',
    model: '',
    tags: [],
    media: undefined,
    externalImageUrl: 'https://images.example.org/p.jpg',
    imageAlt: '',
    sourceUrl: 'https://example.org/source',
    status: 'draft',
  },
]
const priceEvent = {
  id: '6459bac0-801f-44cd-91ae-5729bef9a110',
  effectiveAt: '2026-09-01T10:00:00.000Z',
  recordedAt: '2026-09-01T10:00:00.000Z',
  amount: 2000,
  currency: 'USD',
  billingCycle: 'monthly',
}
const subscriptions = [
  {
    id: 1,
    createdAt: at(1),
    publishedAt: at(1),
    deletedAt: undefined,
    name: '工作用云盘',
    description: '保存设计文件',
    url: 'https://example.org/',
    platform: undefined,
    category: 'cloud',
    currency: 'USD',
    amount: 2000,
    billingCycle: 'monthly',
    startDate: '2020-01-31',
    nextBillingDate: '2026-10-31',
    subscriptionStatus: 'active',
    notes: '家庭方案',
    iconMedia: { id: M1 },
    faviconDomain: undefined,
    priceHistory: [priceEvent],
    status: 'published',
    sortOrder: 10,
  },
  {
    id: 2,
    createdAt: at(2),
    publishedAt: undefined,
    deletedAt: at(9),
    name: '已退订音乐',
    description: '',
    url: undefined,
    platform: 'apple',
    category: 'entertainment',
    currency: 'CNY',
    amount: 1100,
    billingCycle: 'monthly',
    startDate: undefined,
    nextBillingDate: undefined,
    subscriptionStatus: 'cancelled',
    notes: '',
    iconMedia: undefined,
    faviconDomain: undefined,
    priceHistory: [{ ...priceEvent, id: '6459bac0-801f-44cd-91ae-5729bef9a111', amount: 1100, currency: 'CNY' }],
    status: 'draft',
    sortOrder: 0,
  },
]
const assets = [
  {
    id: M1,
    originalName: 'ridge.webp',
    alt: '山脊',
    description: '傍晚山脊',
    sha256: sha(M1),
    byteSize: bytes(M1).length,
    width: 1600,
    height: 900,
    createdAt: at(1),
    deletedAt: undefined,
  },
  {
    id: M2,
    originalName: 'unused.webp',
    alt: '',
    description: '',
    sha256: sha(M2),
    byteSize: bytes(M2).length,
    width: 20,
    height: 20,
    createdAt: at(2),
    deletedAt: at(9),
  },
]
const site = {
  revision: 3,
  values: {
    name: '山间札记',
    description: '记录山野与代码',
    ownerName: '林间',
    ownerTitle: '前端开发',
    avatar: `/api/v1/media/${M1}.webp`,
    avatarAlt: '头像',
    seoTitle: '',
    seoDescription: '',
    announcement: '新文章上线',
    announcementUpdatedAt: '2026-09-01T00:00:00.000Z',
    socials: [{ href: 'https://github.com/example', icon: 'lucide:github', label: 'GitHub' }],
  },
}
const entities = new Map<unknown, unknown>([
  [Post, posts],
  [Comment, comments],
  [FlashNote, flashes],
  [FlashComment, flashComments],
  [MediaAsset, assets],
  [Moment, moments],
  [GuestbookMessage, guestbook],
  [GalleryPhoto, gallery],
  [Project, projects],
  [FriendLink, links],
  [ImagePrompt, prompts],
  [Subscription, subscriptions],
  [MomentComment, momentComments],
  [PostFolder, [{ label: '前端开发' }, { label: '随笔日记' }]],
  [PostTag, [tag('徒步', 'emerald'), tag('技术分享', 'sky')]],
  [PostAddress, [{ slug: 'mountain-walk', post: { id: 1 } }]],
  [TaxonomyAlias, []],
])
const singletons = new Map<unknown, unknown>([
  [LinkSettings, { revision: 4, rules: ['内容健康'] }],
  [GallerySettings, { revision: 5, gear: [{ icon: 'lucide:camera', name: 'Sony A7M4', description: '主力机身' }] }],
  [SiteSettings, site],
  [CommentPolicy, { revision: 2, requireApproval: true }],
  [ContentContext, { generation: 'generation-7' }],
])

type Calls = string[]
function fakeEm(calls: Calls = []) {
  const counts = {
    posts: posts.length,
    flashes: flashes.length,
    moments: moments.length,
    guestbook: guestbook.length,
    gallery: gallery.length,
    projects: projects.length,
    links: links.length,
    prompts: prompts.length,
    subscriptions: subscriptions.length,
    comments: comments.length + flashComments.length + momentComments.length,
    media: assets.length,
    bytes: '2048',
  }
  const name = (entity: unknown) => (entity as { name: string }).name
  const em = {
    execute: jest.fn(async (sql: string): Promise<unknown[]> => {
      calls.push(`execute:${sql.slice(0, 40)}`)
      return sql.startsWith('select (select count') ? [counts] : []
    }),
    find: jest.fn(async (entity: unknown) => {
      calls.push(`find:${name(entity)}`)
      return entities.get(entity) ?? []
    }),
    findOneOrFail: jest.fn(async (entity: unknown) => {
      calls.push(`findOneOrFail:${name(entity)}`)
      return singletons.get(entity)
    }),
    findOne: jest.fn(async (entity: unknown): Promise<unknown> => {
      calls.push(`findOne:${name(entity)}`)
      return null
    }),
    count: jest.fn(async (entity: unknown) => {
      calls.push(`count:${name(entity)}`)
      return 1
    }),
    transactional: jest.fn(async (callback: (em: unknown) => unknown, options?: unknown): Promise<unknown> => {
      calls.push(`transactional:${JSON.stringify(options ?? null)}`)
      return callback(em)
    }),
  }
  return em
}
const storage = {
  get: jest.fn(async (key: string) => bytes(key.replace('.webp', ''))),
  readIfExists: jest.fn(async (key: string) => (key.startsWith(M2) ? null : bytes(key.replace('.webp', '')))),
  remove: jest.fn(async () => undefined),
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00.000Z'), doNotFake: ['nextTick', 'setImmediate'] })
  jest.clearAllMocks()
})
afterEach(() => jest.useRealTimers())

async function exportPackage(mediaIncluded: boolean, calls?: Calls) {
  const em = fakeEm(calls)
  const exporter = new ContentExportService(em as never, storage as never)
  return { result: await exporter.snapshot(mediaIncluded), exporter, em }
}
const legacyV13 = (value: ContentPackage) => {
  const copy = structuredClone(value) as unknown as Record<string, unknown> & { site: Record<string, unknown> }
  delete copy.site.searchIndexing
  copy.version = 13
  return copy
}
const parse = (value: unknown) => parseContentPackage(Buffer.from(JSON.stringify(value)))

describe('内容包导出特征', () => {
  it('v14 导出的字节与读取顺序保持不变', async () => {
    const calls: Calls = []
    const { result, em } = await exportPackage(false, calls)
    expect(JSON.stringify(result)).toMatchSnapshot()
    expect(calls).toMatchSnapshot()
    expect(em.transactional).toHaveBeenCalledTimes(1)
    expect(storage.get).not.toHaveBeenCalled()
  })

  it('包含媒体时附带校验过的 Base64 字节', async () => {
    const { result } = await exportPackage(true)
    expect(result.media.map((item) => item.base64)).toEqual([
      bytes(M1).toString('base64'),
      bytes(M2).toString('base64'),
    ])
    expect(storage.get.mock.calls).toEqual([[`${M1}.webp`], [`${M2}.webp`]])
  })

  it('外部传入事务时不另开事务', async () => {
    const em = fakeEm()
    const outer = fakeEm()
    const exporter = new ContentExportService(outer as never, storage as never)
    await exporter.snapshot(false, em as never)
    expect(outer.transactional).not.toHaveBeenCalled()
    expect(em.transactional).not.toHaveBeenCalled()
  })

  it.each([
    ['posts', 1001],
    ['flashes', 2001],
    ['comments', 10001],
    ['media', 301],
    ['bytes', '999999999999'],
  ])('计数 %s 超限时拒绝导出', async (key, value) => {
    const em = fakeEm()
    em.execute.mockResolvedValueOnce([{ ...((await em.execute('select (select count'))[0] as object), [key]: value }])
    const exporter = new ContentExportService(em as never, storage as never)
    await expect(exporter.snapshot(false, em as never)).rejects.toMatchObject({ status: 413 })
    expect(em.find).not.toHaveBeenCalled()
  })

  it('统计查询为空或媒体像素超限时拒绝导出', async () => {
    const em = fakeEm()
    em.execute.mockResolvedValueOnce([])
    const exporter = new ContentExportService(em as never, storage as never)
    await expect(exporter.snapshot(false, em as never)).rejects.toMatchObject({ status: 413 })
    const huge = fakeEm()
    const original = entities.get(MediaAsset)
    entities.set(MediaAsset, [{ ...assets[0], width: 20000, height: 20000 }])
    try {
      await expect(
        new ContentExportService(huge as never, storage as never).snapshot(true, huge as never),
      ).rejects.toMatchObject({ status: 413, message: expect.any(String) })
      await expect(
        new ContentExportService(huge as never, storage as never).snapshot(false, huge as never),
      ).resolves.toBeDefined()
    } finally {
      entities.set(MediaAsset, original)
    }
  })
})

describe('内容包迁入计划特征', () => {
  it.each([
    ['v14 跳过相同内容', false, 'skip', false],
    ['v14 复制并包含设置', false, 'copy', true],
    ['v13 复制并包含设置', true, 'copy', true],
    ['v13 跳过且不含设置', true, 'skip', false],
  ] as const)('%s', async (_name, legacy, strategy, includeSettings) => {
    const { result, exporter } = await exportPackage(false)
    const input = await parse(legacy ? legacyV13(result) : result)
    const calls: Calls = []
    const plan = await makeContentPlan({
      em: fakeEm(calls) as never,
      exporter,
      storage: storage as never,
      input,
      strategy,
      includeSettings,
      ticket: 'd1d2d3d4-0000-4000-8000-000000000000',
    })
    expect(plan).toMatchSnapshot()
    expect(packageHash(plan)).toMatchSnapshot()
    expect(calls).toMatchSnapshot()
  })

  it('新内容、地址冲突与缺失媒体进入计划错误', async () => {
    const { result, exporter } = await exportPackage(false)
    const changed = structuredClone(result)
    changed.posts[0]!.values.title = '改写后的山间散步'
    changed.posts.push({
      ...structuredClone(changed.posts[1]!),
      sourceId: 9,
      values: {
        ...changed.posts[1]!.values,
        title: '引用缺失媒体',
        cover: '/api/v1/media/a9999999-9999-4999-8999-999999999999.webp',
      },
    })
    changed.flashes.push({
      ...structuredClone(changed.flashes[0]!),
      sourceId: 'f9999999-9999-4999-8999-999999999999',
      values: { ...changed.flashes[0]!.values, content: '新闪念' },
    })
    const plan = await makeContentPlan({
      em: fakeEm() as never,
      exporter,
      storage: storage as never,
      input: await parse(changed),
      strategy: 'skip',
      includeSettings: false,
      ticket: 'e1e2e3e4-0000-4000-8000-000000000000',
    })
    expect(plan).toMatchSnapshot()
  })
})

describe('内容包迁入服务特征', () => {
  const admin = { id: 'admin-1', sessionVersion: 2, sessionId: 'session-1' }
  const ticket = 'c0c0c0c0-0000-4000-8000-000000000000'
  async function setup() {
    const calls: Calls = []
    const em = fakeEm(calls)
    const exporter = new ContentExportService(em as never, storage as never)
    const writers = {
      posts: { name: 'posts' },
      flashes: { name: 'flashes' },
      sites: { name: 'sites' },
      comments: { name: 'comments' },
    }
    const service = new ContentImportService(
      em as never,
      storage as never,
      exporter,
      writers.posts as never,
      writers.flashes as never,
      writers.sites as never,
      writers.comments as never,
    )
    const { result } = await exportPackage(false)
    const file = { buffer: Buffer.from(JSON.stringify(result)), originalname: 'blog.json' }
    let job: Record<string, unknown> | null = null
    ;(em as unknown as { create: jest.Mock }).create = jest.fn((_entity: unknown, data: Record<string, unknown>) => {
      job = { createdAt: new Date(), ...data }
      return job
    })
    ;(em as unknown as { flush: jest.Mock }).flush = jest.fn(async () => calls.push('flush'))
    ;(em as unknown as { nativeUpdate: jest.Mock }).nativeUpdate = jest.fn(
      async (_e: unknown, where: unknown, data: unknown) => {
        calls.push(`nativeUpdate:${JSON.stringify(where)}:${JSON.stringify(data)}`)
        return 1
      },
    )
    return { em, calls, service, file, writers, current: () => job }
  }

  it('预览创建票据并按原样返回计划视图', async () => {
    const { service, file, calls, em } = await setup()
    const dto = await service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin)
    expect(dto).toMatchSnapshot()
    expect(calls).toMatchSnapshot()
    expect(em.transactional.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'repeatable read' })
  })

  it('同一上传标识的重放与冲突', async () => {
    const { service, file, em } = await setup()
    const existing = {
      id: ticket,
      actorId: admin.id,
      fileHash: createHash('sha256').update(file.buffer).digest('hex'),
      strategy: 'copy',
      includeSettings: true,
    }
    em.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(null)
    await expect(
      service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin),
    ).rejects.toMatchObject({ status: 404 })
    em.findOne.mockResolvedValueOnce({ ...existing, strategy: 'skip' })
    await expect(
      service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin),
    ).rejects.toMatchObject({ status: 409, message: '上传标识已经使用，请重新选择文件' })
    em.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...existing, actorId: 'other' })
    await expect(
      service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      service.preview(undefined, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('执行迁入的检查顺序、写入参数与结果', async () => {
    const { service, file, em, calls, writers, current } = await setup()
    await service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin)
    const job = current()!
    const confirmation = packageHash(job.plan)
    const apply = execution.applyImportPayload as jest.Mock
    apply.mockImplementation(async (params: { written: string[] }) => {
      params.written.push('new-file.webp')
      return { posts: [{ sourceId: 1, id: 99 }], flashes: [], comments: 2, media: 0 }
    })
    calls.length = 0
    em.findOne.mockImplementation(async (entity: unknown) => (entity === ContentImport ? job : null))
    ;(em as unknown as { findOneOrFail: jest.Mock }).findOneOrFail.mockImplementation(async (entity: unknown) =>
      entity === ContentImport ? job : singletons.get(entity),
    )
    em.count.mockImplementation(async (entity: unknown) => (entity === AdminSession ? 1 : 0))
    const dto = await service.executeImport(ticket, '导入为新草稿', confirmation, admin)
    expect(dto).toMatchSnapshot()
    expect(calls).toMatchSnapshot()
    const params = apply.mock.calls.at(-1)![0]
    expect(Object.keys(params)).toEqual([
      'em',
      'storage',
      'posts',
      'flashes',
      'sites',
      'comments',
      'current',
      'payload',
      'written',
      'includeSettings',
    ])
    expect(params.posts).toBe(writers.posts)
    expect(params.comments).toBe(writers.comments)
    expect(params.written).toEqual(['new-file.webp'])
    expect(job.payload).toBeUndefined()
    await expect(
      service.execute({ id: ticket, acknowledgement: '导入为新草稿', confirmation, admin }),
    ).resolves.toEqual(await service.executeImport(ticket, '导入为新草稿', confirmation, admin))
  })

  it.each([
    ['确认短语错误', { acknowledgement: '导入' }, 400, '请确认以新草稿迁入内容'],
    ['票据不存在', { missing: true }, 404, '导入票据不存在'],
    ['确认哈希过期', { confirmation: 'f'.repeat(64) }, 409, '预览已更新，请重新读取后确认'],
    ['会话版本变化', { sessionVersion: 9 }, 400, '预览已失效，请重新预览'],
    ['会话已撤销', { session: 0 }, 409, '会话已经失效，未开始导入'],
    ['目标内容变化', { basis: 'changed' }, 409, '目标内容或配置已变化，请重新预览后确认'],
    ['当前计划未就绪', { mediaMissing: true }, 409, expect.stringContaining(M1)],
  ])('执行失败：%s', async (_name, change: Record<string, unknown>, status, message) => {
    const { service, file, em, calls } = await setup()
    await service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: true }, admin)
    const job = { ...current_(em) }
    if (change.basis) job.plan = { ...job.plan, basis: change.basis as string }
    em.findOne.mockImplementation(async (entity: unknown) => (entity === ContentImport && !change.missing ? job : null))
    ;(em as unknown as { findOneOrFail: jest.Mock }).findOneOrFail.mockImplementation(async (entity: unknown) =>
      entity === ContentImport ? job : singletons.get(entity),
    )
    em.count.mockImplementation(async (entity: unknown) =>
      entity === AdminSession ? ((change.session as number | undefined) ?? 1) : 0,
    )
    ;(execution.handleImportFailure as jest.Mock).mockImplementation(
      async (params: { error: unknown; id: string; actorId: string; written: string[]; locale: string }) => {
        calls.push(`handleImportFailure:${params.id}:${params.actorId}:${params.written.join(',')}:${params.locale}`)
        throw params.error
      },
    )
    if (change.mediaMissing) storage.readIfExists.mockResolvedValueOnce(null)
    calls.length = 0
    const confirmation = (change.confirmation as string) ?? packageHash(job.plan)
    await expect(
      service.executeImport(ticket, (change.acknowledgement as string) ?? '导入为新草稿', confirmation, {
        ...admin,
        sessionVersion: (change.sessionVersion as number) ?? admin.sessionVersion,
      }),
    ).rejects.toMatchObject({ status, message })
    expect(calls).toMatchSnapshot()
    expect(execution.applyImportPayload).not.toHaveBeenCalled()
  })

  it('写入失败时清理本次文件并交给失败处理', async () => {
    const { service, file, em, calls } = await setup()
    await service.preview(file, { requestId: ticket, strategy: 'copy', includeSettings: false }, admin)
    const job = current_(em)
    em.findOne.mockImplementation(async (entity: unknown) => (entity === ContentImport ? job : null))
    ;(em as unknown as { findOneOrFail: jest.Mock }).findOneOrFail.mockImplementation(async (entity: unknown) =>
      entity === ContentImport ? job : singletons.get(entity),
    )
    ;(execution.applyImportPayload as jest.Mock).mockImplementation(async (params: { written: string[] }) => {
      params.written.push('a.webp', 'b.webp')
      throw new Error('写入失败')
    })
    ;(execution.handleImportFailure as jest.Mock).mockImplementation(async (params: { written: string[] }) => ({
      handled: [...params.written],
    }))
    calls.length = 0
    await expect(service.executeImport(ticket, '导入为新草稿', packageHash(job.plan), admin)).resolves.toEqual({
      handled: [],
    })
    expect(storage.remove.mock.calls).toEqual([['a.webp'], ['b.webp']])
    expect(calls).toMatchSnapshot()
  })

  it('读取、最近票据与重新预览', async () => {
    const { service, file, em, calls } = await setup()
    await service.preview(file, { requestId: ticket, strategy: 'skip', includeSettings: false }, admin)
    const job = current_(em)
    em.findOne.mockImplementation(async (entity: unknown) => (entity === ContentImport ? job : null))
    em.find.mockImplementation(async (entity: unknown) =>
      entity === ContentImport
        ? [
            { ...job, completedAt: undefined, expiresAt: new Date('2026-09-01T00:00:00.000Z') },
            { ...job, id: 'done', completedAt: new Date() },
          ]
        : (entities.get(entity) ?? []),
    )
    calls.length = 0
    expect(await service.get(ticket, admin)).toMatchSnapshot()
    expect(await service.recent(admin)).toMatchSnapshot()
    expect(await service.repreview(ticket, admin)).toMatchSnapshot()
    expect(calls).toMatchSnapshot()
    job.completedAt = new Date()
    await expect(service.repreview(ticket, admin)).resolves.toMatchObject({ completed: true })
    em.findOne.mockImplementation(async (entity: unknown) =>
      entity === ContentImport ? { ...job, completedAt: undefined, payload: undefined } : null,
    )
    await expect(service.repreview(ticket, admin)).rejects.toMatchObject({ status: 400 })
    em.findOne.mockImplementation(async () => null)
    await expect(service.get(ticket, admin)).rejects.toMatchObject({ status: 404 })
    await expect(service.repreview(ticket, admin)).rejects.toMatchObject({ status: 404 })
  })
})

function current_(em: ReturnType<typeof fakeEm>) {
  const create = (em as unknown as { create: jest.Mock }).create
  return create.mock.results.at(-1)!.value as Record<string, unknown> & {
    plan: Parameters<typeof packageHash>[0] & { basis: string }
  }
}
