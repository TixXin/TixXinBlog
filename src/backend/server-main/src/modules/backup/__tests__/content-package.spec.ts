/** @file content-package.spec.ts @description 内容包的输入限额、编号关系与真实媒体解析边界；所有素材仅在内存构造。 */
import 'reflect-metadata'
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { MAX_PACKAGE_BYTES, packageHash, parseContentPackage } from '../content-package'
import type {
  ContentPackage,
  PackageComment,
  PackageGalleryPhoto,
  PackageGuestbook,
  PackageMedia,
  PackagePost,
  PackageProject,
} from '../content-package'

const timestamp = '2026-10-01T12:00:00.000Z'
const mediaId = 'bb2a48c1-d233-4c45-9c1e-a21e9a56fd20'
const bundle = (): ContentPackage => ({
  format: 'tixxin-content',
  version: 12,
  omittedRelations: 0,
  exportedAt: timestamp,
  mediaIncluded: false,
  posts: [],
  flashes: [],
  moments: [],
  guestbook: [],
  gallery: [],
  projects: [],
  links: [],
  prompts: [],
  subscriptions: [],
  linkSettings: { rules: [] },
  gallerySettings: { gear: [] },
  folders: [],
  tags: [],
  media: [],
  requireCommentApproval: false,
  site: {
    name: '山间札记',
    description: '',
    ownerName: '林间',
    ownerTitle: '',
    avatar: '',
    avatarAlt: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    socials: [],
  },
})
const post = (sourceId = 1): PackagePost => ({
  sourceId,
  createdAt: timestamp,
  publishedAt: timestamp,
  deleted: false,
  values: {
    title: '山间散步',
    summary: '',
    folder: '随笔日记',
    category: 'life',
    status: 'draft',
    contentRaw: '午后的山路很安静。',
    pinned: false,
    readTimeMinutes: 5,
    tags: [],
    relatedContent: [],
  },
  comments: [],
})
const comment = (sourceId: number, parentId: number | null = null): PackageComment => ({
  sourceId,
  parentId,
  author: '小林',
  avatar: '',
  content: '喜欢这条山路。',
  isOwner: false,
  status: 'published',
  createdAt: timestamp,
})
const guestbook = (sourceId: number, replyToId: number | null = null): PackageGuestbook => ({
  sourceId,
  replyToId,
  createdAt: timestamp,
  deleted: false,
  author: '小林',
  avatar: '',
  content: '期待更多山间见闻。',
  isOwner: false,
  status: 'published',
  isPinned: false,
})
const gallery = (sourceId = 1): PackageGalleryPhoto => ({
  sourceId,
  createdAt: timestamp,
  publishedAt: null,
  deleted: false,
  values: {
    relatedContent: [],
    mediaId: null,
    externalUrl: 'https://images.example.org/Forest.JPG?size=A&size=B#Light',
    title: '林间',
    description: '',
    category: '',
    takenOn: null,
    location: '',
    device: '',
    status: 'draft',
    sortOrder: 0,
  },
})
const project = (sourceId = 1): PackageProject => ({
  sourceId,
  createdAt: timestamp,
  publishedAt: null,
  deleted: false,
  values: {
    relatedContent: [],
    title: '步道地图',
    description: '',
    coverMediaId: null,
    tags: [],
    links: [],
    progress: 'active',
    status: 'draft',
    sortOrder: 0,
  },
})
const parse = (value: unknown) => parseContentPackage(Buffer.from(JSON.stringify(value)))

