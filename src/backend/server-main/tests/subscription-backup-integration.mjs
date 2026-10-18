/** @file subscription-backup-integration.mjs @description v11 订阅迁入的版本、历史、媒体、幂等、回滚和旧包保留行为，在专用数据库验证。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
import { stripV9Fields, stripV10Fields, stripV11Fields, stripV12Fields } from './legacy-content-package.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  let token,
    writes = 0
  async function pauseWrite() {
    if (++writes % 5 === 0) await delay(1100)
  }
  async function request(path, method = 'GET', body, options = {}) {
    if (method !== 'GET') await pauseWrite()
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...options,
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(path, method = 'GET', body) {
    const result = await request(path, method, body)
    assert(result.status < 300, `${path}: ${result.status} ${result.body.message ?? ''}`)
    return result.body.data
  }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  const image = new FormData()
  image.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'subscription-icon.png',
  )
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: image,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const initial = {
    name: '工作云盘',
    currency: 'USD',
    amount: 2000,
    billingCycle: 'monthly',
    category: 'cloud',
    startDate: '2020-01-31',
    nextBillingDate: '2027-01-31',
    subscriptionStatus: 'active',
    status: 'published',
    iconMediaId: asset.id,
    notes: '私人账目',
    requestId: randomUUID(),
  }
  let managed = await ok('/admin/subscriptions', 'POST', initial)
  managed = await ok(`/admin/subscriptions/${managed.id}`, 'PATCH', {
    revision: managed.revision,
    amount: 2400,
    priceChangeReason: '方案调整',
  })
  managed = await ok(`/admin/subscriptions/${managed.id}`, 'PATCH', {
    revision: managed.revision,
    amount: 1000,
    currency: 'JPY',
    billingCycle: 'yearly',
    priceChangeReason: '改为年度方案',
  })
  assert.equal(managed.priceHistory.length, 3)
  const withdrawn = await ok('/admin/subscriptions', 'POST', {
    name: '设计工具',
    amount: 0,
    currency: 'CNY',
    billingCycle: 'one-time',
    subscriptionStatus: 'cancelled',
    status: 'withdrawn',
    requestId: randomUUID(),
  })
  const deleted = await ok('/admin/subscriptions', 'POST', {
    name: '旧主机',
    amount: 999,
    currency: 'USD',
    billingCycle: 'monthly',
    status: 'draft',
    requestId: randomUUID(),
  })
  await ok(`/admin/subscriptions/${deleted.id}?revision=${deleted.revision}`, 'DELETE')
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.body
  assert.equal(bundle.version, 12)
  assert.equal(bundle.subscriptions.length, 3)
  const source = bundle.subscriptions.find((row) => row.sourceId === managed.id)
  assert.deepEqual(source.values.priceHistory, managed.priceHistory)
  assert.equal(source.values.notes, '私人账目')
  for (const key of ['requestId', 'requestHash', 'revision', 'updatedAt'])
    assert(!JSON.stringify(bundle.subscriptions).includes(`"${key}"`))
  bundle.posts = []
  bundle.folders = []
  bundle.tags = []
  async function preview(input, strategy = 'skip', requestId = randomUUID()) {
    await pauseWrite()
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), 'subscriptions.json')
    form.append('requestId', requestId)
    form.append('strategy', strategy)
    form.append('includeSettings', 'false')
    const response = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    return { status: response.status, body: await response.json() }
  }
  const execute = (plan, options) =>
    request(
      `/admin/backup/imports/${plan.ticket}/execute`,
      'POST',
      { acknowledgement: '导入为新草稿', confirmation: plan.confirmation },
      options,
    )
  const em = fixture.testOrm.em.fork()
  const count = async () => (await em.execute('select count(*)::int as n from subscription'))[0].n
  const same = await preview(bundle)
  assert.equal(same.status, 201)
  assert.equal(same.body.data.plan.counts.subscriptions, 0)
  assert.equal(same.body.data.plan.counts.skipped, 3)
  for (let version = 1; version <= 10; version++) {
    const legacy = structuredClone(bundle)
    legacy.version = version
    if (version < 9) stripV9Fields(legacy)
    else if (version < 10) stripV10Fields(legacy)
    else stripV11Fields(legacy)
    if (version < 8) delete legacy.site.about
    if (version < 6) {
      delete legacy.links
      delete legacy.linkSettings
    }
    if (version < 5) delete legacy.projects
    if (version < 4) {
      delete legacy.gallery
      delete legacy.gallerySettings
    }
    if (version < 3) delete legacy.guestbook
    if (version < 2) delete legacy.moments
    const accepted = await preview(legacy)
    assert.equal(accepted.status, 201, `v${version}`)
    assert.equal(accepted.body.data.plan.counts.subscriptions, 0)
    assert.equal((await preview({ ...legacy, subscriptions: [] })).status, 400)
    if (version === 10) {
      const before = await count()
      assert.equal((await execute(accepted.body.data)).status, 201)
      assert.equal(await count(), before)
      assert.deepEqual((await ok(`/admin/subscriptions/${managed.id}`)).priceHistory, managed.priceHistory)
    }
  }
  // v11 保留订阅，但不得夹带 v12 的站点导航与页脚字段
  const legacyV11 = stripV12Fields({ ...structuredClone(bundle), version: 11 })
  const acceptedV11 = await preview(legacyV11)
  assert.equal(acceptedV11.status, 201, 'v11')
  assert.equal(acceptedV11.body.data.plan.counts.skipped, 3)
  assert.equal((await preview({ ...legacyV11, site: { ...legacyV11.site, quotes: ['一言'] } })).status, 400)
  const missing = structuredClone(bundle)
  missing.subscriptions = [source]
  missing.subscriptions[0].values.iconMediaId = randomUUID()
  const missingPlan = await preview(missing, 'copy')
  assert.equal(missingPlan.status, 201)
  assert.equal(missingPlan.body.data.plan.ready, false)
  assert(missingPlan.body.data.plan.errors.some((message) => message.includes('未登记的媒体')))
  const copied = structuredClone(bundle),
    mappedMediaId = randomUUID()
  copied.media[0].id = mappedMediaId
  copied.subscriptions.find((row) => row.sourceId === managed.id).values.iconMediaId = mappedMediaId
  const requestId = randomUUID()
  const plan = await preview(copied, 'copy', requestId)
  assert.equal(plan.status, 201)
  assert.equal(plan.body.data.plan.counts.subscriptions, 2)
  assert.equal((await preview(copied, 'copy', requestId)).body.data.ticket, plan.body.data.ticket)
  const executed = await execute(plan.body.data)
  assert.equal(executed.status, 201)
  const result = executed.body.data.result
  assert.equal(result.subscriptions.length, 2)
  assert.deepEqual((await execute(plan.body.data)).body.data.result, result)
  for (const row of result.subscriptions) {
    const saved = await ok(`/admin/subscriptions/${row.id}`)
    const original = copied.subscriptions.find((item) => item.sourceId === row.sourceId)
    assert.notEqual(row.id, row.sourceId)
    assert.equal(saved.status, 'draft')
    assert.equal(saved.revision, 0)
    assert.equal(saved.subscriptionStatus, original.values.subscriptionStatus)
    assert.equal(saved.iconMediaId, original.values.iconMediaId)
    assert.equal(saved.notes, original.values.notes)
    assert.deepEqual(saved.priceHistory, original.values.priceHistory)
    assert.equal((await request(`/subscriptions/${row.id}`)).status, 404)
    const [persisted] = await em.execute('select request_id,request_hash from subscription where id=?', [row.id])
    assert.equal(persisted.request_id, null)
    assert.equal(persisted.request_hash, null)
  }
  assert(!result.subscriptions.some((row) => row.sourceId === deleted.id))
  assert(result.subscriptions.some((row) => row.sourceId === withdrawn.id))
  const references = await ok(`/admin/media/${mappedMediaId}/references`)
  assert(references.items.some((row) => row.kind === 'subscription'))
  assert.equal((await request(`/admin/media/${mappedMediaId}`, 'DELETE')).status, 409)
  assert.equal((await preview(copied)).body.data.plan.counts.subscriptions, 0)
  const stale = (await preview(copied, 'copy')).body.data
  managed = await ok(`/admin/subscriptions/${managed.id}`, 'PATCH', {
    revision: managed.revision,
    notes: '更新账目说明',
  })
  assert.equal((await execute(stale)).status, 409)

  // 在事务中失败时，新增图标字节、引用和历史必须一起回滚。
  const broken = structuredClone(copied),
    rollbackMedia = randomUUID()
  broken.media[0].id = rollbackMedia
  broken.subscriptions = [
    {
      ...broken.subscriptions[0],
      values: { ...broken.subscriptions[0].values, name: '订阅迁入回滚证明', iconMediaId: rollbackMedia },
    },
  ]
  const counts = () =>
    em.execute(
      'select (select count(*) from subscription)::int as subscriptions,(select count(*) from media_asset)::int as media,(select count(*) from media_reference)::int as refs',
    )
  const before = await counts()
  const brokenPlan = (await preview(broken, 'copy')).body.data
  await em.execute(
    "create function fail_subscription_import() returns trigger language plpgsql as $$ begin if new.name='订阅迁入回滚证明' then raise exception 'isolated subscription import failure'; end if; return new; end $$",
  )
  await em.execute(
    'create trigger fail_subscription_import before insert on subscription for each row execute function fail_subscription_import()',
  )
  assert.equal((await execute(brokenPlan)).status, 503)
  assert.deepEqual(await counts(), before)
  assert.equal((await request(`/media/${rollbackMedia}.webp`)).status, 404)
  await em.execute('drop trigger fail_subscription_import on subscription')
  await em.execute('drop function fail_subscription_import()')
  const retry = await execute(brokenPlan)
  assert.equal(retry.status, 201)
  assert.deepEqual(
    (await ok(`/admin/subscriptions/${retry.body.data.result.subscriptions[0].id}`)).priceHistory,
    broken.subscriptions[0].values.priceHistory,
  )
  console.log('平台订阅内容包通过：v11、v1–v10兼容、旧包保留、历史及媒体映射、幂等草稿、预览冲突和事务回滚。')
} finally {
  await fixture.close()
}
