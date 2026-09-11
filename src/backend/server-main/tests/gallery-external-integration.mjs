/** @file gallery-external-integration.mjs @description 隔离验证外链互斥、切换引用、无抓取及 v7/旧内容包维护 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
let remoteRequests = 0
const remote = createServer((_req, res) => {
  remoteRequests++
  res.writeHead(503).end()
})
await new Promise((resolve) => remote.listen(0, '127.0.0.1', resolve))
const externalUrl = `http://127.0.0.1:${remote.address().port}/Picture?Signature=Ab%2Fc&tag=A&tag=B#Frame`
let token,
  writes = 0,
  checks = 0
try {
  async function request(path, method = 'GET', body) {
    if (method !== 'GET' && ++writes % 4 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    })
    checks++
    return { status: response.status, data: await response.json() }
  }
  async function ok(path, method = 'GET', body) {
    const value = await request(path, method, body)
    assert(value.status < 300, `${path}: ${value.status} ${JSON.stringify(value.data)}`)
    return value.data.data
  }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  const em = fixture.testOrm.em.fork()
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  const file = new FormData()
  file.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'shared.png')
  const media = await ok('/admin/media', 'POST', file)
  const managed = await ok('/admin/gallery', 'POST', {
    title: '受管作品',
    mediaId: media.id,
    requestId: randomUUID(),
    status: 'published',
  })
  const project = await ok('/admin/projects', 'POST', {
    title: '共享图片的项目',
    coverMediaId: media.id,
    requestId: randomUUID(),
  })
  assert(project.id)
  for (const source of [
    {},
    { mediaId: null, externalUrl: null },
    { mediaId: media.id, externalUrl },
    { externalUrl: '' },
    ...[
      'javascript:alert(1)',
      'data:image/png;base64,AA',
      '//host/a',
      'https:/host/a',
      'https:///host/a',
      'https://user:pass@example.org/a',
      'https://example.org/a\nb',
      'https://example.org/a b',
      'https://example.org/a\\b',
      `https://other.org/api/v1/media/${media.id}.webp`,
      `https://other.org/%2561pi/v1/media/${media.id}.webp`,
    ].map((externalUrl) => ({ externalUrl })),
  ])
    assert.equal(
      (await request('/admin/gallery', 'POST', { title: '拒绝无效来源', requestId: randomUUID(), ...source })).status,
      400,
    )
  const body = { title: '带签名的远方', mediaId: null, externalUrl, requestId: randomUUID(), status: 'published' }
  const external = await ok('/admin/gallery', 'POST', body)
  assert.equal(external.externalUrl, externalUrl)
  assert.equal(external.src, externalUrl)
  assert.equal(external.source, 'external')
  for (const key of ['width', 'height', 'format']) assert.equal(external[key], undefined)
  assert.equal((await ok('/admin/gallery', 'POST', body)).id, external.id)
  assert.equal((await ok(`/gallery/${external.id}`)).src, externalUrl)
  assert.equal((await ok(`/gallery/${external.id}/navigation?pageSize=1`)).matched, true)
  assert.equal((await ok('/gallery/metadata')).stats.photos, 2)
  assert.equal((await request(`/admin/gallery/${managed.id}`, 'PATCH', { revision: 0, externalUrl })).status, 400)
  let changed = await ok(`/admin/gallery/${managed.id}`, 'PATCH', { revision: 0, mediaId: null, externalUrl })
  assert.equal(changed.id, managed.id)
  assert.equal((await em.execute('select * from media_reference where gallery_photo_id=?', [managed.id])).length, 0)
  assert.equal((await request(`/admin/media/${media.id}`, 'DELETE')).status, 409, '其他业务引用继续保护媒体')
  changed = await ok(`/admin/gallery/${managed.id}`, 'PATCH', {
    revision: changed.revision,
    externalUrl: null,
    mediaId: media.id,
  })
  assert.equal(changed.id, managed.id)
  assert.equal((await em.execute('select * from media_reference where gallery_photo_id=?', [managed.id])).length, 1)
  assert.equal(
    (await request(`/admin/gallery/${managed.id}`, 'PATCH', { revision: 0, externalUrl, mediaId: null })).status,
    409,
  )
  let withdrawn = await ok(`/admin/gallery/${external.id}`, 'PATCH', { revision: 0, status: 'withdrawn' })
  assert.equal((await request(`/gallery/${external.id}`)).status, 404)
  withdrawn = await ok(`/admin/gallery/${external.id}`, 'PATCH', { revision: withdrawn.revision, status: 'published' })
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.data
  assert.equal(bundle.version, 7)
  bundle.posts = []
  bundle.projects = []
  assert.equal(bundle.gallery.find((row) => row.sourceId === external.id).values.externalUrl, externalUrl)
  async function preview(input, strategy = 'skip') {
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), 'gallery.json')
    form.append('requestId', randomUUID())
    form.append('strategy', strategy)
    form.append('includeSettings', 'false')
    return request('/admin/backup/imports/preview', 'POST', form)
  }
  const same = await preview(bundle)
  assert.equal(same.status, 201)
  assert.equal(same.data.data.plan.counts.gallery, 0)
  for (const version of [1, 2, 3, 4, 5, 6]) {
    const old = structuredClone(bundle)
    old.version = version
    old.gallery = old.gallery.filter((row) => row.values.mediaId)
    for (const row of old.gallery) delete row.values.externalUrl
    if (version < 6) {
      delete old.links
      delete old.linkSettings
    }
    if (version < 5) delete old.projects
    if (version < 4) {
      delete old.gallery
      delete old.gallerySettings
    }
    if (version < 3) delete old.guestbook
    if (version < 2) delete old.moments
    const legacy = await preview(old)
    assert.equal(legacy.status, 201, `旧 v${version} 包可导入`)
    assert.equal(legacy.data.data.plan.counts.gallery, 0)
    if (version >= 4) {
      old.gallery[0].values.externalUrl = null
      assert.equal((await preview(old)).status, 400, '旧版本不悄悄接受新字段')
    }
  }
  const copied = await preview(bundle, 'copy')
  assert.equal(copied.status, 201)
  const plan = copied.data.data
  const execute = () =>
    ok(`/admin/backup/imports/${plan.ticket}/execute`, 'POST', {
      acknowledgement: '导入为新草稿',
      confirmation: plan.confirmation,
    })
  const result = await execute()
  assert.deepEqual((await execute()).result, result.result)
  for (const row of result.result.gallery) {
    const photo = await ok(`/admin/gallery/${row.id}`)
    assert.equal(photo.status, 'draft')
    if (row.sourceId === external.id) {
      assert.equal(photo.externalUrl, externalUrl)
      assert.equal(photo.mediaId, null)
    }
  }
  const invalid = structuredClone(bundle)
  invalid.gallery[0].values.externalUrl = externalUrl
  assert.equal((await preview(invalid)).status, 400)
  await ok(`/admin/gallery/${external.id}?revision=${withdrawn.revision}`, 'DELETE')
  assert.equal((await ok(`/admin/gallery/submissions/${body.requestId}`)).state, 'deleted')
  assert.equal((await request('/admin/gallery', 'POST', body)).status, 409)
  assert.equal((await em.execute('select * from media_asset')).length, 1, '外链没有创建虚假媒体资产')
  assert.equal(remoteRequests, 0, '保存、读取、维护预览和执行均不访问外链')
  console.log(`图库外链与维护隔离验证通过：${checks} 请求，外部服务器收到 0 请求`)
} finally {
  await new Promise((resolve) => remote.close(resolve))
  await fixture.close()
}
