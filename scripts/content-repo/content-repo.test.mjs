/**
 * @file content-repo.test.mjs
 * @description 内容仓库转换：内容包 → 目录 → 内容包无损往返、文件命名、媒体校验与目录写入保护。
 * @author TixXin
 * @since 2026-11-05
 */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { filesToPack, packToFiles } from './layout.mjs'
import { readMarkdown, writeMarkdown } from './markdown.mjs'
import { main, readRepo } from './cli.mjs'
import { sha256 } from './media.mjs'

// 最小合法 WebP 头（RIFF....WEBP），内容本身不需要能解码
const IMAGE = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([20, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(8, 7),
])
const MEDIA_ID = '07ea130e-2793-483a-8119-95ce13c6387e'

function samplePack() {
  return {
    format: 'tixxin-content',
    version: 16,
    omittedRelations: 0,
    exportedAt: '2026-11-05T12:00:00.000Z',
    mediaIncluded: true,
    posts: [
      {
        sourceId: 2,
        createdAt: '2026-10-02T08:00:00.000Z',
        publishedAt: '2026-10-02T08:00:00.000Z',
        deleted: false,
        values: {
          relatedContent: [{ type: 'project', id: 1 }],
          slug: 'hello-world',
          title: '你好：世界',
          summary: '',
          cover: `/api/v1/media/${MEDIA_ID}`,
          folder: '随笔日记',
          category: 'life',
          contentRaw: '---\n正文以分隔线开头\n\n```yaml\na: 1\n```\n\n结尾没有换行',
          readTimeMinutes: 3,
          status: 'published',
          pinned: false,
          tags: ['Nuxt', '2026'],
        },
        comments: [
          {
            sourceId: 1,
            parentId: null,
            author: '访客',
            avatar: '/avatar.svg',
            content: '好文\n第二行',
            isOwner: false,
            status: 'published',
            createdAt: '2026-10-03T00:00:00.000Z',
          },
        ],
      },
      {
        sourceId: 1,
        createdAt: '2026-10-01T08:00:00.000Z',
        publishedAt: '2026-10-01T08:00:00.000Z',
        deleted: true,
        values: { slug: '', title: '无地址', contentRaw: '以换行结尾\n\n', status: 'draft', tags: [] },
        comments: [],
      },
    ],
    flashes: [
      {
        sourceId: '197f6b8e-5ed7-471a-bf93-37792db0dc1e',
        createdAt: '2026-10-16T20:00:59.789Z',
        values: {
          content: '闪念 #标签',
          tags: [],
          images: [],
          type: 'idea',
          isPinned: false,
          isDraft: false,
          isArchived: false,
        },
        comments: [],
      },
    ],
    moments: [
      {
        sourceId: '029ece56-fb5c-4055-922e-a97e307dc98d',
        createdAt: '2026-04-08T00:15:00.000Z',
        publishedAt: null,
        deleted: false,
        values: {
          content: '朋友圈',
          topics: ['生活'],
          images: [MEDIA_ID],
          location: null,
          status: 'draft',
          isPinned: false,
        },
        comments: [],
      },
    ],
    guestbook: [
      {
        sourceId: 1,
        createdAt: '2026-10-16T20:00:03.164Z',
        deleted: false,
        author: 'TixXin',
        avatar: '/avatar.svg',
        content: '留言',
        isOwner: true,
        status: 'pending',
        isPinned: false,
        replyToId: null,
      },
    ],
    gallery: [],
    gallerySettings: null,
    projects: [],
    links: [],
    linkSettings: { rules: ['互换前请先添加本站'] },
    prompts: [],
    subscriptions: [],
    folders: ['随笔日记'],
    tags: [{ label: 'Nuxt', color: 'emerald' }],
    site: { name: '博客', about: '多行\n简介', timeZone: 'Asia/Shanghai', launchedAt: '2020-01-01' },
    requireCommentApproval: true,
    media: [
      {
        id: MEDIA_ID,
        name: 'a.webp',
        alt: '图',
        description: '',
        sha256: sha256(IMAGE),
        byteSize: IMAGE.length,
        width: 1,
        height: 1,
        createdAt: '2026-10-16T20:00:05.715Z',
        deleted: false,
        base64: IMAGE.toString('base64'),
      },
    ],
  }
}

const sorted = (pack) => ({ ...pack, posts: [...pack.posts].sort((a, b) => a.sourceId - b.sourceId) })

