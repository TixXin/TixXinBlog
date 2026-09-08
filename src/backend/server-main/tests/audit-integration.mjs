/**
 * @file audit-integration.mjs
 * @description 隔离审计验收：真实结果、隐私白名单、权限失败、存储阻断与结果补全重试。
 */
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  let token
  let writes = 0
  async function request(path, method = 'GET', body, credential = token) {
    if (method !== 'GET' && ++writes % 6 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      status: response.status,
      body: await response.json(),
      auditId: response.headers.get('x-audit-id'),
      auditStatus: response.headers.get('x-audit-status'),
    }
  }
  const login = await request('/auth/login', 'POST', { username: fixture.username, password: fixture.password }, '')
  assert.equal(login.status, 200)
  token = login.body.data.accessToken
  assert(login.auditId)
  const em = fixture.testOrm.em.fork()
  const entry = async (id) => (await em.execute('select * from audit_entry where id=?', [id]))[0]
  assert.equal((await entry(login.auditId)).state, 'success')
  assert.equal((await entry(login.auditId)).actor_name, fixture.username)
  assert.equal((await request('/admin/audit', 'GET', undefined, '')).status, 401)
  const privateContent = 'private-audit-content-must-not-be-logged'
  const created = await request('/admin/posts', 'POST', {
    title: '审计对象',
    contentRaw: privateContent,
    status: 'published',
  })
  assert.equal(created.status, 201)
  const post = created.body.data
  const creation = await entry(created.auditId)
  assert.equal(creation.action, 'post.create')
  assert.equal(creation.resource_id, String(post.id))
  assert.equal(creation.state, 'success')
  assert(creation.summary.fields.includes('正文'))
  const invalid = await request('/admin/posts', 'POST', { title: '', contentRaw: privateContent })
  assert.equal(invalid.status, 400)
  assert.equal((await entry(invalid.auditId)).state, 'failure')
  assert.equal((await entry(invalid.auditId)).status_code, 400)
  const draft = await request('/admin/posts', 'POST', { title: '审计草稿', contentRaw: '正文', status: 'draft' })
  const plan = await request('/admin/posts/batch/preview', 'POST', {
    action: 'withdraw',
    items: [post, draft.body.data].map(({ id, revision }) => ({ id, revision })),
  })
  const executed = await request('/admin/posts/batch/execute', 'POST', { ticket: plan.body.data.ticket })
  assert.equal(executed.status, 201)
  const partial = await entry(executed.auditId)
  assert.equal(partial.state, 'partial')
  assert.equal(partial.resource_id, plan.body.data.ticket)
  assert.deepEqual(partial.summary.counts, { successCount: 1, failedCount: 1, pendingCount: 0 })
  const expired = await request('/auth/login', 'POST', { username: fixture.username, password: fixture.password })
  const stale = expired.body.data.accessToken
  const sid = JSON.parse(Buffer.from(stale.split('.')[1], 'base64url')).sid
  assert.equal((await request(`/auth/sessions/${sid}`, 'DELETE')).status, 200)
  const denied = await request('/admin/posts', 'POST', { title: '拒绝写入', contentRaw: privateContent }, stale)
  assert.equal(denied.status, 401)
  // 认证守卫拒绝发生在拦截器之前，响应结束钩子仍补全有签名身份的失败记录。
  for (let i = 0; i < 20 && (await entry(denied.auditId)).state === 'pending'; i++) await delay(20)
  assert.equal((await entry(denied.auditId)).state, 'failure')
  const before = (await request(`/admin/posts/${post.id}`)).body.data
  await em.execute(
    "create function reject_audit_start() returns trigger language plpgsql as $$ begin raise exception 'isolated audit unavailable'; end $$",
  )
  await em.execute(
    'create trigger fail_audit_start before insert on audit_entry for each row execute function reject_audit_start()',
  )
  const blocked = await request(`/admin/posts/${post.id}`, 'PATCH', {
    title: '不应保存',
    contentRaw: privateContent,
    revision: before.revision,
  })
  assert.equal(blocked.status, 503)
  assert.equal((await request(`/admin/posts/${post.id}`)).body.data.revision, before.revision)
  await em.execute('drop trigger fail_audit_start on audit_entry')
  await em.execute('drop function reject_audit_start()')
  await em.execute(
    "create function reject_audit_result() returns trigger language plpgsql as $$ begin raise exception 'isolated result unavailable'; end $$",
  )
  await em.execute(
    'create trigger fail_audit_result before update on audit_entry for each row execute function reject_audit_result()',
  )
  const saved = await request(`/admin/posts/${post.id}`, 'PATCH', {
    title: '真实已保存',
    contentRaw: privateContent,
    revision: before.revision,
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.auditStatus, 'pending')
  assert.equal((await entry(saved.auditId)).state, 'pending')
  assert.equal((await request('/admin/audit')).body.data.health.retryQueue, 1)
  await em.execute('drop trigger fail_audit_result on audit_entry')
  await em.execute('drop function reject_audit_result()')
  for (let i = 0; i < 40 && (await entry(saved.auditId)).state === 'pending'; i++) await delay(100)
  assert.equal((await entry(saved.auditId)).state, 'success')
  assert.equal((await request('/admin/audit?state=partial')).body.data.total, 1)
  const changedPassword = 'isolated-audit-new-password-2026'
  const change = await request('/auth/password', 'POST', {
    currentPassword: fixture.password,
    newPassword: changedPassword,
  })
  assert.equal(change.status, 200)
  const all = JSON.stringify(await em.execute('select * from audit_entry'))
  for (const secret of [fixture.password, changedPassword, privateContent, token, stale])
    assert(!all.includes(secret), '审计不得存储原始敏感输入或令牌')
  assert.equal((await entry(change.auditId)).action, 'auth.password')
  assert.equal((await entry(change.auditId)).state, 'success')
  process.stdout.write(
    '审计集成通过：成功/失败/部分结果、对象与操作者、敏感数据排除、守卫失败记录、意图存储失败阻断、结果失败保留并补全\n',
  )
} finally {
  await fixture.close()
}