describe('内容包输入与限额', () => {
  it('读取空包并将合法时区日期统一为 UTC', async () => {
    const input = bundle()
    expect(await parse({ ...input, exportedAt: '2026-10-01T20:00:00+08:00' })).toEqual(input)
  })

  it.each([Buffer.from('{'), Buffer.from([0xc3, 0x28])])('拒绝非法 JSON 或 UTF-8：%j', async (bytes) => {
    await expect(parseContentPackage(bytes)).rejects.toThrow('请选择有效的 UTF-8 JSON 内容包')
  })

  it('空文件及超过 50 MiB 的文件在解析前拒绝', async () => {
    await expect(parseContentPackage(Buffer.alloc(0))).rejects.toBeInstanceOf(PayloadTooLargeException)
    await expect(parseContentPackage(Buffer.alloc(MAX_PACKAGE_BYTES + 1))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    )
  })

  it.each([null, [], 'tixxin-content'])('拒绝非对象根节点：%j', async (value) => {
    await expect(parse(value)).rejects.toThrow('根对象')
  })

  it('仍接受上一导出版本 v11 的内容包，解析结果升级为当前版本', async () => {
    // v11 不含 v12 新增的站点导航与页脚字段，其余结构一致；缺失字段由读取时补默认值。
    const input = bundle()
    expect(await parse({ ...input, version: 11 })).toEqual(input)
  })

  it.each([0, 13, -1, 12.5, '12', null])('拒绝不支持或错误类型的版本：%j', async (version) => {
    await expect(parse({ ...bundle(), version })).rejects.toThrow('不支持的内容包格式或版本')
  })

  it('拒绝其他导出格式和根对象未知字段', async () => {
    await expect(parse({ ...bundle(), format: 'other-content' })).rejects.toThrow('不支持的内容包格式或版本')
    await expect(parse({ ...bundle(), credentials: {} })).rejects.toThrow('根对象')
  })

  it.each(['__proto__', 'constructor', 'prototype'])('在任意嵌套层拒绝危险键 %s', async (key) => {
    await expect(parse({ ...bundle(), site: { ...bundle().site, extra: { [key]: {} } } })).rejects.toThrow(
      '不支持的字段',
    )
  })

  it('在业务解析前拒绝超过 32 层的结构', async () => {
    let nested: unknown = null
    for (let depth = 0; depth < 33; depth++) nested = { child: nested }
    await expect(parse({ ...bundle(), extra: nested })).rejects.toThrow('数据层级或数量')
  })

  it.each([
    ['posts', 1000],
    ['flashes', 2000],
    ['moments', 2000],
    ['guestbook', 2000],
    ['gallery', 3000],
    ['projects', 2000],
    ['links', 2000],
    ['prompts', 3000],
    ['subscriptions', 3000],
    ['media', 300],
  ])('%s 超出 %i 条时拒绝整个包', async (field, limit) => {
    await expect(parse({ ...bundle(), [field]: Array(Number(limit) + 1).fill(null) })).rejects.toThrow(
      new BadRequestException(`内容包字段不合法：${field}`),
    )
  })

  it.each([-1, 72001, 1.5, '0', null])('拒绝非法关联省略计数：%j', async (omittedRelations) => {
    await expect(parse({ ...bundle(), omittedRelations })).rejects.toThrow('关联省略计数')
  })

  it('接受省略计数上界，拒绝非闰年日期和字符串布尔值', async () => {
    expect((await parse({ ...bundle(), omittedRelations: 72000 })).omittedRelations).toBe(72000)
    await expect(parse({ ...bundle(), exportedAt: '2026-02-29T12:00:00Z' })).rejects.toThrow('导出时间')
    await expect(parse({ ...bundle(), mediaIncluded: 'false' })).rejects.toThrow('mediaIncluded')
    await expect(parse({ ...bundle(), requireCommentApproval: 'false' })).rejects.toThrow('评论审核策略')
  })

  it('修剪后的目录或标签重复也必须拒绝', async () => {
    await expect(parse({ ...bundle(), folders: ['山野', ' 山野 '] })).rejects.toThrow('目录名称重复或空白')
    await expect(
      parse({
        ...bundle(),
        tags: [
          { label: '山野', color: 'blue' },
          { label: ' 山野 ', color: 'blue' },
        ],
      }),
    ).rejects.toThrow('目录名称重复或空白')
  })
})