test('内容包往返无损，正文、换行与特殊字符逐字保留', () => {
  const pack = samplePack()
  const files = packToFiles(pack)
  assert.deepEqual(filesToPack(files), sorted(pack))
  assert.ok(files.has('posts/hello-world.md'))
  assert.ok(files.has('posts/post-1.md'))
  assert.ok(files.has('flashes/2026-10-16-197f6b8e.md'))
  assert.ok(files.has(`media/${MEDIA_ID}.webp`))
  assert.match(files.get('posts/hello-world.md'), /^---\nsourceId: 2\n/)
})

test('Markdown 读取兼容编辑器补的换行与 CRLF 文件', () => {
  const text = writeMarkdown({ title: 'a' }, '正文')
  assert.equal(readMarkdown(text, 'x').body, '正文')
  assert.equal(readMarkdown(text.replace(/\n/g, '\r\n'), 'x').body, '正文')
  assert.equal(readMarkdown(writeMarkdown({ title: 'a' }, 'a\r\nb'), 'x').body, 'a\r\nb')
  assert.throws(() => readMarkdown('无 frontmatter', 'posts/x.md'), /posts\/x\.md/)
})

test('同名文件自动加编号区分', () => {
  const pack = samplePack()
  pack.posts[1].values.slug = 'hello-world'
  const files = packToFiles(pack)
  assert.ok(files.has('posts/hello-world.md') && files.has('posts/hello-world-2.md'))
  assert.deepEqual(filesToPack(files), sorted(pack))
})

test('媒体字节或摘要被改动、文件缺失或未登记时拒绝打包', () => {
  const files = packToFiles(samplePack())
  const path = `media/${MEDIA_ID}.webp`
  const tampered = new Map(files).set(path, Buffer.concat([IMAGE.subarray(0, -1), Buffer.from([0])]))
  assert.throws(() => filesToPack(tampered), /SHA-256/)
  const missing = new Map(files)
  missing.delete(path)
  assert.throws(() => filesToPack(missing), /缺少媒体文件/)
  const extra = new Map(files).set('media/11111111-2222-4333-8444-555555555555.webp', IMAGE)
  assert.throws(() => filesToPack(extra), /未在 media\/index\.yaml 登记/)
})

test('未知字段与无法识别的文件不静默丢弃', () => {
  assert.throws(() => packToFiles({ ...samplePack(), future: [] }), /未知字段 future/)
  const pack = samplePack()
  pack.posts[0].values.sourceId = 9
  assert.throws(() => packToFiles(pack), /重名/)
  const files = new Map(packToFiles(samplePack())).set('posts/notes.txt', 'x')
  assert.throws(() => filesToPack(files), /无法识别/)
})

test('命令行导出、重新导出与打包；不覆盖非仓库目录', () => {
  const root = mkdtempSync(join(tmpdir(), 'content-repo-'))
  try {
    const packFile = join(root, 'pack.json')
    writeFileSync(packFile, JSON.stringify(samplePack()))
    const repo = join(root, 'repo')
    main(['export', '--pack', packFile, '--out', repo])
    writeFileSync(join(repo, 'README.md'), '自己的说明')
    mkdirSync(join(repo, '.git'))
    writeFileSync(join(repo, 'posts', '.DS_Store'), 'x')
    // 后台删掉一篇后重新导出：对应文件被删除，仓库自有文件保留
    const smaller = samplePack()
    smaller.posts = smaller.posts.filter((post) => post.sourceId === 2)
    writeFileSync(packFile, JSON.stringify(smaller))
    main(['export', '--pack', packFile, '--out', repo])
    assert.ok(!existsSync(join(repo, 'posts', 'post-1.md')))
    assert.equal(readFileSync(join(repo, 'README.md'), 'utf8'), '自己的说明')
    assert.ok(existsSync(join(repo, '.git')))
    assert.ok(!readRepo(repo).has('README.md'))
    const out = join(root, 'out.json')
    main(['pack', '--dir', repo, '--out', out])
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), smaller)
    assert.throws(() => main(['pack', '--dir', repo, '--out', out]), /--force/)
    const other = join(root, 'other')
    mkdirSync(other)
    writeFileSync(join(other, 'keep.txt'), 'x')
    assert.throws(() => main(['export', '--pack', packFile, '--out', other]), /不是空目录/)
    assert.equal(readFileSync(join(other, 'keep.txt'), 'utf8'), 'x')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
