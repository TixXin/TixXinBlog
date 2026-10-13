/** @file subscription-integration.mjs @description 订阅真实 API、精度统计、并发历史、权限、媒体及事务回滚的隔离验收 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
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
  async function call(path, method = 'GET', body, admin = false, extra = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: {
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(admin ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      })
      const data = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      checks++
      return { status: response.status, data: data.data, raw: data }
    }
  }
  async function ok(path, method = 'GET', body, admin = false) {
    const result = await call(path, method, body, admin)
    assert(result.status < 300, `${method} ${path}: ${result.status} ${JSON.stringify(result.raw)}`)
    return result.data
  }
  const admin = '/admin/subscriptions',
    em = fixture.testOrm.em.fork()
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '', '迁移必须与实体一致')
  for (const [path, method, body] of [
    [admin, 'GET'],
    [admin, 'POST', {}],
    [admin + '/1', 'PATCH', { revision: 0 }],
    [admin + '/1?revision=0', 'DELETE'],
    [admin + '/sort', 'PATCH', { items: [] }],
    [admin + '/fetch-favicon', 'POST', { url: 'https://vuejs.org/' }],
  ])
    assert.equal((await call(path, method, body)).status, 401)
  assert.equal((await ok('/subscriptions')).total, 0)
  assert.deepEqual((await ok('/subscriptions/stats')).currencies, [])
  const base = {
    requestId: randomUUID(),
    name: '阅读工具 100%',
    amount: 2000,
    currency: 'USD',
    billingCycle: 'monthly',
    notes: '仅博主可读',
  }
  for (const extra of [
    { name: '' },
    { name: null },
    { amount: -1 },
    { amount: 1.1 },
    { amount: 2147483648 },
    { amount: null },
    { currency: 'XYZ' },
    { category: 'unknown' },
    { billingCycle: 'weekly' },
    { subscriptionStatus: 'draft' },
    { status: 'active' },
    { url: 'javascript:alert(1)' },
    { url: 'https://u:p@example.com/' },
    { startDate: '2026-02-29' },
    { startDate: '2026-10-20', nextBillingDate: '2026-10-01' },
    { priceHistory: [] },
    { publishedAt: '2026-01-01' },
    { iconMediaId: randomUUID() },
  ])
    assert.equal((await call(admin, 'POST', { ...base, ...extra }, true)).status, 400, JSON.stringify(extra))
  const [a, b] = await Promise.all([ok(admin, 'POST', base, true), ok(admin, 'POST', base, true)])
  assert.equal(a.id, b.id)
  assert.equal(a.priceHistory.length, 1)
  assert.equal(a.priceHistory[0].amount, 2000)
  assert.equal((await call(`/subscriptions/${a.id}`)).status, 404)
  assert.equal((await call(admin, 'POST', { ...base, amount: 2100 }, true)).status, 409)
  assert.equal((await ok(`${admin}/submissions/${base.requestId}`, 'GET', undefined, true)).item.id, a.id)
  let saved = await ok(
    `${admin}/${a.id}`,
    'PATCH',
    { revision: a.revision, description: '公开用途', status: 'published' },
    true,
  )
  assert.equal(saved.priceHistory.length, 1, '不修改价格不新增事件')
  const publicItem = await ok(`/subscriptions/${a.id}`)
  for (const field of [
    'notes',
    'status',
    'revision',
    'requestId',
    'requestHash',
    'sortOrder',
    'iconMediaId',
    'deletedAt',
  ])
    assert.equal(field in publicItem, false, field)
  assert.equal((await ok('/subscriptions?q=100%25')).total, 1)
  assert.equal((await ok('/subscriptions?q=_')).total, 0)
  assert.equal((await call('/subscriptions?status=draft')).status, 400)
  await ok(
    admin,
    'POST',
    {
      ...base,
      requestId: randomUUID(),
      name: '年度开发工具',
      amount: 28900,
      billingCycle: 'yearly',
      status: 'published',
    },
    true,
  )
  await ok(
    admin,
    'POST',
    {
      ...base,
      requestId: randomUUID(),
      name: '季度写作',
      amount: 10000,
      currency: 'CNY',
      billingCycle: 'quarterly',
      status: 'published',
    },
    true,
  )
  await ok(
    admin,
    'POST',
    { ...base, requestId: randomUUID(), name: '日语资料', amount: 1000, currency: 'JPY', status: 'published' },
    true,
  )
  const stats = await ok('/subscriptions/stats?pageSize=1')
  assert.equal(stats.total, 4)
  assert.equal(stats.currencies.find((v) => v.currency === 'USD').annualAmount, 52900)
  assert.equal(stats.currencies.find((v) => v.currency === 'CNY').monthlyAmount, 3333)
  assert.equal(stats.currencies.find((v) => v.currency === 'JPY').annualAmount, 12000)
  assert.equal('annualAmount' in stats, false)
  assert.equal((await ok('/subscriptions?pageSize=1')).items.length, 1)
  assert.equal((await ok('/subscriptions/stats?currency=USD')).total, 2)
  const concurrent = await Promise.all([
    call(`${admin}/${a.id}`, 'PATCH', { revision: saved.revision, amount: 2100 }, true),
    call(`${admin}/${a.id}`, 'PATCH', { revision: saved.revision, amount: 2200 }, true),
  ])
  assert.deepEqual(concurrent.map((v) => v.status).sort(), [200, 409])
  saved = await ok(`${admin}/${a.id}`, 'GET', undefined, true)
  assert.equal(saved.priceHistory.length, 2)
  assert.equal(saved.priceHistory.at(-1).amount, saved.amount)
  const beforeFailure = structuredClone(saved)
  await em.execute(
    "create function subscription_update_failure() returns trigger language plpgsql as $$ begin if new.amount=777 then raise exception 'subscription_failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger subscription_update_failure before update on subscription for each row execute function subscription_update_failure()',
  )
  try {
    assert.equal((await call(`${admin}/${a.id}`, 'PATCH', { revision: saved.revision, amount: 777 }, true)).status, 500)
  } finally {
    await em.execute('drop trigger subscription_update_failure on subscription')
    await em.execute('drop function subscription_update_failure()')
  }
  saved = await ok(`${admin}/${a.id}`, 'GET', undefined, true)
  assert.deepEqual(saved, beforeFailure, '事务失败不能留下新价格或孤立历史')
  saved = await ok(
    `${admin}/${a.id}`,
    'PATCH',
    { revision: saved.revision, currency: 'CNY', billingCycle: 'quarterly', priceChangeReason: '调整结算' },
    true,
  )
  assert.equal(saved.priceHistory.length, 3)
  assert.equal(saved.priceHistory.at(-1).currency, 'CNY')
  assert.equal(saved.priceHistory.at(-1).billingCycle, 'quarterly')
  assert.equal(new Set(saved.priceHistory.map((v) => v.id)).size, 3)
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'subscription.png')
  const media = await ok('/admin/media', 'POST', form, true)
  saved = await ok(`${admin}/${a.id}`, 'PATCH', { revision: saved.revision, iconMediaId: media.id }, true)
  assert.equal(saved.iconUrl, media.url)
  assert.equal(saved.priceHistory.length, 3)
  assert.equal((await call(`/admin/media/${media.id}`, 'DELETE', undefined, true)).status, 409)
  assert(
    (await ok(`/admin/media/${media.id}/references`, 'GET', undefined, true)).items.some(
      (v) => v.kind === 'subscription',
    ),
  )
  const another = (await ok(admin + '?pageSize=48', 'GET', undefined, true)).items.find((v) => v.id !== saved.id)
  const rows = [
    { id: saved.id, revision: saved.revision, sortOrder: 88 },
    { id: another.id, revision: another.revision + 1, sortOrder: 77 },
  ]
  assert.equal((await call(admin + '/sort', 'PATCH', { items: rows }, true)).status, 409)
  assert.equal((await ok(`${admin}/${a.id}`, 'GET', undefined, true)).sortOrder, saved.sortOrder)
  assert.equal((await call(admin + '/sort', 'PATCH', { items: [rows[0], rows[0]] }, true)).status, 400)
  rows[1].revision = another.revision
  await ok(admin + '/sort', 'PATCH', { items: rows }, true)
  saved = await ok(`${admin}/${a.id}`, 'GET', undefined, true)
  assert.equal(saved.sortOrder, 88)
  assert.equal(saved.revision, rows[0].revision + 1)
  for (const url of [
    'file:///etc/passwd',
    'http://127.0.0.1/',
    'http://localhost/',
    'https://example.com:3000/',
    'https://u:p@example.com/',
  ])
    assert.equal((await call(admin + '/fetch-favicon', 'POST', { url }, true)).status, 400)
  saved = await ok(`${admin}/${a.id}`, 'PATCH', { revision: saved.revision, status: 'withdrawn' }, true)
  assert.equal((await call(`/subscriptions/${a.id}`)).status, 404)
  assert.equal((await ok('/subscriptions/stats')).total, 3)
  assert.equal((await call(`${admin}/${a.id}?revision=${saved.revision - 1}`, 'DELETE', undefined, true)).status, 409)
  await ok(`${admin}/${a.id}?revision=${saved.revision}`, 'DELETE', undefined, true)
  await ok(`${admin}/${a.id}?revision=${saved.revision}`, 'DELETE', undefined, true)
  assert.equal((await ok(`${admin}/submissions/${base.requestId}`, 'GET', undefined, true)).state, 'deleted')
  assert.equal((await call(admin, 'POST', base, true)).status, 409)
  await ok(`/admin/media/${media.id}`, 'DELETE', undefined, true)
  await em.execute("update content_context set require_context=true,generation=? where id='default'", [randomUUID()])
  assert.equal((await call(admin, 'POST', { ...base, requestId: randomUUID() }, true)).status, 428)
  assert.equal(
    (await call(admin, 'POST', { ...base, requestId: randomUUID() }, true, { 'X-Content-Context': randomUUID() }))
      .status,
    409,
  )
  process.stdout.write(
    `订阅隔离 HTTP 验收通过：${checks} 次请求，权限/幂等/过滤/精度统计/历史/并发/回滚/排序/媒体/上下文\n`,
  )
} finally {
  await fixture.close()
}
