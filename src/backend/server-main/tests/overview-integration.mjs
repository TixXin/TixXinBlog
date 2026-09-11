/** @file overview-integration.mjs @description 隔离工作台计数、六域草稿、分页落点、软删除和直接回复口径验收。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
const require = createRequire(import.meta.url)
try {
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  async function request(path, method = 'GET', body, admin = true) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const result = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      return { status: response.status, body: result }
    }
  }
  async function ok(path, method = 'GET', body) {
    const result = await request(path, method, body)
    assert(result.status < 300, `${path}: ${result.status} ${JSON.stringify(result.body)}`)
    return result.body.data
  }
  assert.equal((await request('/admin/overview', 'GET', undefined, false)).status, 401)
  assert.equal((await request('/admin/moments/comments', 'GET', undefined, false)).status, 401)
  const definitions = [
    ['post', '/admin/posts', 'drafts', { title: '阅读笔记', contentRaw: '正文', status: 'draft' }],
    ['flash', '/admin/flashes', 'flashDrafts', { content: '记录灵感', isDraft: true }],
    ['moment', '/admin/moments', 'momentDrafts', { content: '周末整理', status: 'draft', requestId: randomUUID() }],
    [
      'gallery',
      '/admin/gallery',
      'galleryDrafts',
      { title: '光与影', externalUrl: 'https://example.com/photo.jpg', status: 'draft', requestId: randomUUID() },
    ],
    ['project', '/admin/projects', 'projectDrafts', { title: '笔记工具', status: 'draft', requestId: randomUUID() }],
    [
      'link',
      '/admin/links',
      'linkDrafts',
      { name: '阅读来源', url: 'https://example.com', status: 'draft', requestId: randomUUID() },
    ],
  ]
  const created = {}
  for (const [domain, path, , body] of definitions) created[domain] = await ok(path, 'POST', body)
  let overview = await ok('/admin/overview')
  assert.deepEqual(overview.unavailable, [])
  assert.equal(overview.recentContent.length, 12)
  for (const [domain, path, key] of definitions) {
    assert.equal(overview.counts[key], 1)
    assert.equal((await ok(path + '?status=draft')).total, overview.counts[key])
    assert(overview.recentContent.some((item) => item.domain === domain && item.id === String(created[domain].id)))
  }
  const em = fixture.testOrm.em.fork()
  const { GuestbookMessage } = require('../dist/entities/guestbook-message.entity.js')
  const { MomentComment } = require('../dist/entities/moment-comment.entity.js')
  const { Comment } = require('../dist/entities/comment.entity.js')
  const roots = []
  for (let index = 0; index < 21; index++)
    roots.push(
      em.create(GuestbookMessage, {
        author: '读者',
        avatar: '',
        visitorIdHash: 'reader-' + index,
        content: '感谢分享 ' + index,
      }),
    )
  const guestReply = em.create(GuestbookMessage, {
    author: '博主',
    avatar: '',
    visitorIdHash: 'owner',
    content: '谢谢交流',
    isOwner: true,
    replyTo: roots[0],
  })
  em.create(GuestbookMessage, {
    author: '博主',
    avatar: '',
    visitorIdHash: 'owner',
    content: '隐藏回复',
    isOwner: true,
    status: 'hidden',
    replyTo: roots[1],
  })
  em.create(GuestbookMessage, {
    author: '博主',
    avatar: '',
    visitorIdHash: 'owner',
    content: '已删回复',
    isOwner: true,
    deletedAt: new Date(),
    replyTo: roots[2],
  })
  for (const status of ['hidden', 'pending'])
    em.create(GuestbookMessage, { author: '读者', avatar: '', visitorIdHash: status, content: status, status })
  em.create(GuestbookMessage, {
    author: '读者',
    avatar: '',
    visitorIdHash: 'deleted',
    content: '已删除待审核',
    status: 'pending',
    deletedAt: new Date(),
  })
  em.create(GuestbookMessage, {
    author: '读者',
    avatar: '',
    visitorIdHash: 'reply',
    content: '游客回复',
    replyTo: roots[0],
  })
  for (let index = 0; index < 22; index++)
    em.create(MomentComment, {
      moment: created.moment.id,
      visitorIdHash: 'reader-' + index,
      author: '读者',
      avatar: '',
      content: '待审核评论 ' + index,
      status: 'pending',
    })
  em.create(MomentComment, {
    moment: created.moment.id,
    visitorIdHash: 'deleted',
    author: '读者',
    avatar: '',
    content: '已删除',
    status: 'pending',
    deletedAt: new Date(),
  })
  const publicPost = (await ok('/admin/posts?status=published&pageSize=1')).items[0]
  const commentRoot = em.create(Comment, {
    post: publicPost.id,
    authorSnapshot: { name: '读者', avatar: '' },
    content: '文章交流',
    status: 'published',
  })
  em.create(Comment, {
    post: publicPost.id,
    authorSnapshot: { name: '读者', avatar: '' },
    content: '待审文章评论',
    status: 'pending',
  })
  await em.flush()
  async function matching() {
    const value = await ok('/admin/overview')
    for (const [key, path] of [
      ['pendingComments', '/admin/comments?status=pending'],
      ['unanswered', '/admin/comments?unanswered=true'],
      ['pendingGuestbook', '/admin/guestbook?status=pending'],
      ['unansweredGuestbook', '/admin/guestbook?unanswered=true'],
      ['pendingMomentComments', '/admin/moments/comments?status=pending'],
    ])
      assert.equal(value.counts[key], (await ok(path)).total, key)
    return value
  }
  overview = await matching()
  assert.equal(overview.counts.pendingGuestbook, 1)
  assert.equal(overview.counts.unansweredGuestbook, 20)
  assert.equal(overview.counts.pendingMomentComments, 22)
  assert.equal(overview.counts.unanswered, 1)
  assert.equal((await ok('/admin/guestbook?unanswered=true&page=2&pageSize=15')).items.length, 5)
  assert.equal((await ok('/admin/guestbook?unanswered=true&status=pending')).total, 0)
  assert.equal((await ok('/admin/moments/comments?status=pending&page=2&pageSize=20')).items.length, 2)
  assert.equal((await request('/admin/guestbook?unanswered=invalid')).status, 400)
  assert.equal((await request('/admin/moments/comments?status=invalid')).status, 400)
  await ok(`/admin/guestbook/${guestReply.id}`, 'PATCH', { revision: guestReply.revision, status: 'hidden' })
  assert.equal((await matching()).counts.unansweredGuestbook, 21)
  const reply = await ok('/admin/guestbook', 'POST', {
    requestId: randomUUID(),
    content: '重新回复',
    replyToId: roots[0].id,
  })
  assert.equal((await matching()).counts.unansweredGuestbook, 20)
  await ok(`/admin/guestbook/${reply.id}?revision=${reply.revision}`, 'DELETE')
  assert.equal((await matching()).counts.unansweredGuestbook, 21)
  em.create(Comment, {
    post: publicPost.id,
    parent: commentRoot,
    depth: 1,
    authorSnapshot: { name: '博主', avatar: '' },
    content: '博主回复',
    isOwner: true,
  })
  await em.flush()
  assert.equal((await matching()).counts.unanswered, 0)
  await em.execute("update comment set status='hidden' where parent_id=? and is_owner", [commentRoot.id])
  assert.equal((await matching()).counts.unanswered, 1)
  const pendingComment = (await ok('/admin/moments/comments?status=pending')).items[0]
  const moderationPath = `/admin/moments/${pendingComment.momentId}/comments/${pendingComment.id}`
  await ok(moderationPath, 'PATCH', { status: 'published', expectedStatus: 'pending' })
  assert.equal((await matching()).counts.pendingMomentComments, 21)
  assert.equal((await request(moderationPath, 'PATCH', { status: 'hidden', expectedStatus: 'pending' })).status, 409)
  // 只对本次隔离数据库构造删除和归档边界，实际列表必须同步排除。
  await em.execute('update moment set deleted_at=now() where id=?', [created.moment.id])
  await em.execute('update flash_note set is_archived=true where id=?', [created.flash.id])
  await em.execute('update post set deleted_at=now() where id=?', [created.post.id])
  overview = await matching()
  assert.equal(overview.counts.pendingMomentComments, 0)
  assert.equal(overview.counts.momentDrafts, 0)
  assert.equal(overview.counts.flashDrafts, 0)
  assert.equal(overview.counts.drafts, 0)
  assert(!overview.recentContent.some((item) => item.domain === 'moment' && item.id === created.moment.id))
  assert(!overview.recentContent.some((item) => item.domain === 'post' && item.id === String(created.post.id)))
  assert.deepEqual((await ok('/admin/overview')).recentContent, overview.recentContent, '相同更新时间下排序稳定')
  console.log('工作台隔离验证通过：六域草稿、五类互动计数、分页、回复显隐、删除排除与稳定最近编辑。')
} finally {
  await fixture.close()
}
