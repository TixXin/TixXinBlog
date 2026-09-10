/** @file gallery-integration.mjs @description 图库真实接口隔离验证：可见性、媒体复用、并发、提交去重与恢复上下文 */
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
  async function request(path, method = 'GET', body, admin = false, headers = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: {
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(admin ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      })
      const result = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      checks++
      return { status: response.status, body: result }
    }
  }
  async function ok(path, method = 'GET', body, admin = false, headers) {
    const result = await request(path, method, body, admin, headers)
    assert(result.status < 300, `${method} ${path}: ${result.status} ${JSON.stringify(result.body)}`)
    return result.body.data
  }
  const adminPath = '/admin/gallery'
  const em = fixture.testOrm.em.fork()
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '', '迁移回放必须零漂移')
  assert.equal((await request(adminPath)).status, 401)
  assert.equal((await request(adminPath, 'POST', {})).status, 401)
  assert.equal((await request(adminPath + '/1', 'PATCH', { revision: 0 })).status, 401)
  assert.equal((await request(adminPath + '/1?revision=0', 'DELETE')).status, 401)
  assert.equal((await ok('/gallery')).total, 0)
  assert.deepEqual((await ok('/gallery/metadata')).stats, { photos: 0, categories: 0, locations: 0 })
  assert.equal((await request('/gallery?status=draft')).status, 400)
  for (const id of ['0', '-1', '999999999999999999999']) {
    assert.equal((await request(`/gallery/${id}`)).status, 400)
    assert.equal((await request(`${adminPath}/${id}`, 'PATCH', { revision: 0 }, true)).status, 400)
  }
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'gallery.png')
  const asset = await ok('/admin/media', 'POST', form, true)
  assert.equal((await ok('/gallery')).total, 0, '上传不能自动公开作品')
  const body = { title: '100% 湖面', description: '光线随风移动', mediaId: asset.id, requestId: randomUUID() }
  for (const invalid of [
    { title: '' },
    { takenOn: '2026-02-30' },
    { takenOn: '2026-09-10T12:00:00Z' },
    { mediaId: randomUUID() },
    { width: 123 },
    { status: 'public' },
    { revision: -1 },
    { title: null },
    { sortOrder: 0.5 },
    { publishedAt: '2020-01-01' },
    { category: 'x'.repeat(41) },
  ]) {
    assert.equal((await request(adminPath, 'POST', { ...body, ...invalid }, true)).status, 400)
  }
  const [photo, duplicate] = await Promise.all([ok(adminPath, 'POST', body, true), ok(adminPath, 'POST', body, true)])
  assert.equal(photo.id, duplicate.id)
  assert.equal(photo.width, asset.width)
  assert.equal(photo.height, asset.height)
  assert.equal(photo.format, 'image/webp')
  assert.equal(photo.date, '')
  assert.equal(photo.publishedAt, null)
  assert.equal(photo.status, 'draft')
  assert.equal((await request(`/gallery/${photo.id}`)).status, 404)
  assert.equal((await request(adminPath, 'POST', { ...body, title: '不同内容' }, true)).status, 409)
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).item.id, photo.id)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409)
  let saved = await ok(
    `${adminPath}/${photo.id}`,
    'PATCH',
    { revision: photo.revision, status: 'published', takenOn: '2026-09-10', category: '湖泊' },
    true,
  )
  assert.equal(saved.date, '2026-09-10')
  assert(saved.publishedAt)
  const publishedAt = saved.publishedAt
  const publicPhoto = await ok(`/gallery/${photo.id}`)
  for (const field of [
    'revision',
    'requestId',
    'requestHash',
    'mediaId',
    'storageKey',
    'status',
    'deletedAt',
    'createdAt',
  ])
    assert(!(field in publicPhoto), `公开DTO不得泄露 ${field}`)
  assert.equal((await ok('/gallery?q=100%25')).total, 1)
  assert.equal((await ok('/gallery?q=_')).total, 0, '搜索通配符应按文字处理')
  assert.equal((await ok('/gallery?category=湖泊')).total, 1)
  assert.equal((await ok('/gallery?category=')).total, 0)
  assert.deepEqual((await ok('/gallery/metadata')).categories, [{ value: '湖泊', count: 1, label: '湖泊' }])
  const concurrent = await Promise.all([
    request(`${adminPath}/${photo.id}`, 'PATCH', { revision: saved.revision, title: '窗前湖水' }, true),
    request(`${adminPath}/${photo.id}`, 'PATCH', { revision: saved.revision, title: '远处山影' }, true),
  ])
  assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409])
  saved = await ok(`${adminPath}/${photo.id}`, 'GET', undefined, true)
  const secondForm = new FormData()
  secondForm.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'replacement.png',
  )
  const replacement = await ok('/admin/media', 'POST', secondForm, true)
  const shared = await ok(
    '/admin/moments',
    'POST',
    { requestId: randomUUID(), content: '湖边记录', images: [asset.url], status: 'draft' },
    true,
  )
  saved = await ok(
    `${adminPath}/${photo.id}`,
    'PATCH',
    { revision: saved.revision, mediaId: replacement.id, status: 'withdrawn' },
    true,
  )
  assert.equal((await request(`/gallery/${photo.id}`)).status, 404)
  assert.equal((await ok('/gallery/metadata')).stats.photos, 0)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409, '保留朋友圈共用图片')
  const refs = await ok(`/admin/media/${replacement.id}/references`, 'GET', undefined, true)
  assert(refs.items.some((item) => item.kind === 'gallery' && item.url === `${adminPath}?edit=${photo.id}`))
  assert.equal(
    (await request(`/admin/media/${replacement.id}`, 'DELETE', undefined, true)).status,
    409,
    '撤回作品保留媒体引用',
  )
  saved = await ok(
    `${adminPath}/${photo.id}`,
    'PATCH',
    { revision: saved.revision, status: 'published', category: '' },
    true,
  )
  assert.equal(saved.publishedAt, publishedAt)
  assert.equal((await ok('/gallery?category=')).total, 1)
  for (let index = 0; index < 14; index++)
    await ok(adminPath, 'POST', { ...body, requestId: randomUUID(), title: `湖边 ${index}`, status: 'published' }, true)
  const first = await ok('/gallery'),
    second = await ok('/gallery?page=2')
  assert.equal(first.items.length, 12)
  assert.equal(second.items.length, 3)
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 15)
  assert.deepEqual(
    (await ok('/gallery')).items.map((item) => item.id),
    first.items.map((item) => item.id),
  )
  const sorted = await ok(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, sortOrder: 999 }, true)
  assert.equal((await ok('/gallery')).items[0].id, saved.id)
  assert.equal(
    (await request(`${adminPath}/${saved.id}?revision=${saved.revision}`, 'DELETE', undefined, true)).status,
    409,
  )
  await ok(`${adminPath}/${saved.id}?revision=${sorted.revision}`, 'DELETE', undefined, true)
  await ok(`${adminPath}/${saved.id}?revision=${sorted.revision}`, 'DELETE', undefined, true)
  assert.equal((await request(adminPath, 'POST', body, true)).status, 409, '删除后旧提交不能复活作品')
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).state, 'deleted')
  await ok(`/admin/media/${replacement.id}`, 'DELETE', undefined, true)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409)
  assert.equal((await ok(`/admin/moments/${shared.id}`, 'GET', undefined, true)).images[0], asset.url)
  const settings = await ok(adminPath + '/settings', 'GET', undefined, true)
  assert.deepEqual(settings.gear, [])
  const gear = [{ name: '随身相机', description: '日常记录', icon: 'lucide:camera' }]
  await ok(adminPath + '/settings', 'PATCH', { revision: settings.revision, gear }, true)
  assert.deepEqual((await ok('/gallery/metadata')).gear, gear)
  assert.equal(
    (await request(adminPath + '/settings', 'PATCH', { revision: settings.revision, gear: [] }, true)).status,
    409,
  )
  assert.equal(
    (await request(adminPath + '/settings', 'PATCH', { revision: 1, gear: [{ ...gear[0], icon: 'unsafe' }] }, true))
      .status,
    400,
  )
  const audit = await em.execute("select action,state from audit_entry where action like 'gallery.%'")
  assert(audit.some((entry) => entry.action === 'gallery.create' && entry.state === 'success'))
  assert(audit.some((entry) => entry.action === 'gallery.delete' && entry.state === 'success'))
  await em.execute("update content_context set require_context=true,generation=? where id='default'", [randomUUID()])
  assert.equal((await request(adminPath, 'POST', { ...body, requestId: randomUUID() }, true)).status, 428)
  assert.equal(
    (
      await request(adminPath, 'POST', { ...body, requestId: randomUUID() }, true, {
        'X-Content-Context': randomUUID(),
      })
    ).status,
    409,
  )
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    `图库接口验证通过：${checks}请求，迁移零漂移、公开过滤、并发版本、创建去重、媒体复用、配置、审计和恢复上下文\n`,
  )
} finally {
  await fixture.close()
}
