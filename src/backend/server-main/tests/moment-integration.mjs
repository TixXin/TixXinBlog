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
  assert.equal((await ok(`/admin/moments/submissions/${input.requestId}`)).id, first.id)
  assert.equal((await request(`/admin/moments/submissions/${input.requestId}`, 'GET', undefined, false)).status, 401)
  assert.equal((await request('/admin/moments/submissions/invalid')).status, 400)
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
  let pinned = await ok(`/admin/moments/${first.id}`, 'PATCH', { revision: first.revision, isPinned: true })
  const firstNavigation = await ok(`/moments/${first.id}/navigation`, 'GET', undefined, false)
  assert.equal(firstNavigation.prev.id, second.id)
  assert.equal(firstNavigation.next, null)
  assert.equal((await ok(`/moments/${second.id}/navigation`, 'GET', undefined, false)).next.id, first.id)
  assert.equal((await request(`/moments/${draft.id}/navigation`, 'GET', undefined, false)).status, 404)
  assert.equal((await ok('/moments?pageSize=1', 'GET', undefined, false)).items[0].id, first.id)
  assert.equal((await ok('/moments?pageSize=1&page=2', 'GET', undefined, false)).items[0].id, second.id)
  // 键集游标：先读第一页，此后发布新动态，按页码读第二页会重复，按游标读不重复也不漏
  const firstPage = await ok('/moments?pageSize=2', 'GET', undefined, false)
  assert.deepEqual(
    firstPage.items.map((item) => item.id),
    [first.id, second.id],
  )
  assert.equal(firstPage.nextCursor, `0.${second.id}`)
  const third = await ok('/admin/moments', 'POST', {
    content: '翻页期间新发布的动态',
    requestId: randomUUID(),
    status: 'published',
  })
  assert.equal((await ok('/moments?pageSize=2&page=2', 'GET', undefined, false)).items[0].id, second.id)
  const afterCursor = await ok(`/moments?pageSize=2&page=2&after=${firstPage.nextCursor}`, 'GET', undefined, false)
  assert.deepEqual(afterCursor.items, [])
  assert.equal(afterCursor.total, 3)
  assert.deepEqual(
    (await ok(`/moments?pageSize=5&after=1.${first.id}`, 'GET', undefined, false)).items.map((item) => item.id),
    [third.id, second.id],
  )
  // 纯时间排序同样按游标续读；锚点不是公开动态时退回页码读取
  assert.deepEqual(
    (await ok(`/moments?pinnedFirst=false&pageSize=5&after=0.${third.id}`, 'GET', undefined, false)).items.map(
      (item) => item.id,
    ),
    [second.id, first.id],
  )
  assert.equal(
    (await ok(`/moments?pageSize=1&page=2&after=0.${draft.id}`, 'GET', undefined, false)).items[0].id,
    third.id,
  )
  assert.equal((await request('/moments?after=1.not-a-uuid', 'GET', undefined, false)).status, 400)
  assert.equal((await request('/moments?pageSize=151', 'GET', undefined, false)).status, 400)
  assert.equal((await ok('/moments?pageSize=150', 'GET', undefined, false)).items.length, 3)
  await ok(`/admin/moments/${third.id}?revision=${third.revision}`, 'DELETE')
  assert.equal((await ok('/moments?q=%25', 'GET', undefined, false)).total, 1)
  assert.equal((await ok('/moments?topic=' + encodeURIComponent('技术'), 'GET', undefined, false)).total, 1)
  // 日期筛选按站点时区（缺省 Asia/Shanghai）切日；直接截取 UTC 日期会在北京时间 0–8 点跑测试时查空
  const siteDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(first.date))
  assert.equal((await ok('/moments?date=' + siteDay, 'GET', undefined, false)).total, 2)
  assert.equal((await request('/moments?date=2026-02-30', 'GET', undefined, false)).status, 400)
  assert.equal((await request('/moments?page=10001', 'GET', undefined, false)).status, 400)
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
  assert(comments.every((comment) => comment.commentCount === 1))
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
  const pendingInput = { requestId: randomUUID(), author: '待审访客', content: '需要审核' }
  const pending = await ok(`/moments/${first.id}/comments`, 'POST', pendingInput, false)
  assert.equal(pending.moderationStatus, 'pending')
  assert.equal(pending.commentCount, 1)
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false)).total, 2)
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false, other)).total, 1)
  assert.equal((await ok('/moments/overview', 'GET', undefined, false)).stats.totalComments, 1)
  await ok(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', {
    status: 'published',
    expectedStatus: 'pending',
  })
  assert.equal(
    (
      await ok(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', {
        status: 'published',
        expectedStatus: 'pending',
      })
    ).commentCount,
    2,
  )
  assert.equal(
    (
      await request(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', {
        status: 'hidden',
        expectedStatus: 'pending',
      })
    ).status,
    409,
  )
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
  await ok(`/admin/moments/${first.id}/comments/${pending.id}`, 'PATCH', {
    status: 'hidden',
    expectedStatus: 'published',
  })
  assert.equal((await request(`/moments/${first.id}/comments`, 'POST', pendingInput, false)).status, 409)
  assert.equal((await ok(`/moments/${first.id}/comments`, 'GET', undefined, false)).total, 3)
  assert.equal((await ok('/moments/overview', 'GET', undefined, false)).stats.totalComments, 3)
  const references = await ok(`/admin/media/${image.id}/references`)
  assert.equal(references.total, 2)
  assert(
    references.items.every((item) =>
      item.kind === 'moment-comment'
        ? item.url === `/admin/moments?comments=${first.id}&commentId=${comments[0].id}`
        : item.url === `/admin/moments/${first.id}`,
    ),
  )
  assert.equal((await request(`/admin/media/${image.id}`, 'DELETE')).status, 409)
  const hiddenPost = await ok(`/admin/posts/${post.id}`)
  await ok(`/admin/posts/${post.id}`, 'PATCH', {
    title: hiddenPost.title,
    contentRaw: hiddenPost.contentRaw,
    revision: hiddenPost.revision,
    status: 'draft',
  })
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false)).linkedArticle, null)
  pinned = await ok(`/admin/moments/${first.id}`, 'PATCH', {
    revision: pinned.revision,
    linkedArticleId: post.id,
    content: '引用撤回后仍能编辑正文',
  })
  assert.equal(pinned.linkedArticleId, post.id)
  assert.equal((await ok(`/moments/${first.id}`, 'GET', undefined, false)).linkedArticle, null)
  const overview = await ok('/moments/overview', 'GET', undefined, false)
  assert.equal(overview.stats.totalMoments, 2)
  assert.equal(overview.topics.find((topic) => topic.name === '技术').count, 1)
  assert.equal(overview.photos[0].momentId, first.id)
  assert.equal(overview.dates[0].count, 2)
  assert.equal(overview.recollections.length, 2)
  assert(overview.recollections.every((item) => Object.keys(item).sort().join(',') === 'content,date,id'))
  // 评论回复：只能回复同一动态下已公开的评论；目标删除后只标明不可见，不泄露原作者
  assert.equal(
    (
      await request(
        `/moments/${first.id}/comments`,
        'POST',
        { requestId: randomUUID(), author: '访客乙', content: '回复待审', replyToId: pending.id },
        false,
      )
    ).status,
    400,
  )
  assert.equal(
    (
      await request(
        `/moments/${second.id}/comments`,
        'POST',
        { requestId: randomUUID(), author: '访客乙', content: '跨动态回复', replyToId: comments[0].id },
        false,
      )
    ).status,
    400,
  )
  const visitorReply = await ok(
    `/moments/${first.id}/comments`,
    'POST',
    { requestId: randomUUID(), author: '访客乙', content: '同感', replyToId: comments[0].id },
    false,
  )
  assert.deepEqual(visitorReply.replyTo, { id: comments[0].id, author: '访客' })
  // 审核开启时访客回复先待审，通过后才能被回复
  assert.equal(visitorReply.moderationStatus, 'pending')
  await ok(`/admin/moments/${first.id}/comments/${visitorReply.id}`, 'PATCH', {
    status: 'published',
    expectedStatus: 'pending',
  })
  const ownerReply = await ok(`/admin/moments/${first.id}/comments`, 'POST', {
    requestId: randomUUID(),
    content: '谢谢',
    replyToId: visitorReply.id,
  })
  assert.deepEqual(ownerReply.replyTo, { id: visitorReply.id, author: '访客乙' })
  const card = await ok(`/moments/${first.id}`, 'GET', undefined, false)
  assert.deepEqual(card.comments.at(-1).replyTo, { id: visitorReply.id, author: '访客乙' })
  // 表情回应：同种回应每人一条，重复设置幂等，取消后计数回落；未列出的表情拒绝
  const reacted = await Promise.all([
    ok(`/moments/${second.id}/reactions`, 'PUT', { emoji: '❤️', reacted: true }, false),
    ok(`/moments/${second.id}/reactions`, 'PUT', { emoji: '❤️', reacted: true }, false),
  ])
  assert(reacted.every((value) => value.reactions[0].count === 1 && value.reactions[0].reacted))
  await ok(`/moments/${second.id}/reactions`, 'PUT', { emoji: '🎉', reacted: true }, false, other)
  const listed = (await ok('/moments?pageSize=50', 'GET', undefined, false)).items.find((item) => item.id === second.id)
  assert.deepEqual(listed.reactions, [
    { emoji: '❤️', count: 1, reacted: true },
    { emoji: '🎉', count: 1, reacted: false },
  ])
  assert.deepEqual(
    (await ok(`/moments/${second.id}/reactions`, 'PUT', { emoji: '❤️', reacted: false }, false)).reactions,
    [{ emoji: '🎉', count: 1, reacted: false }],
  )
  assert.equal(
    (await request(`/moments/${second.id}/reactions`, 'PUT', { emoji: '👍', reacted: true }, false)).status,
    400,
  )
  assert.equal(
    (await request(`/moments/${draft.id}/reactions`, 'PUT', { emoji: '❤️', reacted: true }, false)).status,
    404,
  )
  // 足迹：概览列出公开动态的地点，列表按地点精确筛选
  const placed = await ok('/admin/moments', 'POST', {
    content: '在湖边',
    requestId: randomUUID(),
    status: 'published',
    location: '杭州·西湖',
  })
  assert.deepEqual((await ok('/moments/overview', 'GET', undefined, false)).locations, [
    { name: '杭州·西湖', count: 1 },
  ])
  const located = await ok(`/moments?location=${encodeURIComponent('杭州·西湖')}`, 'GET', undefined, false)
  assert.deepEqual(
    located.items.map((item) => item.id),
    [placed.id],
  )
  assert.equal((await ok(`/moments?location=${encodeURIComponent('杭州')}`, 'GET', undefined, false)).total, 0)
  await ok(`/admin/moments/${placed.id}?revision=${placed.revision}`, 'DELETE')
  const edited = await ok(`/admin/moments/${first.id}`, 'PATCH', { revision: pinned.revision, images: [] })
  assert.equal((await ok(`/admin/media/${image.id}/references`)).total, 1)
  // 新增访客回复与博主回复各一条公开评论
  assert.equal((await ok(`/admin/moments/${first.id}/comments/${comments[0].id}`, 'DELETE')).commentCount, 4)
  const afterDelete = await ok(`/moments/${first.id}/comments?pageSize=50`, 'GET', undefined, false)
  assert.deepEqual(afterDelete.items.find((item) => item.id === visitorReply.id).replyTo, { id: null, author: null })
  assert.equal(
    (await ok(`/admin/moments/${first.id}/comments?pageSize=50`)).items.find((item) => item.id === visitorReply.id)
      .replyTo.author,
    '访客',
  )
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
    const { Moment } = require('../dist/entities/moment.entity.js')
    const { MomentComment } = require('../dist/entities/moment-comment.entity.js')
    const em = orm.em.fork()
    const ids = Array.from({ length: 32 }, () => randomUUID()).sort()
    for (const [index, id] of ids.entries())
      em.create(MomentComment, {
        id,
        moment: em.getReference(Moment, second.id),
        visitorIdHash: 'location-fixture',
        author: '读者',
        avatar: '/avatar.svg',
        content: `继续讨论第 ${index + 1} 个问题`,
        status: index % 2 ? 'hidden' : 'published',
        createdAt: new Date('2026-09-11T00:00:00Z'),
      })
    await em.flush()
    const target = ids.at(-1)
    const locationPath = `/admin/moments/${second.id}/comments/${target}/location`
    assert.equal((await request(locationPath, 'GET', undefined, false)).status, 401)
    assert.deepEqual(await ok(locationPath), { commentId: target, page: 3, pageSize: 15 })
    assert(
      (await ok(`/admin/moments/${second.id}/comments?page=3&pageSize=15`)).items.some((item) => item.id === target),
    )
    assert.equal((await request(`/admin/moments/${draft.id}/comments/${target}/location`)).status, 404)
    await em.nativeUpdate(MomentComment, { id: { $in: ids.slice(0, 16) } }, { deletedAt: new Date() })
    assert.equal((await ok(locationPath)).page, 2, '已删除评论不计入定位，隐藏评论仍计入管理页')
    await em.nativeUpdate(MomentComment, { id: target }, { deletedAt: new Date() })
    assert.equal((await request(locationPath)).status, 404)
  } finally {
    await orm.close(true)
  }
  process.stdout.write(`朋友圈隔离集成验证通过：${checks} 个请求，含并发去重、权限、媒体和迁移结构检查\n`)
} finally {
  await fixture.close()
}
