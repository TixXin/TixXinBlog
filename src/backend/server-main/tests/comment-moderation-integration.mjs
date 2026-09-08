/**
 * @file comment-moderation-integration.mjs
 * @description 在隔离数据库中验收审核策略、三级可见性、计数、并发确认和点赞权限。
 */
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  const session = await fetch(`${fixture.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  const token = (await session.json()).data.accessToken
  let writes = 0
  async function request(path, method = 'GET', body, admin = true) {
    if (method !== 'GET' && ++writes % 7 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': 'isolated-moderation-visitor',
        ...(admin ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(path, method = 'GET', body, admin = true) {
    const response = await request(path, method, body, admin)
    assert(response.status < 300, `${path}: ${response.status} ${JSON.stringify(response.body)}`)
    return response.body.data
  }
  const post = await ok('/admin/posts', 'POST', { title: '审核隔离文章', contentRaw: '正文', status: 'published' })
  const create = (content, parentId) =>
    ok(`/posts/${post.id}/comments`, 'POST', { author: '审核访客', content, parentId }, false)
  const context = (id) => ok(`/admin/comments/${id}/context`)
  async function moderate(id, status) {
    const preview = await context(id)
    return ok(`/admin/comments/${id}/moderation`, 'POST', {
      status,
      revision: preview.target.revision,
      expectedFingerprint: preview.deleteFingerprint,
    })
  }
  async function count(expected) {
    const tree = await ok(`/posts/${post.id}/comments`, 'GET', undefined, false)
    const sum = (items) => items.reduce((total, item) => total + 1 + sum(item.replies), 0)
    assert.equal(tree.total, expected)
    assert.equal(sum(tree.items), expected)
    assert.equal((await ok(`/posts/${post.id}`)).comments, expected)
    const metadata = await ok('/posts/metadata')
    assert.equal(metadata.stats.comments, expected)
    assert.equal(metadata.activity.length, 105)
    assert.equal(
      metadata.activity.reduce((total, day) => total + day.comments, 0),
      expected,
    )
    assert.equal((await ok('/admin/overview')).counts.publicComments, expected)
  }
  assert.equal((await request('/admin/comments/policy', 'GET', undefined, false)).status, 401)
  const policy = await ok('/admin/comments/policy')
  assert.equal(policy.requireApproval, false)
  assert.equal(policy.notification, 'not_configured')
  const root = await create('公开根评论')
  const child = await create('公开一级回复', root.id)
  const leaf = await create('公开二级回复', child.id)
  await count(3)
  assert.equal((await context(root.id)).approvedVisibleTotal, 3)
  await moderate(root.id, 'hidden')
  await count(0)
  assert.equal((await request(`/comments/${child.id}/like`, 'POST', undefined, false)).status, 404)
  assert.equal(
    (
      await request(
        `/posts/${post.id}/comments`,
        'POST',
        { author: '访客', content: '不应插入', parentId: child.id },
        false,
      )
    ).status,
    404,
  )
  assert.equal((await ok(`/admin/comments?postId=${post.id}&status=published`)).total, 2)
  assert((await ok(`/admin/comments?postId=${post.id}`)).items.every((item) => !item.visible))
  await moderate(child.id, 'spam')
  assert.equal((await context(root.id)).approvedVisibleTotal, 1)
  await moderate(root.id, 'published')
  await count(1)
  await moderate(child.id, 'published')
  await count(3)
  await ok(`/comments/${leaf.id}/like`, 'POST', undefined, false)
  const settings = await ok('/admin/comments/policy', 'PATCH', { requireApproval: true, revision: policy.revision })
  assert.equal(settings.requireApproval, true)
  assert.equal(
    (await request('/admin/comments/policy', 'PATCH', { requireApproval: false, revision: policy.revision })).status,
    409,
  )
  const queued = await create('需要审核的新评论')
  assert.equal(queued.moderationStatus, 'pending')
  await count(3)
  assert.equal((await ok('/admin/comments?status=pending')).total, 1)
  const overview = await ok('/admin/overview')
  assert.equal(overview.counts.pendingComments, 1)
  const owner = await ok(`/admin/comments/${root.id}/reply`, 'POST', { content: '博主不需审核' })
  assert.equal(owner.isOwner, true)
  await count(4)
  await moderate(queued.id, 'published')
  await count(5)
  assert.equal((await ok('/admin/overview')).counts.pendingComments, 0)
  // 同一范围但另一条评论状态变化也会使旧确认失效。
  const oldScope = await context(root.id)
  await moderate(leaf.id, 'hidden')
  assert.equal(
    (
      await request(`/admin/comments/${root.id}/moderation`, 'POST', {
        status: 'spam',
        revision: oldScope.target.revision,
        expectedFingerprint: oldScope.deleteFingerprint,
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await request(
        `/admin/comments/${root.id}?expectedTotal=${oldScope.deleteTotal}&expectedFingerprint=${oldScope.deleteFingerprint}`,
        'DELETE',
      )
    ).status,
    409,
  )
  assert.equal((await request(`/admin/comments/${root.id}`, 'DELETE')).status, 400)
  const latest = await context(root.id)
  assert.equal(
    (
      await ok(
        `/admin/comments/${root.id}?expectedTotal=${latest.deleteTotal}&expectedFingerprint=${latest.deleteFingerprint}`,
        'DELETE',
      )
    ).deleted,
    4,
  )
  await count(1)
  assert.equal((await request('/admin/comments?from=2026-02-31')).status, 400)
  assert.equal((await request('/admin/comments?from=2026-10-01&to=2026-09-01')).status, 400)
  assert.equal((await ok(`/admin/comments?postId=${post.id}&search=需要审核`)).total, 1)
  assert.equal((await ok('/admin/comments?from=2000-01-01&to=2000-01-02')).total, 0)
  process.stdout.write(
    '评论审核集成通过：策略持久化与并发、三级可见性与计数、垃圾回复保持、匿名权限、上下文指纹、删除范围保护及日期筛选\n',
  )
} finally {
  await fixture.close()
}