describe('内容包编号与关系', () => {
  it.each([0, -1, 1.5, 2147483648, '1'])('拒绝非法文章编号：%j', async (sourceId) => {
    await expect(parse({ ...bundle(), posts: [{ ...post(), sourceId }] })).rejects.toThrow('sourceId')
  })

  it('拒绝重复文章编号、未知业务字段与编辑版本凭据', async () => {
    await expect(parse({ ...bundle(), posts: [post(), post()] })).rejects.toThrow('重复文章编号')
    for (const key of ['unexpected', 'revision']) {
      await expect(
        parse({ ...bundle(), posts: [{ ...post(), values: { ...post().values, [key]: 1 } }] }),
      ).rejects.toThrow('posts[0].values')
    }
  })

  it('接受跨域双向关系，保留来源编号、关系顺序和已删除记录', async () => {
    const input = bundle()
    input.posts = [post()]
    input.projects = [project()]
    input.gallery = [gallery()]
    input.posts[0]!.values.relatedContent = [
      { type: 'gallery', id: 1 },
      { type: 'project', id: 1 },
    ]
    input.projects[0]!.values.relatedContent = [{ type: 'post', id: 1 }]
    input.gallery[0]!.deleted = true
    const parsed = await parse(input)
    expect(parsed.posts[0]?.values.relatedContent).toEqual(input.posts[0]!.values.relatedContent)
    expect(parsed.projects[0]?.values.relatedContent).toEqual([{ type: 'post', id: 1 }])
    expect(parsed.gallery[0]?.deleted).toBe(true)
  })

  it.each([
    [[{ type: 'project', id: 2 }], '关联目标不在内容包内'],
    [[{ type: 'post', id: 1 }], '重复或自身关联'],
    [
      [
        { type: 'project', id: 1 },
        { type: 'project', id: 1 },
      ],
      '重复或自身关联',
    ],
  ])('拒绝缺失、自身或重复关联：%j', async (relatedContent, message) => {
    await expect(
      parse({
        ...bundle(),
        projects: [project()],
        posts: [{ ...post(), values: { ...post().values, relatedContent } }],
      }),
    ).rejects.toThrow(String(message))
  })

  it('三层评论可读取，第四层和跨文章父编号必须拒绝', async () => {
    const input = bundle()
    input.posts = [{ ...post(), comments: [comment(1), comment(2, 1), comment(3, 2)] }]
    expect((await parse(input)).posts[0]?.comments).toEqual(input.posts[0]!.comments)
    input.posts[0]!.comments.push(comment(4, 3))
    await expect(parse(input)).rejects.toThrow('评论层级或跨文章引用')
    input.posts = [
      { ...post(), comments: [comment(1)] },
      { ...post(2), comments: [comment(2, 1)] },
    ]
    await expect(parse(input)).rejects.toThrow('评论层级或跨文章引用')
  })

  it.each([
    [[comment(1), comment(1)], '重复评论编号'],
    [[comment(1, 2), comment(2, 1)], '评论层级或跨文章引用'],
  ])('拒绝重复评论或循环回复：%j', async (comments, message) => {
    await expect(parse({ ...bundle(), posts: [{ ...post(), comments }] })).rejects.toThrow(String(message))
  })

  it('跨文章和闪念合计最多 10000 条评论', async () => {
    const input = bundle()
    input.posts = [{ ...post(), comments: Array.from({ length: 10000 }, (_, index) => comment(index + 1)) }]
    expect((await parse(input)).posts[0]?.comments).toHaveLength(10000)
    input.flashes = [
      {
        sourceId: 'walk',
        createdAt: timestamp,
        values: { content: '路边开花了。' },
        comments: [
          {
            author: '小林',
            avatar: '',
            content: '春天真好。',
            createdAt: timestamp,
          },
        ],
      },
    ]
    await expect(parse(input)).rejects.toThrow('评论总量或重复闪念编号')
  })

  it('留言可先引用后出现的已删除父项', async () => {
    const messages = [guestbook(2, 1), { ...guestbook(1), deleted: true }]
    expect((await parse({ ...bundle(), guestbook: messages })).guestbook).toEqual(messages)
  })

  it.each([
    [[guestbook(1), guestbook(1)], '重复留言编号'],
    [[guestbook(1, 2)], '留言引用缺失或循环'],
    [[guestbook(1, 1)], '留言引用缺失或循环'],
    [[guestbook(1, 2), guestbook(2, 1)], '留言引用缺失或循环'],
  ])('拒绝重复、缺失或循环留言引用：%j', async (messages, message) => {
    await expect(parse({ ...bundle(), guestbook: messages })).rejects.toThrow(String(message))
  })

  it('图库保留外链原始地址语义，受管 UUID 统一小写', async () => {
    const input = bundle()
    input.gallery = [gallery()]
    expect((await parse(input)).gallery[0]?.values.externalUrl).toBe(gallery().values.externalUrl)
    input.gallery[0]!.values.mediaId = mediaId.toUpperCase()
    input.gallery[0]!.values.externalUrl = null
    expect((await parse(input)).gallery[0]?.values.mediaId).toBe(mediaId)
  })

  it.each([
    { mediaId, externalUrl: gallery().values.externalUrl },
    { mediaId: null, externalUrl: null },
    { mediaId: 'not-a-uuid', externalUrl: null },
    { mediaId: null, externalUrl: `https://example.org/api/v1/media/${mediaId}.webp` },
  ])('拒绝图库图片来源冲突或绕过引用的地址：%j', async (values) => {
    await expect(
      parse({ ...bundle(), gallery: [{ ...gallery(), values: { ...gallery().values, ...values } }] }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('内容包媒体完整性', () => {
  // 由 Sharp 生成的同一张 2×3 纯色图片：固定编码结果，解析仍使用真实解码器。
  const webp = Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAABwAQCdASoCAAMAAUAmJZgCdAF1AAD+54vvctFIr/wrX8rX8rVvgAAA', 'base64')
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNw60p060pkQKEASoIHJy7R3FsAAAAASUVORK5CYII=',
    'base64',
  )
  const webpWithExif = Buffer.from(
    'UklGRhQBAABXRUJQVlA4WAoAAAAIAAAAAQAAAgAAVlA4ICgAAABwAQCdASoCAAMAAUAmJZgCdAF1AAD+54vvctFIr/wrX8rX8rVvgAAARVhJRsYAAABFeGlmAABJSSoACAAAAAcAEgEDAAEAAAABAAAAGgEFAAEAAABiAAAAGwEFAAEAAABqAAAAKAEDAAEAAAACAAAAOwECAAMAAAA/PwAAEwIDAAEAAAABAAAAaYcEAAEAAAByAAAAAAAAADhjAADoAwAAOGMAAOgDAAAGAACQBwAEAAAAMDIxMAGRBwAEAAAAAQIDAACgBwAEAAAAMDEwMAGgAwABAAAA//8AAAKgBAABAAAAAgAAAAOgBAABAAAAAwAAAAAAAAA=',
    'base64',
  )
  const media = (bytes = webp): PackageMedia => ({
    id: mediaId,
    description: '山间的绿色',
    name: '林间.webp',
    alt: '绿色画面',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.length,
    width: 2,
    height: 3,
    createdAt: timestamp,
    deleted: false,
    base64: bytes.toString('base64'),
  })
  const parseMedia = (rows: unknown[], mediaIncluded = true) => parse({ ...bundle(), mediaIncluded, media: rows })

  it('解码真实 WebP 并保留摘要、尺寸、说明与字节', async () => {
    expect((await parseMedia([media()])).media).toEqual([media()])
  })

  it('不含图片的包接受媒体清单，拒绝标记与字节不一致', async () => {
    const metadata = media()
    delete metadata.base64
    expect((await parseMedia([metadata], false)).media).toEqual([metadata])
    await expect(parseMedia([metadata])).rejects.toThrow('媒体包含标记与字节不一致')
    await expect(parseMedia([media()], false)).rejects.toThrow('媒体包含标记与字节不一致')
  })

  it('UUID 大小写归一化后检查重复', async () => {
    expect((await parseMedia([{ ...media(), id: mediaId.toUpperCase() }])).media[0]?.id).toBe(mediaId)
    await expect(parseMedia([media(), { ...media(), id: mediaId.toUpperCase() }])).rejects.toThrow('重复媒体编号')
  })

  it.each([
    { id: 'bb2a48c1-d233-3c45-9c1e-a21e9a56fd20' },
    { name: '../林间.webp' },
    { name: '林间\\照片.webp' },
    { name: '林间\u202e.webp' },
    { name: '林间\n.webp' },
    { name: '林间.svg' },
    { width: 4097 },
    { height: 4097 },
    { byteSize: 32 * 1024 * 1024 + 1 },
    { sha256: 'A'.repeat(64) },
  ])('拒绝非法媒体标识、路径、大小和尺寸：%j', async (patch) => {
    await expect(parseMedia([{ ...media(), ...patch }])).rejects.toThrow('媒体标识、名称、大小或尺寸')
  })

  it.each(['abc', '!!!!', '===='])('拒绝非法 Base64：%s', async (base64) => {
    await expect(parseMedia([{ ...media(), base64 }])).rejects.toThrow('媒体编码')
  })

  it('拒绝摘要、长度和 RIFF 声明不一致', async () => {
    await expect(parseMedia([{ ...media(), sha256: '0'.repeat(64) }])).rejects.toThrow('媒体完整性或真实格式')
    await expect(parseMedia([{ ...media(), byteSize: webp.length + 1 }])).rejects.toThrow('媒体完整性或真实格式')
    const changed = Buffer.from(webp)
    changed.writeUInt32LE(webp.length, 4)
    await expect(parseMedia([media(changed)])).rejects.toThrow('媒体完整性或真实格式')
  })

  it('图片扩展名和有效摘要不能使真实 PNG 冒充受管 WebP', async () => {
    await expect(parseMedia([{ ...media(png), name: '林间.png' }])).rejects.toThrow('媒体完整性或真实格式')
  })

  it('摘要正确仍拒绝假 WebP、错误尺寸与包含 EXIF 的图片', async () => {
    const fake = Buffer.alloc(20)
    fake.write('RIFF', 0)
    fake.writeUInt32LE(fake.length - 8, 4)
    fake.write('WEBP', 8)
    await expect(parseMedia([media(fake)])).rejects.toThrow('媒体解码')
    await expect(parseMedia([{ ...media(), width: 3 }])).rejects.toThrow('媒体解码')
    await expect(parseMedia([media(webpWithExif)])).rejects.toThrow('媒体解码')
  })
})

describe('内容包摘要', () => {
  it('对象键顺序不改变摘要，数组顺序和业务内容会改变摘要', () => {
    const input = { title: '山间', values: { status: 'draft', tags: ['散步', '摄影'] } }
    expect(packageHash(input)).toBe(packageHash({ values: { tags: ['散步', '摄影'], status: 'draft' }, title: '山间' }))
    expect(packageHash(input)).not.toBe(packageHash({ ...input, values: { ...input.values, tags: ['摄影', '散步'] } }))
    expect(packageHash(input)).not.toBe(packageHash({ ...input, title: '海边' }))
  })
})
