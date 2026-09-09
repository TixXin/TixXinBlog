/** @file moment-integration.mjs @description 隔离库验证朋友圈权限、持久化、去重、分页、审核、媒体与删除 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createRequire } from 'node:module'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
let checks = 0
try {
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  const visitor = randomUUID(),
    other = randomUUID()
  async function request(path, method = 'GET', body, admin = true, identity = visitor) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: {
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          'X-Visitor-Id': identity,
          ...(admin ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      })
      const data = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      checks++
      return { status: response.status, body: data }
    }
  }
  async function ok(path, method = 'GET', body, admin = true, identity = visitor) {
    const response = await request(path, method, body, admin, identity)
    assert(response.status < 300, `${method} ${path}: ${response.status} ${JSON.stringify(response.body)}`)
    return response.body.data
  }
  assert.equal((await request('/admin/moments', 'GET', undefined, false)).status, 401)
  assert.equal((await request('/admin/moments', 'POST', { content: '越权' }, false)).status, 401)
  assert.equal(
    (await request('/admin/moments', 'POST', { content: '非法身份', requestId: randomUUID(), isOwner: true })).status,
    400,
  )
  for (const invalid of [
    { content: null },
    { images: null },
    { status: null },
    { likes: 100 },
    { images: ['javascript:alert(1)'] },
  ])
    assert.equal(
      (await request('/admin/moments', 'POST', { content: '合法正文', requestId: randomUUID(), ...invalid })).status,
      400,
    )
  const draft = await ok('/admin/moments', 'POST', {
    content: '私有草稿',
    requestId: randomUUID(),
    status: 'draft',
    topics: ['私密'],
  })
  const archived = await ok('/admin/moments', 'POST', {
    content: '归档动态',
    requestId: randomUUID(),
    status: 'archived',
  })
  assert.equal((await request(`/moments/${draft.id}`, 'GET', undefined, false)).status, 404)
  assert.equal((await request(`/moments/${archived.id}`, 'GET', undefined, false)).status, 404)
  assert.equal((await request('/moments?status=draft', 'GET', undefined, false)).status, 400)
  assert.equal((await ok('/moments', 'GET', undefined, false)).total, 0)
  assert.equal((await ok('/moments/overview', 'GET', undefined, false)).stats.totalMoments, 0)

  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'moment.png')
  form.append('alt', '真实动态配图')
  const image = await ok('/admin/media', 'POST', form)
  const post = (await ok('/posts?pageSize=1', 'GET', undefined, false)).items[0]
  const input = {
    content: '公开动态 100% 内容',
    requestId: randomUUID(),
    status: 'published',
    topics: [' #技术 ', '技术'],
    images: [image.url],
    linkedArticleId: post.id,
  }
  const [first, duplicate] = await Promise.all([
    ok('/admin/moments', 'POST', input),
    ok('/admin/moments', 'POST', input),
  ])
  assert.equal(first.id, duplicate.id)
  assert.equal((await ok('/moments', 'GET', undefined, false)).total, 1)
  assert.equal((await request('/admin/moments', 'POST', { ...input, content: '不同正文' })).status, 409)
  const published = await ok(`/moments/${first.id}`, 'GET', undefined, false)
  assert.equal(published.content, input.content)
  assert.deepEqual(published.topics, ['技术'])
  assert.equal(published.imageAlts[0], '真实动态配图')
  assert.equal(published.linkedArticle.id, String(post.id))
  assert(!('requestId' in published))
  assert(!('revision' in published))
  assert(!('status' in published))
  const second = await ok('/admin/moments', 'POST', {
    content: '第二条公开动态',
    requestId: randomUUID(),
    status: 'published',
  })
  const pinned = await ok(`/admin/moments/${first.id}`, 'PATCH', { revision: first.revision, isPinned: true })
  assert.equal((await ok('/moments?pageSize=1', 'GET', undefined, false)).items[0].id, first.id)
  assert.equal((await ok('/moments?pageSize=1&page=2', 'GET', undefined, false)).items[0].id, second.id)
  assert.equal((await ok('/moments?q=%25', 'GET', undefined, false)).total, 1)
  assert.equal((await ok('/moments?topic=' + encodeURIComponent('技术'), 'GET', undefined, false)).total, 1)
  assert.equal((await ok('/moments?date=' + first.date.slice(0, 10), 'GET', undefined, false)).total, 2)
  assert.equal((await request('/moments?date=2026-02-30', 'GET', undefined, false)).status, 400)
  assert.equal(
    (await request(`/admin/moments/${first.id}`, 'PATCH', { revision: first.revision, content: '旧版本覆盖' })).status,
    409,
  )
  const likes = await Promise.all([
    ok(`/moments/${first.id}/like`, 'PUT', { liked: true }, false),
    ok(`/moments/${first.id}/like`, 'PUT', { liked: true }, false),
  ])
  assert(likes.every((value) => value.likes === 1 && value.isLiked))
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false, other)).isLiked, false)
  await ok(`/moments/${first.id}/like`, 'PUT', { liked: false }, false)
  assert.equal((await ok(`/moments/${first.id}/like`, 'PUT', { liked: false }, false)).likes, 0)

  const commentInput = { requestId: randomUUID(), author: '访客', avatar: image.url, content: '重试一次的评论' }
  const comments = await Promise.all([
    ok(`/moments/${first.id}/comments`, 'POST', commentInput, false),
    ok(`/moments/${first.id}/comments`, 'POST', commentInput, false),
  ])
  assert.equal(comments[0].id, comments[1].id)
  assert.equal(comments[0].isOwner, false)
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false)).commentCount, 1)
  assert.equal(
    (
      await request(
        `/moments/${first.id}/comments`,
        'POST',
        { ...commentInput, requestId: randomUUID(), isOwner: true },
        false,
      )
    ).status,
    400,
  )
  const policy = await ok('/admin/comments/policy')
  await ok('/admin/comments/policy', 'PATCH', { requireApproval: true, revision: policy.revision })
  const pending = await ok(
    `/moments/${first.id}/comments`,
    'POST',
    { requestId: randomUUID(), author: '待审访客', content: '需要审核' },
    false,
  )
  assert.equal(pending.moderationStatus, 'pending')
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false)).total, 2)
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false, other)).total, 1)
  assert.equal((await ok('/moments/overview', 'GET', undefined, false)).stats.totalComments, 1)
  await ok(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', { status: 'published' })
  const site = await ok('/site', 'GET', undefined, false)
  const reply = await ok(`/admin/moments/${first.id}/comments`, 'POST', {
    requestId: randomUUID(),
    content: '博主回复',
  })
  assert.equal(reply.isOwner, true)
  assert.equal(reply.author, site.ownerName)
  await ok(`/admin/moments/${first.id}/comments`, 'POST', { requestId: randomUUID(), content: '第四条评论' })
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false)).comments.length, 3)
  const commentPage1 = await ok(`/moments/${first.id}/comments?pageSize=2`, 'GET', undefined, false)
  const commentPage2 = await ok(`/moments/${first.id}/comments?pageSize=2&page=2`, 'GET', undefined, false)
  assert.equal(commentPage1.total, 4)
  assert.equal(new Set([...commentPage1.items, ...commentPage2.items].map((item) => item.id)).size, 4)
  await ok(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', { status: 'hidden' })
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false)).total, 3)
  assert.equal((await ok('/moments/overview', 'GET', undefined, false)).stats.totalComments, 3)
  const references = await ok(`/admin/media/${image.id}/references`)
  assert.equal(references.total, 2)
  assert(references.items.every((item) => item.url.startsWith('/admin/moments?edit=')))
  assert.equal((await request(`/admin/media/${image.id}`, 'DELETE')).status, 409)
  const hiddenPost = await ok(`/admin/posts/${post.id}`)
  await ok(`/admin/posts/${post.id}`, 'PATCH', {
    title: hiddenPost.title,
    contentRaw: hiddenPost.contentRaw,
    revision: hiddenPost.revision,
    status: 'draft',
  })
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false)).linkedArticle, null)
  const overview = await ok('/moments/overview', 'GET', undefined, false)
  assert.equal(overview.stats.totalMoments, 2)
  assert.equal(overview.topics.find((topic) => topic.name === '技术').count, 1)
  assert.equal(overview.photos[0].momentId, first.id)
  assert.equal(overview.dates[0].count, 2)
  const edited = await ok(`/admin/moments/${first.id}`, 'PATCH', { revision: pinned.revision, images: [] })
  assert.equal((await ok(`/admin/media/${image.id}/references`)).total, 1)
  await ok(`/admin/moments/${first.id}/comments/${comments[0].id}`, 'DELETE')
  assert.equal((await request(`/moments/${first.id}/comments`, 'POST', commentInput, false)).status, 409)
  assert.equal((await ok(`/admin/media/${image.id}/references`)).total, 0)
  await ok(`/admin/media/${image.id}`, 'DELETE')
  assert.equal(
    (await request(`/admin/moments/${second.id}`, 'PATCH', { revision: second.revision, images: [image.url] })).status,
    409,
  )
  await ok(`/admin/moments/${first.id}?revision=${edited.revision}`, 'DELETE')
  await ok(`/admin/moments/${first.id}?revision=${edited.revision}`, 'DELETE')
  assert.equal((await request(`/moments/${first.id}`, 'GET', undefined, false)).status, 404)
  assert.equal((await request('/admin/moments', 'POST', input)).status, 409)
  assert.equal((await request(`/moments/${draft.id}/like`, 'PUT', { liked: true }, false)).status, 404)
  const audit = await ok('/admin/audit?action=moment.delete')
  assert(audit.items.some((item) => item.state === 'success'))

  const require = createRequire(import.meta.url)
  const { MikroORM } = require('@mikro-orm/postgresql')
  const { mikroOrmOptions } = require('../dist/config/mikro-orm.options.js')
  const orm = await MikroORM.init({ ...mikroOrmOptions, clientUrl: process.env.DATABASE_URL, debug: false })
  try {
    assert.equal((await orm.getSchemaGenerator().getUpdateSchemaSQL({ wrap: false })).trim(), '')
  } finally {
    await orm.close(true)
  }
  process.stdout.write(`朋友圈隔离集成验证通过：${checks} 个请求，含并发去重、权限、媒体和迁移结构检查\n`)
} finally {
  await fixture.close()
}
