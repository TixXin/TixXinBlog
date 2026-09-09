/** @file guestbook-integration.mjs @description 独立留言接口的权限、去重、引用隐私、游标、置顶、回应和媒体事务回归 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
let checks = 0
try {
  const visitor = randomUUID(),
    other = randomUUID()
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  async function request(path, method = 'GET', body, admin = false, identity = visitor) {
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
  async function ok(path, method = 'GET', body, admin = false, identity = visitor) {
    const result = await request(path, method, body, admin, identity)
    assert(result.status < 300, `${method} ${path}: ${result.status} ${JSON.stringify(result.body)}`)
    return result.body.data
  }
  assert.equal((await request('/admin/guestbook')).status, 401)
  assert.equal((await request('/admin/guestbook', 'POST', { content: '越权', requestId: randomUUID() })).status, 401)
  for (const invalid of [
    { isOwner: true },
    { createdAt: '2026-01-01' },
    { status: 'published' },
    { content: 'x'.repeat(501) },
    { avatar: 'javascript:alert(1)' },
    { replyToId: -1 },
    { requestId: 'invalid' },
  ])
    assert.equal(
      (
        await request('/guestbook', 'POST', {
          author: '小林',
          content: '一条留言',
          requestId: randomUUID(),
          ...invalid,
        })
      ).status,
      400,
    )
  assert.equal((await ok('/guestbook')).total, 0)
  assert.equal((await ok('/guestbook/metadata')).stats.messages, 0)
  const media = new FormData()
  media.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'guestbook.png')
  const image = await ok('/admin/media', 'POST', media, true)
  const body = { author: '小林', avatar: image.url, content: '100% 欢迎交流', requestId: randomUUID() }
  const [first, repeated] = await Promise.all([ok('/guestbook', 'POST', body), ok('/guestbook', 'POST', body)])
  assert.equal(first.id, repeated.id)
  assert.equal(first.isOwner, false)
  assert.equal((await request('/guestbook', 'POST', { ...body, content: '换正文重试' })).status, 409)
  const reply = await ok(
    '/admin/guestbook',
    'POST',
    { content: '谢谢你的留言', replyToId: first.id, requestId: randomUUID() },
    true,
  )
  assert.equal(reply.isOwner, true)
  assert.equal(reply.author, (await ok('/site')).ownerName)
  assert.equal(reply.replyTo.id, first.id)
  const firstAdmin = await ok(`/admin/guestbook/${first.id}`, 'GET', undefined, true)
  const pinFirst = await ok(
    `/admin/guestbook/${first.id}`,
    'PATCH',
    { isPinned: true, revision: firstAdmin.revision },
    true,
  )
  assert.equal((await ok('/guestbook/metadata')).pinned.id, first.id)
  await ok(`/admin/guestbook/${reply.id}`, 'PATCH', { isPinned: true, revision: reply.revision }, true)
  const unpinned = await ok(`/admin/guestbook/${first.id}`, 'GET', undefined, true)
  assert.equal(unpinned.isPinned, false)
  assert.equal(unpinned.revision, pinFirst.revision + 1)
  assert.equal(
    (await request(`/admin/guestbook/${first.id}`, 'PATCH', { status: 'hidden', revision: pinFirst.revision }, true))
      .status,
    409,
  )
  const hidden = await ok(
    `/admin/guestbook/${first.id}`,
    'PATCH',
    { status: 'hidden', revision: unpinned.revision },
    true,
  )
  assert.equal((await request(`/guestbook/${first.id}`)).status, 404)
  const safeReply = await ok(`/guestbook/${reply.id}`)
  assert.equal(safeReply.replyTo, null)
  assert.equal(safeReply.replyUnavailable, true)
  assert(!JSON.stringify(safeReply).includes(body.content))
  assert.equal(
    (
      await request('/guestbook', 'POST', {
        author: '其他访客',
        content: '不能引用隐藏内容',
        replyToId: first.id,
        requestId: randomUUID(),
      })
    ).status,
    404,
  )
  assert.equal((await request('/guestbook', 'POST', body)).status, 409)
  assert.equal((await ok(`/admin/guestbook/${reply.id}`, 'GET', undefined, true)).replyTo.content, body.content)
  await ok(`/admin/guestbook/${first.id}`, 'PATCH', { status: 'published', revision: hidden.revision }, true)
  const policy = await ok('/admin/comments/policy', 'GET', undefined, true)
  await ok('/admin/comments/policy', 'PATCH', { requireApproval: true, revision: policy.revision }, true)
  const pendingBody = { author: '晨曦', content: '等待审核', requestId: randomUUID() }
  const pending = await ok('/guestbook', 'POST', pendingBody)
  assert.equal(pending.moderationStatus, 'pending')
  assert.equal((await ok('/guestbook')).total, 3)
  assert.equal((await ok('/guestbook', 'GET', undefined, false, other)).total, 2)
  assert.equal((await request(`/guestbook/${pending.id}`, 'GET', undefined, false, other)).status, 404)
  assert.equal((await ok('/guestbook/metadata')).stats.messages, 2)
  assert.equal((await request(`/guestbook/${pending.id}/reactions`, 'PUT', { emoji: '👍', reacted: true })).status, 404)
  const reactions = await Promise.all([
    ok(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: '👍', reacted: true }),
    ok(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: '👍', reacted: true }),
  ])
  assert(reactions.every((item) => item.reactions[0].count === 1 && item.reactions[0].reacted))
  assert.equal((await ok(`/guestbook/${first.id}`, 'GET', undefined, false, other)).reactions[0].reacted, false)
  await ok(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: '❤️', reacted: true })
  await ok(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: '👍', reacted: false })
  assert.equal(
    (await ok(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: '👍', reacted: false })).reactions.length,
    1,
  )
  assert.equal(
    (await request(`/guestbook/${first.id}/reactions`, 'PUT', { emoji: 'unknown', reacted: true })).status,
    400,
  )
  assert.equal((await ok('/guestbook?q=%25')).total, 1)
  assert.equal((await request('/guestbook?date=2026-02-30')).status, 400)
  assert.equal((await request('/guestbook?before=broken')).status, 400)
  assert.equal((await request('/guestbook/99999999999999999')).status, 400)
  for (let index = 0; index < 23; index++)
    await ok('/admin/guestbook', 'POST', { content: `分页留言 ${index}`, requestId: randomUUID() }, true)
  // 同一时间戳依靠编号稳定排序，新插入的较新留言不能让后续页重复或漏读。
  await fixture.testOrm.em.fork().execute("update guestbook_message set created_at='2000-01-01T00:00:00.000Z'")
  const page1 = await ok('/guestbook?pageSize=10', 'GET', undefined, false, other)
  await ok('/admin/guestbook', 'POST', { content: '翻页期间新留言', requestId: randomUUID() }, true)
  const page2 = await ok('/guestbook?pageSize=10&before=' + page1.nextCursor, 'GET', undefined, false, other)
  const page3 = await ok('/guestbook?pageSize=10&before=' + page2.nextCursor, 'GET', undefined, false, other)
  assert.equal(new Set([...page1.items, ...page2.items, ...page3.items].map((item) => item.id)).size, 25)
  const orderedIds = [...page1.items, ...page2.items, ...page3.items].map((item) => item.id)
  assert.deepEqual(
    orderedIds,
    [...orderedIds].sort((a, b) => b - a),
  )
  assert.equal(page3.nextCursor, null)
  assert.equal((await request('/guestbook?q=changed&before=' + page1.nextCursor)).status, 400)
  const meta = await ok('/guestbook/metadata')
  assert.equal(meta.stats.messages, 26)
  assert.equal(meta.stats.members, 2)
  assert(!JSON.stringify(meta).includes(visitor))
  assert(!JSON.stringify(meta).includes('visitorIdHash'))
  assert(!JSON.stringify(meta).includes('isOnline'))
  const references = await ok(`/admin/media/${image.id}/references`, 'GET', undefined, true)
  assert.equal(references.items[0].url, `/admin/guestbook?focus=${first.id}`)
  assert.equal((await request(`/admin/media/${image.id}`, 'DELETE', undefined, true)).status, 409)
  const latest = await ok(`/admin/guestbook/${first.id}`, 'GET', undefined, true)
  await ok(`/admin/guestbook/${first.id}?revision=${latest.revision}`, 'DELETE', undefined, true)
  await ok(`/admin/guestbook/${first.id}?revision=${latest.revision}`, 'DELETE', undefined, true)
  assert.equal((await request('/guestbook', 'POST', body)).status, 409)
  assert.equal((await ok(`/guestbook/${reply.id}`)).replyTo, null)
  assert.equal((await ok(`/admin/media/${image.id}/references`, 'GET', undefined, true)).total, 0)
  await ok(`/admin/media/${image.id}`, 'DELETE', undefined, true)
  const audit = await ok('/admin/audit?action=guestbook.delete', 'GET', undefined, true)
  assert(audit.items.some((item) => item.state === 'success'))
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    `留言板隔离集成通过：${checks}个请求，覆盖权限、提交去重、引用隐私、审核置顶、回应、游标和媒体\n`,
  )
} finally {
  await fixture.close()
}
