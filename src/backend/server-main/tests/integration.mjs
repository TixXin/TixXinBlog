/**
 * @file integration.mjs
 * @description 真实 HTTP/数据库回归，创建独立临时数据库，绝不重置项目数据库
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { createMediaTestDirectory } from './media-directory.mjs'

const require = createRequire(import.meta.url)
require('reflect-metadata')
const { loadLocalEnvironment } = require('../dist/config/environment.js')
loadLocalEnvironment()
const baseUrl = new URL(process.env.DATABASE_URL)
assert(['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname), '集成测试仅允许本机 PostgreSQL')
const { MikroORM } = require('@mikro-orm/postgresql')
const { mikroOrmOptions } = require('../dist/config/mikro-orm.options.js')
const adminOrm = await MikroORM.init({ ...mikroOrmOptions, debug: false })
const database = `tixxin_integration_${Date.now()}_${process.pid}`
assert(/^tixxin_integration_\d+_\d+$/.test(database))
let app
let createdDatabase = false
const mediaDirectory = createMediaTestDirectory()
process.env.MEDIA_DIRECTORY = mediaDirectory.directory

try {
  await adminOrm.em.getConnection().execute(`create database "${database}"`)
  createdDatabase = true
  const testUrl = new URL(baseUrl)
  testUrl.pathname = `/${database}`
  process.env.DATABASE_URL = testUrl.toString()
  process.env.NODE_ENV = 'test'
  process.env.LOG_LEVEL = 'silent'
  process.env.JWT_ACCESS_SECRET = randomBytes(48).toString('hex')
  const { NestFactory } = require('@nestjs/core')
  const { JwtService } = require('@nestjs/jwt')
  const { AppModule } = require('../dist/app.module.js')
  const { configureApplication } = require('../dist/bootstrap.js')
  app = await NestFactory.create(AppModule, { logger: false })
  configureApplication(app)
  const orm = app.get(MikroORM)
  orm.config.set('migrations', { ...orm.config.get('migrations'), snapshot: false })
  await orm.getMigrator().up()
  const em = orm.em.fork()
  const { AdminUser } = require('../dist/entities/admin-user.entity.js')
  const { Post } = require('../dist/entities/post.entity.js')
  const argon2 = require('argon2')
  const password = 'integration-only-password'
  await em.persistAndFlush(
    em.create(AdminUser, {
      username: 'integration-admin',
      passwordHash: await argon2.hash(password),
      createdAt: new Date(),
    }),
  )
  await app.listen(0, '127.0.0.1')
  const origin = await app.getUrl()

  async function request(path, { method = 'GET', body, token, cookie, visitor = 'integration-visitor' } = {}) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': visitor,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      retryAfter: response.headers.get('retry-after'),
    }
  }

  assert.equal((await request('/api/v1/admin/posts')).status, 401)
  const login = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { username: 'integration-admin', password },
  })
  assert.equal(login.status, 200)
  const jwt = app.get(JwtService)
  await jwt.verifyAsync(login.body.data.accessToken, { secret: process.env.JWT_ACCESS_SECRET })
  const rotations = await Promise.all(
    [0, 1].map(() => request('/api/v1/auth/refresh', { method: 'POST', cookie: login.cookie })),
  )
  assert.deepEqual(rotations.map((item) => item.status).sort(), [200, 401], '同一 refresh token 只能成功消费一次')
  const session = rotations.find((item) => item.status === 200)
  const token = session.body.data.accessToken
  assert.equal((await request('/api/v1/auth/refresh', { method: 'POST', cookie: login.cookie })).status, 401)

  const draft = {
    title: '集成测试文章',
    contentRaw: '# 第一节\n\n正文 **加粗**\n\n```text\n<example>\n```',
    status: 'draft',
    tags: ['集成测试'],
  }
  const saved = await request('/api/v1/admin/posts', { method: 'POST', token, body: draft })
  assert.equal(saved.status, 201, JSON.stringify(saved.body))
  const id = saved.body.data.id
  assert.equal((await request(`/api/v1/posts/${id}`)).status, 404)
  assert.equal(
    (
      await request(`/api/v1/admin/posts/${id}`, {
        method: 'PATCH',
        token,
        body: { ...draft, revision: saved.body.data.revision, status: 'published' },
      })
    ).status,
    200,
  )
  const detail = await request(`/api/v1/posts/${id}`)
  assert.equal(detail.status, 200)
  assert.equal(detail.body.data.toc[0].id, 'heading-1')
  assert.equal(detail.body.data.contentRaw, draft.contentRaw)
  assert.equal(
    (
      await request(`/api/v1/admin/posts/${id}`, {
        method: 'PATCH',
        token,
        body: { ...draft, title: '旧版本覆盖尝试', revision: saved.body.data.revision },
      })
    ).status,
    409,
  )
  assert.equal((await request(`/api/v1/admin/posts/${id}`, { method: 'PATCH', token, body: draft })).status, 428)
  const initialHistory = await request(`/api/v1/admin/posts/${id}/revisions`, { token })
  assert.equal(initialHistory.body.data.total, 2)
  assert.equal((await request(`/api/v1/admin/posts/${id}/revisions/1`, { token })).body.data.snapshot.status, 'draft')
  assert.equal((await request(`/api/v1/admin/posts/${id}/revisions`)).status, 401)

  for (let i = 0; i < 105; i += 1) {
    em.create(Post, {
      title: `分页测试 ${i}`,
      summary: '',
      category: 'tech',
      folder: '分页测试',
      readTimeMinutes: 1,
      status: 'published',
      publishedAt: new Date('2026-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      likes: 0,
      commentCount: 0,
      pinned: false,
    })
  }
  await em.flush()
  await em.execute('insert into post_folder(label) select distinct folder from post on conflict(label) do nothing')
  const page = await request('/api/v1/posts?page=6&pageSize=20')
  assert.equal(page.body.data.total, 106)
  assert.equal(page.body.data.items.length, 6)
  const metadata = await request('/api/v1/posts/metadata')
  assert.equal(metadata.body.data.stats.posts, 106)
  assert.equal((await request('/api/v1/admin/overview')).status, 401)
  const overview = await request('/api/v1/admin/overview', { token })
  assert.equal(overview.status, 200)
  assert.equal(overview.body.data.counts.published, 106)
  assert.equal(overview.body.data.recentContent.length, 12)
  assert.equal((await request('/api/v1/admin/posts/filters')).status, 401)
  const filters = await request('/api/v1/admin/posts/filters', { token })
  assert(filters.body.data.tags.includes('集成测试'))
  const filtered = await request(
    `/api/v1/admin/posts?${new URLSearchParams({ category: 'life', tag: '集成测试', status: 'published', sort: 'title', order: 'asc' })}`,
    { token },
  )
  assert.equal(filtered.body.data.total, 1)
  assert.equal(filtered.body.data.items[0].id, id)
  assert.deepEqual(filtered.body.data.items[0].tags, ['集成测试'])
  assert.equal((await request('/api/v1/admin/posts?sort=invalid', { token })).status, 400)
  assert.equal(metadata.body.data.tags.find((tag) => tag.label === '集成测试').count, 1)
  assert.equal((await request('/api/v1/admin/taxonomy')).status, 401)
  const taxonomy = (await request('/api/v1/admin/taxonomy', { token })).body.data
  const folderId = taxonomy.folders.find((item) => item.label === '随笔日记').id
  const tagId = taxonomy.tags.find((item) => item.label === '集成测试').id
  assert.equal((await request(`/api/v1/admin/taxonomy/folders/${folderId}`, { method: 'DELETE', token })).status, 409)
  assert.equal((await request(`/api/v1/admin/taxonomy/tags/${tagId}`, { method: 'DELETE', token })).status, 409)
  await delay(1100)
  assert.equal(
    (
      await request(`/api/v1/admin/taxonomy/folders/${folderId}`, {
        method: 'PATCH',
        token,
        body: { label: '集成专栏重命名' },
      })
    ).status,
    200,
  )
  assert.equal((await request(`/api/v1/admin/posts/${id}`, { token })).body.data.folder, '集成专栏重命名')
  assert.equal((await request(`/api/v1/posts?${new URLSearchParams({ folder: '集成专栏重命名' })}`)).body.data.total, 1)
  assert.equal(
    (
      await request(`/api/v1/admin/taxonomy/tags/${tagId}`, {
        method: 'PATCH',
        token,
        body: { label: '集成标签重命名', color: 'rose' },
      })
    ).status,
    200,
  )
  const renamedMetadata = (await request('/api/v1/posts/metadata')).body.data
  assert.equal(renamedMetadata.tags.find((item) => item.label === '集成标签重命名').color, 'rose')
  assert(!renamedMetadata.tags.some((item) => item.label === '集成测试'))
  const staleNewDraft = await request('/api/v1/admin/posts', {
    method: 'POST',
    token,
    body: { ...draft, folder: '随笔日记' },
  })
  assert.equal(staleNewDraft.status, 201)
  assert.equal(staleNewDraft.body.data.folder, '集成专栏重命名')
  assert.deepEqual(staleNewDraft.body.data.tags, ['集成标签重命名'])
  assert.equal(
    (await request('/api/v1/admin/taxonomy/folders', { method: 'POST', token, body: { label: '随笔日记' } })).status,
    409,
  )
  assert.equal(
    (await request('/api/v1/admin/taxonomy/tags', { method: 'POST', token, body: { label: '集成标签重命名' } })).status,
    409,
  )
  assert.equal(
    (await request('/api/v1/admin/taxonomy/folders', { method: 'POST', token, body: { label: '待删除空专栏' } }))
      .status,
    201,
  )
  const emptyFolder = (await request('/api/v1/admin/taxonomy', { token })).body.data.folders.find(
    (item) => item.label === '待删除空专栏',
  )
  assert.equal(emptyFolder.total, 0)
  assert.equal(
    (await request(`/api/v1/admin/taxonomy/folders/${emptyFolder.id}`, { method: 'DELETE', token })).status,
    200,
  )
  const navigation = await request(`/api/v1/posts/${id}/navigation`)
  assert.equal(navigation.body.data.prev, null)
  assert.notEqual(navigation.body.data.next.id, String(id))

  await delay(1100)
  const comment = await request(`/api/v1/posts/${id}/comments`, {
    method: 'POST',
    body: { author: '联调测试', content: '根评论' },
  })
  assert.equal(comment.status, 201)
  assert.equal(comment.body.data.isOwner, false)
  const commentId = comment.body.data.id
  const reply = await request(`/api/v1/posts/${id}/comments`, {
    method: 'POST',
    body: { author: '联调测试', content: '回复', parentId: commentId },
  })
  assert.equal(reply.status, 201)
  const tree = await request(`/api/v1/posts/${id}/comments`)
  assert.equal(tree.body.data.items[0].replies[0].id, reply.body.data.id)
  assert.equal(
    (
      await request(`/api/v1/posts/${id}/comments`, {
        method: 'POST',
        body: { author: 'x', content: ' ', isOwner: true },
      })
    ).status,
    400,
  )
  assert.equal((await request(`/api/v1/posts/${id}`)).body.data.comments, 2)
  assert.equal((await request(`/api/v1/admin/comments/${commentId}/context`)).status, 401)
  const commentContext = await request(`/api/v1/admin/comments/${commentId}/context`, { token })
  assert.equal(commentContext.body.data.deleteTotal, 2)
  assert.equal(commentContext.body.data.replies[0].id, reply.body.data.id)
  const replyContext = await request(`/api/v1/admin/comments/${reply.body.data.id}/context`, { token })
  assert.equal(replyContext.body.data.ancestors[0].id, commentId)
  assert.equal((await request(`/api/v1/admin/comments?postId=${id}&unanswered=true`, { token })).body.data.total, 1)
  assert.equal((await request('/api/v1/admin/comments/articles', { token })).body.data[0].id, id)
  await delay(1100)
  const publishedOwnerReply = await request(`/api/v1/admin/comments/${commentId}/reply`, {
    method: 'POST',
    token,
    body: { content: '真实博主答复' },
  })
  assert.equal(publishedOwnerReply.status, 201)
  assert.equal(publishedOwnerReply.body.data.isOwner, true)
  assert.equal((await request(`/api/v1/admin/comments?postId=${id}&unanswered=true`, { token })).body.data.total, 0)
  assert.equal((await request('/api/v1/admin/overview', { token })).body.data.counts.unanswered, 0)
  assert.equal(
    (
      await request(
        `/api/v1/admin/comments/${commentId}?expectedTotal=2&expectedFingerprint=${commentContext.body.data.deleteFingerprint}`,
        { method: 'DELETE', token },
      )
    ).status,
    409,
  )
  assert.equal((await request(`/api/v1/posts/${id}`)).body.data.comments, 3, '范围变化时拒绝删除，保留全部评论')

  await delay(1100)
  await Promise.all(
    [0, 1, 2, 3].map((index) =>
      request(`/api/v1/posts/${id}/like`, { method: 'POST', visitor: `integration-like-${index}` }),
    ),
  )
  assert.equal((await request(`/api/v1/posts/${id}`)).body.data.likes, 4)
  await Promise.all(
    [0, 1, 2, 3].map((index) =>
      request(`/api/v1/posts/${id}/like`, { method: 'POST', visitor: `integration-like-${index}` }),
    ),
  )
  assert.equal((await request(`/api/v1/posts/${id}`)).body.data.likes, 0)
  await delay(1100)
  await Promise.all([0, 1, 2, 3].map(() => request(`/api/v1/posts/${id}/view`, { method: 'POST' })))
  assert.equal((await request(`/api/v1/posts/${id}`)).body.data.views, 1)
  const beforeArchive = (await request(`/api/v1/admin/posts/${id}`, { token })).body.data.revision
  assert.equal(
    (await request(`/api/v1/admin/posts/${id}?revision=${beforeArchive}`, { method: 'DELETE', token })).status,
    200,
  )
  assert.equal((await request(`/api/v1/posts/${id}`)).status, 404)
  assert.equal((await request(`/api/v1/posts/${id}/comments`)).status, 404)
  assert.equal((await request('/api/v1/posts/metadata')).body.data.stats.posts, 105)
  assert.equal(
    (await request(`/api/v1/posts/${id}/comments`, { method: 'POST', body: { author: 'x', content: '归档后' } }))
      .status,
    422,
  )

  await delay(1100)
  const ownerReply = await request(`/api/v1/admin/comments/${commentId}/reply`, {
    method: 'POST',
    token,
    body: { content: '博主回复测试' },
  })
  // 文章已归档，管理员也不能把回复写进非公开文章。
  assert.equal(ownerReply.status, 422)
  assert.equal((await request(`/api/v1/admin/comments/${commentId}`, { method: 'DELETE' })).status, 401)
  const deletePreview = await request(`/api/v1/admin/comments/${commentId}/context`, { token })
  const deletedComments = await request(
    `/api/v1/admin/comments/${commentId}?expectedTotal=3&expectedFingerprint=${deletePreview.body.data.deleteFingerprint}`,
    {
      method: 'DELETE',
      token,
    },
  )
  assert.equal(deletedComments.status, 200)
  assert.equal(deletedComments.body.data.deleted, 3)
  assert.equal((await request('/api/v1/admin/comments', { token })).body.data.total, 0)
  await delay(1100)
  assert.equal((await request(`/api/v1/admin/posts/${id}/restore`, { method: 'POST' })).status, 401)
  const beforeRestore = (await request(`/api/v1/admin/posts/${id}`, { token })).body.data.revision
  assert.equal(
    (await request(`/api/v1/admin/posts/${id}/restore?revision=${beforeRestore}`, { method: 'POST', token })).status,
    201,
  )
  assert.equal((await request(`/api/v1/admin/posts/${id}`, { token })).body.data.status, 'draft')
  assert.equal((await request(`/api/v1/posts/${id}`)).status, 404, '恢复为草稿不得重新公开')
  const beforeHistoryRestore = (await request(`/api/v1/admin/posts/${id}`, { token })).body.data.revision
  assert.equal(
    (await request(`/api/v1/admin/posts/${id}/revisions/1/restore`, { method: 'POST', token, body: { revision: 0 } }))
      .status,
    409,
  )
  const restoredHistory = await request(`/api/v1/admin/posts/${id}/revisions/1/restore`, {
    method: 'POST',
    token,
    body: { revision: beforeHistoryRestore },
  })
  assert.equal(restoredHistory.status, 201)
  assert.equal(restoredHistory.body.data.status, 'draft')
  assert.equal(restoredHistory.body.data.folder, '集成专栏重命名')
  assert.deepEqual(restoredHistory.body.data.tags, ['集成标签重命名'])
  assert.equal(restoredHistory.body.data.revision, beforeHistoryRestore + 1)
  assert.equal((await em.fork().findOne(Post, { id })).views, 1)
  assert.equal(
    (await request(`/api/v1/admin/posts/${id}/restore?revision=${beforeRestore}`, { method: 'POST', token })).status,
    409,
  )

  await delay(1100)
  assert.equal(
    (await request('/api/v1/admin/flashes', { method: 'POST', body: { content: 'unauthorized' } })).status,
    401,
  )
  await delay(1100)
  const seoPayload = {
    title: 'SEO 验收文章',
    slug: 'integration-seo',
    contentRaw: '长正文'.repeat(15000),
    seoTitle: '定制 SEO 标题',
    seoDescription: '定制描述',
    cover: '/avatar.svg',
    coverAlt: '封面说明',
    seoNoindex: true,
    status: 'draft',
  }
  const seoDraft = await request('/api/v1/admin/posts', { method: 'POST', token, body: seoPayload })
  assert.equal(seoDraft.status, 201, '超过默认 100KB 的合法正文必须可保存')
  const seoId = seoDraft.body.data.id
  assert.equal((await request('/api/v1/posts/by-slug/integration-seo')).status, 404)
  const seoPublished = await request(`/api/v1/admin/posts/${seoId}`, {
    method: 'PATCH',
    token,
    body: { ...seoPayload, revision: seoDraft.body.data.revision, status: 'published' },
  })
  assert.equal(seoPublished.status, 200)
  const seoDetail = (await request('/api/v1/posts/by-slug/integration-seo')).body.data
  assert.equal(seoDetail.seoTitle, '定制 SEO 标题')
  assert.equal(seoDetail.coverAlt, '封面说明')
  assert.equal(seoDetail.contentRaw.length, 45000)
  assert.equal(
    (await request('/api/v1/posts/metadata')).body.data.archive.find((item) => item.id === seoId).seoNoindex,
    true,
  )
  const renamedAddress = await request(`/api/v1/admin/posts/${seoId}`, {
    method: 'PATCH',
    token,
    body: {
      ...seoPayload,
      slug: 'integration-seo-new',
      revision: seoPublished.body.data.revision,
      status: 'published',
    },
  })
  assert.equal(renamedAddress.status, 200)
  assert.equal((await request('/api/v1/posts/by-slug/integration-seo')).body.data.slug, 'integration-seo-new')
  assert.equal((await request('/api/v1/admin/posts', { method: 'POST', token, body: seoPayload })).status, 409)
  assert.equal(
    (
      await request(`/api/v1/admin/posts/${seoId}?revision=${renamedAddress.body.data.revision}`, {
        method: 'DELETE',
        token,
      })
    ).status,
    200,
  )
  assert.equal((await request('/api/v1/posts/by-slug/integration-seo')).status, 404)
  assert.equal((await request('/api/v1/posts/by-slug/integration-seo-new')).status, 404)
  await delay(1100)
  const privateFlash = await request('/api/v1/admin/flashes', {
    method: 'POST',
    token,
    body: { content: '闪念草稿测试', isDraft: true },
  })
  assert.equal(privateFlash.status, 201, JSON.stringify(privateFlash.body))
  const flashId = privateFlash.body.data.id
  assert.equal((await request(`/api/v1/admin/flashes/${flashId}`)).status, 401)
  assert.equal((await request(`/api/v1/admin/flashes/${flashId}`, { token })).body.data.isDraft, true)
  assert.equal((await request('/api/v1/admin/flashes?status=draft', { token })).body.data.total, 1)
  assert.equal((await request('/api/v1/admin/flashes?status=published', { token })).body.data.total, 0)
  assert.equal((await request('/api/v1/flashes')).body.data.total, 0)
  assert.equal((await request(`/api/v1/flashes/${flashId}`)).status, 404)
  assert.equal((await request('/api/v1/admin/flashes', { token })).body.data.total, 1)
  assert.equal(
    (
      await request(`/api/v1/admin/flashes/${flashId}`, {
        method: 'PATCH',
        token,
        body: { isDraft: false, content: '公开闪念测试' },
      })
    ).status,
    200,
  )
  assert.equal((await request('/api/v1/flashes')).body.data.total, 1)
  assert.equal((await request(`/api/v1/flashes/${flashId}`)).body.data.userId, 'tixxin')
  await delay(1100)
  await Promise.all(
    [0, 1, 2, 3].map((index) =>
      request(`/api/v1/flashes/${flashId}/like`, { method: 'POST', visitor: `integration-flash-${index}` }),
    ),
  )
  const likedFlash = await request(`/api/v1/flashes/${flashId}`, { visitor: 'integration-flash-0' })
  assert.equal(likedFlash.body.data.likes, 4)
  assert.equal(likedFlash.body.data.liked, true)
  assert.equal((await request(`/api/v1/flashes/${flashId}`)).body.data.liked, false)
  const flashComment = await request(`/api/v1/flashes/${flashId}/comments`, {
    method: 'POST',
    body: { authorName: '测试访客', content: '闪念评论测试' },
  })
  assert.equal(flashComment.status, 201)
  assert.equal(
    (
      await request(`/api/v1/admin/flashes/${flashId}/comments/${flashComment.body.data.id}`, {
        method: 'DELETE',
        token,
      })
    ).status,
    200,
  )
  assert.equal(
    (await request(`/api/v1/admin/flashes/${flashId}`, { method: 'PATCH', token, body: { isArchived: true } })).status,
    200,
  )
  assert.equal((await request('/api/v1/flashes')).body.data.total, 0)
  assert.equal((await request(`/api/v1/flashes/${flashId}`)).status, 404)
  assert.equal((await request('/api/v1/flashes?archived=true')).status, 400)
  assert.equal((await request('/api/v1/admin/flashes?archived=true', { token })).body.data.total, 1)
  assert.equal((await request('/api/v1/admin/flashes?status=all', { token })).body.data.total, 1)
  assert.equal((await request('/api/v1/admin/flashes?status=archived', { token })).body.data.total, 1)
  assert.equal((await request(`/api/v1/admin/flashes/${flashId}`, { method: 'DELETE', token })).status, 200)

  await delay(1100)
  assert.equal(
    (
      await request('/api/v1/auth/password', {
        method: 'POST',
        body: { currentPassword: password, newPassword: 'new-integration-password' },
      })
    ).status,
    401,
  )
  assert.equal(
    (
      await request('/api/v1/auth/password', {
        method: 'POST',
        token,
        body: { currentPassword: 'wrong-password', newPassword: 'new-integration-password' },
      })
    ).status,
    400,
  )
  const otherSession = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { username: 'integration-admin', password },
  })
  assert.equal(otherSession.status, 200)
  const changedPassword = randomBytes(24).toString('base64url')
  const [changed, competingRefresh] = await Promise.all([
    request('/api/v1/auth/password', {
      method: 'POST',
      token,
      body: { currentPassword: password, newPassword: changedPassword },
    }),
    request('/api/v1/auth/refresh', { method: 'POST', cookie: otherSession.cookie }),
  ])
  assert.equal(changed.status, 200)
  assert([200, 401].includes(competingRefresh.status))
  assert.equal((await request('/api/v1/admin/posts', { token })).status, 401, '当前旧 access 立即失效')
  assert.equal(
    (await request('/api/v1/admin/posts', { token: otherSession.body.data.accessToken })).status,
    401,
    '其他设备旧 access 立即失效',
  )
  if (competingRefresh.status === 200) {
    assert.equal((await request('/api/v1/admin/posts', { token: competingRefresh.body.data.accessToken })).status, 401)
    assert.equal(
      (await request('/api/v1/auth/refresh', { method: 'POST', cookie: competingRefresh.cookie })).status,
      401,
    )
  }
  assert.equal((await request('/api/v1/auth/refresh', { method: 'POST', cookie: session.cookie })).status, 401)
  await delay(1100)
  assert.equal(
    (await request('/api/v1/auth/login', { method: 'POST', body: { username: 'integration-admin', password } })).status,
    401,
  )
  const replacement = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { username: 'integration-admin', password: changedPassword },
  })
  assert.equal(replacement.status, 200)
  assert.equal((await request('/api/v1/admin/overview', { token: replacement.body.data.accessToken })).status, 200)
  const { createLoggingOptions } = require('../dist/config/logging.js')
  const pino = require(require.resolve('pino', { paths: [require.resolve('pino-http')] }))
  let capturedLog = ''
  const testLogger = pino(
    { redact: createLoggingOptions().pinoHttp.redact },
    {
      write: (chunk) => {
        capturedLog += chunk
      },
    },
  )
  testLogger.info({ req: { body: { currentPassword: 'current-password-log-marker', newPassword: changedPassword } } })
  assert(!capturedLog.includes('current-password-log-marker'))
  assert(!capturedLog.includes(changedPassword))
  assert(capturedLog.includes('[REDACTED]'))

  await delay(1100)
  const burst = await Promise.all(
    Array.from({ length: 20 }, () => request(`/api/v1/posts/${id}/comments`, { method: 'POST', body: {} })),
  )
  assert(
    burst.some((item) => item.status === 429 && item.retryAfter),
    '公开写请求必须触发 429 和 Retry-After',
  )
  assert.equal((await request('/ready')).status, 200)
  // 回放计数修复：错误基数归零，真实评论数与缓存保持一致。
  await em.getConnection().execute('update "post" set "comment_count" = 999')
  await orm.getMigrator().down({ migrations: ['20260906120000_reconcile_comment_counts'] })
  await orm.getMigrator().up()
  const mismatches = await em
    .getConnection()
    .execute(
      'select p.id from "post" p where p.comment_count <> (select count(*) from "comment" c where c.post_id = p.id)',
    )
  assert.equal(mismatches.length, 0, '迁移必须校正全部文章的历史评论计数')
  await orm.close(true)
  assert.equal((await request('/ready')).status, 503)
  process.stdout.write(
    '集成验收通过：配置密钥、刷新原子轮换、管理权限、草稿发布撤回、106 篇分页、评论管理、闪念 CRUD/隐私/并发互动、公开发现、限流和数据库就绪\n',
  )
} finally {
  if (app) await app.close()
  if (createdDatabase) {
    // 名称仅来自本次创建的固定前缀和数字，不接收外部数据库名。
    assert(/^tixxin_integration_\d+_\d+$/.test(database))
    await adminOrm.em.getConnection().execute(`drop database "${database}" with (force)`)
  }
  await adminOrm.close(true)
  mediaDirectory.cleanup()
}
