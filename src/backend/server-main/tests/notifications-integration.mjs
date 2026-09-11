/** @file notifications-integration.mjs @description 隔离真实事件、未读/处理分离、重试去重、删除凭据与管理权限 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  let token, writes = 0
  async function request(path, method = 'GET', body, admin = true) {
    if (method !== 'GET' && ++writes % 4 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, { method,
      headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': 'notification-isolated-visitor', ...(admin && token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(...args) { const response = await request(...args); assert(response.status < 300, `${args[0]}: ${response.status} ${JSON.stringify(response.body)}`); return response.body.data }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  for (const path of ['/admin/notifications', '/admin/notifications/summary', '/admin/operations']) assert.equal((await request(path, 'GET', undefined, false)).status, 401)
  assert.equal((await ok('/admin/notifications')).total, 0)
  const message = { author: '林间', content: '关于文章整理的流程，能否再分享一些实践？', requestId: randomUUID() }
  const guest = await ok('/guestbook', 'POST', message, false)
  assert.equal((await ok('/guestbook', 'POST', message, false)).id, guest.id)
  let notifications = await ok('/admin/notifications')
  assert.equal(notifications.total, 1)
  assert.equal(notifications.unread, 1)
  assert.equal(notifications.items[0].state, 'awaiting_reply')
  assert.equal(notifications.items[0].url, `/admin/guestbook?focus=${guest.id}`)
  assert.deepEqual(await ok(`/admin/notifications/${notifications.items[0].id}`), notifications.items[0])
  assert.equal((await request(`/admin/notifications/${notifications.items[0].id}`, 'GET', undefined, false)).status, 401)
  assert(!JSON.stringify(notifications).includes(message.content), '通知只存最小来源信息，不复制私密正文')
  await ok(`/admin/notifications/${notifications.items[0].id}/read`, 'POST', {})
  await ok(`/admin/notifications/${notifications.items[0].id}/read`, 'POST', {})
  assert.equal((await ok('/admin/notifications/summary')).unread, 0)
  assert.equal((await ok('/admin/notifications')).items[0].state, 'awaiting_reply', '已读不能变成已处理')
  const reply = await ok('/admin/guestbook', 'POST', { content: '会继续整理具体的实现和验证过程。', replyToId: guest.id, requestId: randomUUID() })
  assert.equal((await ok('/admin/notifications')).items[0].state, 'handled')
  await ok(`/admin/guestbook/${reply.id}`, 'PATCH', { revision: reply.revision, status: 'hidden' })
  assert.equal((await ok('/admin/notifications')).items[0].state, 'awaiting_reply')
  const post = await ok('/admin/posts', 'POST', { title: '通知去重与恢复边界', contentRaw: '公开讨论内容', status: 'published' })
  const commentBody = { author: '星野', content: '保存结果不确定时，重试会重复吗？', requestId: randomUUID() }
  await delay(1100)
  const repeated = await Promise.all(Array.from({ length: 3 }, () => ok(`/posts/${post.id}/comments`, 'POST', commentBody, false)))
  assert(repeated.every((comment) => comment.id === repeated[0].id))
  assert.equal((await request(`/posts/${post.id}/comments`, 'POST', { ...commentBody, content: '换了正文' }, false)).status, 409)
  notifications = await ok('/admin/notifications')
  assert.equal(notifications.total, 2)
  const commentNotification = notifications.items.find((item) => item.kind === 'comment')
  assert.equal(commentNotification.url, `/admin/comments?commentId=${repeated[0].id}`)
  assert.equal(commentNotification.state, 'awaiting_reply')
  const em = fixture.testOrm.em.fork()
  assert.equal((await em.execute('select count(*)::int as count from comment_submission'))[0].count, 1)
  await em.execute('delete from comment where id=?', [repeated[0].id])
  assert.equal((await request(`/posts/${post.id}/comments`, 'POST', commentBody, false)).status, 409, '删除后的提交凭据仍防止复活')
  assert.equal((await ok('/admin/notifications')).items.find((item) => item.kind === 'comment').state, 'unavailable')
  const policy = await ok('/admin/comments/policy')
  await ok('/admin/comments/policy', 'PATCH', { revision: policy.revision, requireApproval: true })
  const moment = await ok('/admin/moments', 'POST', { content: '关于通知状态的整理', status: 'published', requestId: randomUUID() })
  const momentBody = { author: '远山', content: '收到更新了。', requestId: randomUUID() }
  const momentComment = await ok(`/moments/${moment.id}/comments`, 'POST', momentBody, false)
  await ok(`/moments/${moment.id}/comments`, 'POST', momentBody, false)
  notifications = await ok('/admin/notifications')
  assert.equal(notifications.total, 3)
  assert.equal(notifications.items.find((item) => item.kind === 'moment-comment').state, 'pending_review')
  await ok(`/admin/moments/${moment.id}/comments/${momentComment.id}`, 'PATCH', { status: 'published', expectedStatus: 'pending' })
  assert.equal((await ok('/admin/notifications')).items.find((item) => item.kind === 'moment-comment').state, 'available', '朋友圈没有虚构待回复关系')
  const tasks = await ok('/admin/operations')
  assert.equal(tasks.runtime.total, 3)
  assert(tasks.runtime.tasks.every((task) => task.state === 'paused' && task.attempts === 0))
  assert.equal(tasks.configured.email.enabled, false)
  assert(!JSON.stringify(tasks).includes('payload'))
  assert(!JSON.stringify(tasks).includes('leaseToken'))
  assert.equal((await ok('/admin/notifications?filter=unread')).total, 2)
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: false })
  assert.equal(exported.status, 201)
  assert(!JSON.stringify(exported.body).includes('owner_notification'))
  assert(!JSON.stringify(exported.body).includes('background_task'))
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write('通知接口隔离验证通过：权限、三类业务事件、并发提交去重、已读与处理分离、删除不复活、审核状态、默认零投递、运行脱敏与零漂移\n')
} finally { await fixture.close() }
