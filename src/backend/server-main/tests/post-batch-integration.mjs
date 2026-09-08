/**
 * @file post-batch-integration.mjs
 * @description 独立数据库中验证批量预览、并发幂等、回收恢复和永久删除的实际影响。
 */
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  async function login(username) {
    const response = await fetch(`${fixture.origin}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: fixture.password }),
    })
    assert.equal(response.status, 200)
    return (await response.json()).data.accessToken
  }
  const token = await login(fixture.username)
  const otherToken = await login(fixture.accountUsername)
  let writes = 0
  async function request(path, method = 'GET', body, credential = token) {
    if (method !== 'GET' && ++writes % 7 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(path, method = 'GET', body) {
    const response = await request(path, method, body)
    assert(response.status < 300, `${path}: ${response.status} ${JSON.stringify(response.body)}`)
    return response.body.data
  }
  const create = (title, extra = {}) =>
    ok('/admin/posts', 'POST', { title, contentRaw: '隔离批量测试正文', status: 'published', ...extra })
  const selected = (post) => ({ id: post.id, revision: post.revision })
  const preview = (action, posts) => ok('/admin/posts/batch/preview', 'POST', { action, items: posts.map(selected) })
  const execute = (plan, acknowledgement) =>
    ok('/admin/posts/batch/execute', 'POST', { ticket: plan.ticket, acknowledgement })
  const fresh = (post) => ok(`/admin/posts/${post.id}`)
  const first = await create('批量公开一')
  const second = await create('批量公开二')
  const draft = await create('批量草稿', { status: 'draft' })
  assert.equal(
    (await request('/admin/posts/batch/preview', 'POST', { action: 'trash', items: [selected(first)] }, '')).status,
    401,
  )
  assert.equal(
    (
      await request('/admin/posts/batch/preview', 'POST', {
        action: 'trash',
        items: [selected(first), selected(first)],
      })
    ).status,
    400,
  )
  const invalid = await preview('withdraw', [draft, { id: 99999999, revision: 0 }, { ...first, revision: 100 }])
  assert.equal((await request('/admin/posts/batch/preview', 'POST', { action: 'trash', items: [null] })).status, 400)
  assert.equal(invalid.allowedCount, 0)
  const plan = await preview('withdraw', [first, second, draft])
  assert.equal(plan.allowedCount, 2)
  assert.equal((await request(`/admin/posts/batch/${plan.ticket}`, 'GET', undefined, otherToken)).status, 404)
  // 预览后的更新只令对应文章失败，其他条目继续并逐项持久化。
  await ok(`/admin/posts/${second.id}`, 'PATCH', {
    title: '预览后修改',
    contentRaw: '新版',
    status: 'published',
    revision: second.revision,
  })
  const outcome = await execute(plan)
  assert.equal(outcome.successCount, 1, JSON.stringify(outcome))
  assert.equal(outcome.failedCount, 2)
  assert.equal(outcome.completed, true)
  assert.equal((await fresh(first)).status, 'draft')
  assert.equal((await fresh(second)).title, '预览后修改')
  const revision = (await fresh(first)).revision
  assert.deepEqual((await execute(plan)).results, outcome.results)
  assert.equal((await fresh(first)).revision, revision)
  assert.deepEqual((await ok(`/admin/posts/batch/${plan.ticket}`)).results, outcome.results)
  assert((await ok('/admin/posts/batch')).some((item) => item.ticket === plan.ticket))
  const trashPlan = await preview('trash', [await fresh(first), await fresh(second)])
  await delay(1100)
  const concurrent = await Promise.all([execute(trashPlan), execute(trashPlan)])
  for (const response of concurrent) {
    assert.equal(response.successCount, 2, JSON.stringify(response))
    assert.equal(response.completed, true)
  }
  assert.equal((await fresh(first)).revision, revision + 1, '并发提交同一操作只修改一次')
  assert((await fresh(first)).deletedAt)
  assert.equal((await request(`/posts/${first.id}`)).status, 404)
  assert.equal((await ok('/admin/posts?status=trash')).total, 2)
  assert(!(await ok('/admin/overview')).recentPosts.some((post) => [first.id, second.id].includes(post.id)))
  assert.equal(
    (await request(`/admin/posts/${first.id}`, 'PATCH', { title: '不应复活', contentRaw: '', revision: revision + 1 }))
      .status,
    409,
  )
  const restorePlan = await preview('restore', [await fresh(first)])
  assert.equal((await execute(restorePlan)).successCount, 1)
  assert.equal((await fresh(first)).status, 'draft')
  assert.equal((await fresh(first)).deletedAt, undefined)
  assert.equal((await preview('delete', [await fresh(first)])).allowedCount, 0)
  const deletion = await preview('delete', [await fresh(second)])
  assert(deletion.items[0].impact.revisions >= 3)
  assert.equal((await request('/admin/posts/batch/execute', 'POST', { ticket: deletion.ticket })).status, 400)
  assert.equal((await execute(deletion, '永久删除')).successCount, 1)
  assert.equal((await request(`/admin/posts/${second.id}`)).status, 404)

  // 上传真实媒体并建立正文/修订引用；删除文章释放引用但保留文件。
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'batch-image.png')
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const linked = await create('含图片与历史地址', { slug: 'batch-linked', contentRaw: `![测试](${asset.url})` })
  assert((await ok(`/admin/media/${asset.id}/references`)).total >= 2)
  await execute(await preview('trash', [linked]))
  const deleteLinked = await preview('delete', [await fresh(linked)])
  assert.equal(deleteLinked.items[0].impact.addresses, 1)
  assert(deleteLinked.items[0].impact.mediaReferences >= 2)
  const removed = await execute(deleteLinked, '永久删除')
  assert.equal(removed.successCount, 1, JSON.stringify(removed))
  assert.equal((await ok(`/admin/media/${asset.id}/references`)).total, 0)
  assert.equal((await fetch(`${fixture.origin}${asset.url}`)).status, 200)
  assert.equal((await request('/posts/by-slug/batch-linked')).status, 404)
  const isolated = fixture.testOrm.em.fork()
  assert.match(fixture.testOrm.config.get('dbName'), /^tixxin_browser_\d+_\d+$/)
  const changedRange = await create('删除范围并发保护')
  await isolated.execute(
    `insert into comment (post_id, depth, author_snapshot, content, likes, is_owner, created_at) values (?, 0, ?::jsonb, '预览时评论', 0, false, now())`,
    [changedRange.id, JSON.stringify({ name: '隔离测试', avatar: '/avatar.svg' })],
  )
  await execute(await preview('trash', [changedRange]))
  const changedPlan = await preview('delete', [await fresh(changedRange)])
  assert.equal(changedPlan.items[0].impact.comments, 1)
  await isolated.execute('delete from comment where post_id=?', [changedRange.id])
  await isolated.execute(
    `insert into comment (post_id, depth, author_snapshot, content, likes, is_owner, created_at) values (?, 0, ?::jsonb, '替换后评论', 0, false, now())`,
    [changedRange.id, JSON.stringify({ name: '隔离测试', avatar: '/avatar.svg' })],
  )
  assert.equal((await execute(changedPlan, '永久删除')).failedCount, 1, '同数量的新评论也必须重新确认')
  assert((await fresh(changedRange)).deletedAt)
  assert.equal((await execute(await preview('delete', [await fresh(changedRange)]), '永久删除')).successCount, 1)
  assert.equal(
    (await isolated.execute('select count(*)::int as count from comment where post_id=?', [changedRange.id]))[0].count,
    0,
  )
  const expired = await preview('archive', [await fresh(first)])
  await isolated.execute("update post_batch_operation set expires_at=now() - interval '1 minute' where id=?", [
    expired.ticket,
  ])
  assert.equal((await request('/admin/posts/batch/execute', 'POST', { ticket: expired.ticket })).status, 400)
  assert.equal((await ok(`/admin/posts/batch/${expired.ticket}`)).pendingCount, 1)
  const broken = await create('批量回滚保护')
  const unaffected = await create('批量继续处理')
  const rollback = await preview('archive', [broken, unaffected])
  await isolated.execute(
    `create function reject_batch_test_update() returns trigger language plpgsql as $$ begin if old.title='批量回滚保护' then raise exception 'isolated test failure'; end if; return new; end $$`,
  )
  await isolated.execute(
    'create trigger batch_test_failure before update on post for each row execute function reject_batch_test_update()',
  )
  const rollbackResult = await execute(rollback)
  assert.equal(rollbackResult.failedCount, 1, JSON.stringify(rollbackResult))
  assert.equal(rollbackResult.successCount, 1)
  assert.equal((await fresh(broken)).revision, broken.revision)
  assert.equal((await fresh(broken)).status, 'published')
  assert.equal((await ok(`/admin/posts/${broken.id}/revisions`)).total, 1)
  assert.equal((await fresh(unaffected)).status, 'archived')
  await isolated.execute('drop trigger batch_test_failure on post')
  await isolated.execute('drop function reject_batch_test_update()')
  assert.equal((await ok('/admin/overview')).counts.trashed, 0)
  process.stdout.write(
    '文章批量集成通过：鉴权/范围校验、并发幂等、逐项持久化与冲突跳过、回收恢复、永久删除确认/级联、媒体文件保留\n',
  )
} finally {
  await fixture.close()
}
