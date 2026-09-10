/** @file project-integration.mjs @description 项目真实接口隔离验证：双状态、技术统计、外链、媒体、幂等与并发 */
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
  const em = fixture.testOrm.em.fork(),
    adminPath = '/admin/projects'
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  for (const [path, method, body] of [
    [adminPath, 'GET'],
    [adminPath, 'POST', {}],
    [adminPath + '/1', 'PATCH', { revision: 0 }],
    [adminPath + '/1?revision=0', 'DELETE'],
  ])
    assert.equal((await request(path, method, body)).status, 401)
  assert.equal((await ok('/projects')).total, 0)
  assert.deepEqual((await ok('/projects/metadata')).stats, { projects: 0, active: 0, dev: 0, archived: 0, tags: 0 })
  const body = { title: '100% 页面整理', requestId: randomUUID(), progress: 'archived' }
  for (const extra of [
    { title: '' },
    { title: null },
    { progress: 'published' },
    { status: 'active' },
    { stars: 99 },
    { forks: 1 },
    { coverMediaId: randomUUID() },
    { sortOrder: 0.5 },
    { publishedAt: '2020-01-01' },
    { tags: [{ label: '', color: 'blue' }] },
    { tags: [{ label: 'Vue', color: 'javascript:bad' }] },
    { tags: null },
    { links: [{ kind: 'source', href: '#' }] },
    { links: [{ kind: 'source', href: 'https://user:password@example.com/Docs' }] },
    { links: [{ kind: 'docs', href: 'javascript:alert(1)' }] },
    { links: [{ kind: 'docs', href: 'https://example.com/a\\b' }] },
    { links: [{ kind: 'docs', href: 'https://example.com/a b' }] },
    { links: [{ kind: 'docs', href: 'https://example.com/' + '路'.repeat(300) }] },
    {
      links: [
        { kind: 'docs', href: 'https://example.com/' },
        { kind: 'docs', href: 'https://example.com/guide' },
      ],
    },
  ])
    assert.equal((await request(adminPath, 'POST', { ...body, ...extra }, true)).status, 400, JSON.stringify(extra))
  const [created, repeated] = await Promise.all([ok(adminPath, 'POST', body, true), ok(adminPath, 'POST', body, true)])
  assert.equal(created.id, repeated.id)
  assert.equal(created.status, 'draft')
  assert.equal(created.progress, 'archived')
  assert.equal(created.cover, null)
  assert.equal(created.width, null)
  assert.equal(created.publishedAt, null)
  assert.equal((await request(`/projects/${created.id}`)).status, 404)
  assert.equal((await request('/projects?status=draft')).status, 400)
  assert.equal((await request(adminPath, 'POST', { ...body, title: '改变内容' }, true)).status, 409)
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).item.id, created.id)
  const form = new FormData()
  form.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'project-cover.png',
  )
  const asset = await ok('/admin/media', 'POST', form, true)
  let saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    {
      revision: created.revision,
      status: 'published',
      coverMediaId: asset.id,
      tags: [
        { label: ' TypeScript ', color: 'blue' },
        { label: 'typescript', color: 'sky' },
        { label: 'Vue', color: 'emerald' },
      ],
      links: [{ kind: 'docs', href: 'HTTPS://EXAMPLE.COM:443/Docs/Guide?tag=A&tag=B#Intro' }],
    },
    true,
  )
  assert.equal(saved.progress, 'archived', '项目归档进展不应阻止内容公开')
  assert.equal(saved.tags.length, 2)
  assert.equal(saved.tags[0].label, 'TypeScript')
  assert.equal(saved.cover, asset.url)
  assert.equal(saved.width, asset.width)
  assert.equal(saved.height, asset.height)
  assert.equal(saved.links[0].href, 'https://example.com/Docs/Guide?tag=A&tag=B#Intro')
  assert.equal(saved.links[0].label, '文档')
  assert.equal(saved.links[0].icon, 'lucide:book-open')
  const publishedAt = saved.publishedAt
  const publicItem = await ok(`/projects/${created.id}`)
  for (const field of [
    'status',
    'revision',
    'requestId',
    'requestHash',
    'sortOrder',
    'coverMediaId',
    'storageKey',
    'stars',
    'forks',
    'createdAt',
  ])
    assert(!(field in publicItem), field)
  assert.equal((await ok('/projects?progress=archived&tag=typescript')).total, 1)
  assert.equal((await ok('/projects?tag=TypeScript')).total, 1)
  assert.equal((await ok('/projects?tag=vue')).total, 1)
  assert.equal((await ok('/projects?tag=missing')).total, 0)
  assert.equal((await ok('/projects?q=100%25')).total, 1)
  assert.equal((await ok('/projects?q=_')).total, 0)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409)
  const refs = await ok(`/admin/media/${asset.id}/references`, 'GET', undefined, true)
  assert(refs.items.some((item) => item.kind === 'project' && item.url === `${adminPath}/${created.id}`))
  const concurrent = await Promise.all([
    request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, description: '第一份整理' }, true),
    request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, description: '第二份整理' }, true),
  ])
  assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409])
  saved = await ok(`${adminPath}/${created.id}`, 'GET', undefined, true)
  const gallery = await ok(
    '/admin/gallery',
    'POST',
    { requestId: randomUUID(), title: '封面构图', mediaId: asset.id },
    true,
  )
  saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    { revision: saved.revision, coverMediaId: null, status: 'withdrawn', progress: 'active' },
    true,
  )
  assert.equal(saved.cover, null)
  assert.equal((await request(`/projects/${created.id}`)).status, 404, '维护中进展不会自动公开项目')
  assert.equal((await ok('/projects/metadata')).stats.projects, 0)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409, '图库仍使用旧封面')
  assert.equal((await ok(`/admin/gallery/${gallery.id}`, 'GET', undefined, true)).mediaId, asset.id)
  saved = await ok(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, status: 'published' }, true)
  assert.equal(saved.publishedAt, publishedAt)
  for (let index = 0; index < 14; index++)
    await ok(
      adminPath,
      'POST',
      {
        title: `阅读工具 ${index}`,
        requestId: randomUUID(),
        status: 'published',
        progress: index % 2 ? 'dev' : 'active',
        tags: [{ label: 'typescript', color: 'blue' }],
      },
      true,
    )
  const page1 = await ok('/projects'),
    page2 = await ok('/projects?page=2')
  assert.equal(page1.items.length, 12)
  assert.equal(page2.items.length, 3)
  assert.equal(new Set([...page1.items, ...page2.items].map((item) => item.id)).size, 15)
  const meta = await ok('/projects/metadata')
  assert.equal(meta.stats.projects, 15)
  assert.equal(meta.tags.find((tag) => tag.label.toLowerCase() === 'typescript').count, 15)
  assert.equal(meta.tags.find((tag) => tag.label.toLowerCase() === 'typescript').percent, 100)
  assert.equal(meta.tags.find((tag) => tag.label === 'Vue').count, 1)
  assert.equal(meta.stats.active + meta.stats.dev + meta.stats.archived, 15)
  saved = await ok(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, sortOrder: 1000000 }, true)
  assert.equal((await ok('/projects')).items[0].id, created.id)
  assert.equal(
    (await request(`${adminPath}/${created.id}?revision=${saved.revision - 1}`, 'DELETE', undefined, true)).status,
    409,
  )
  await ok(`${adminPath}/${created.id}?revision=${saved.revision}`, 'DELETE', undefined, true)
  await ok(`${adminPath}/${created.id}?revision=${saved.revision}`, 'DELETE', undefined, true)
  assert.equal((await request(adminPath, 'POST', body, true)).status, 409)
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).state, 'deleted')
  assert.equal((await ok('/projects/metadata')).stats.tags, 1)
  const audit = await em.execute("select action,state from audit_entry where action like 'project.%'")
  assert(audit.some((item) => item.action === 'project.create' && item.state === 'success'))
  assert(audit.some((item) => item.action === 'project.delete' && item.state === 'success'))
  await em.execute("update content_context set require_context=true,generation=? where id='default'", [randomUUID()])
  assert.equal((await request(adminPath, 'POST', { title: '旧内容库操作', requestId: randomUUID() }, true)).status, 428)
  assert.equal(
    (
      await request(adminPath, 'POST', { title: '旧内容库操作', requestId: randomUUID() }, true, {
        'X-Content-Context': randomUUID(),
      })
    ).status,
    409,
  )
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    `项目接口验证通过：${checks}请求，独立进展/发布、真实技术统计、媒体复用、链接规范、幂等并发与迁移零漂移\n`,
  )
} finally {
  await fixture.close()
}
