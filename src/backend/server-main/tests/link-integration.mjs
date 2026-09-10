/** @file link-integration.mjs @description 友链隔离接口验证：真实持久化、路径语义、重复校验、媒体与管理边界 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
let checks = 0,
  externalVisits = 0
const external = createServer((_request, response) => {
  externalVisits++
  response.end('unexpected visit')
})
await new Promise((resolve) => external.listen(0, '127.0.0.1', resolve))
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
    adminPath = '/admin/links'
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  for (const [path, method, body] of [
    [adminPath, 'GET'],
    [adminPath, 'POST', {}],
    [adminPath + '/1', 'PATCH', { revision: 0 }],
    [adminPath + '/1?revision=0', 'DELETE'],
    [adminPath + '/settings', 'PATCH', { revision: 0, rules: [] }],
  ])
    assert.equal((await request(path, method, body)).status, 401)
  assert.equal((await ok('/links')).total, 0)
  assert.deepEqual(await ok('/links/metadata'), { stats: { links: 0, featured: 0, domains: 0 }, rules: [] })
  const body = {
    name: '100% 前端阅读',
    url: 'HTTPS://EXAMPLE.COM:443/Docs/Guide?tag=A&tag=B#Intro',
    requestId: randomUUID(),
  }
  for (const extra of [
    { name: '' },
    { name: null },
    { name: '长'.repeat(81) },
    { description: '长'.repeat(301) },
    { url: null },
    { url: '#' },
    { url: 'https:example.com' },
    { url: 'javascript:alert(1)' },
    { url: 'https://user:password@example.com/Docs' },
    { url: 'https://example.com/a\\b' },
    { url: 'https://example.com/a b' },
    { url: 'https://example.com/a\nb' },
    { url: 'https://example.com/' + '路'.repeat(300) },
    { domain: 'forged.example' },
    { avatar: 'https://example.com/a.png' },
    { isFeatured: 'true' },
    { status: 'enabled' },
    { sortOrder: 0.5 },
    { publishedAt: '2020-01-01' },
    { revision: 0 },
    { logoMediaId: randomUUID() },
    { logoUrl: 'http://example.com/logo.png' },
    { logoUrl: 'data:image/png;base64,a' },
    { logoUrl: 'https://other.example/api/v1/media/' + randomUUID() + '.webp' },
    { logoUrl: 'https://example.com/a.png', logoMediaId: randomUUID() },
  ])
    assert.equal((await request(adminPath, 'POST', { ...body, ...extra }, true)).status, 400, JSON.stringify(extra))
  const [created, repeated] = await Promise.all([ok(adminPath, 'POST', body, true), ok(adminPath, 'POST', body, true)])
  assert.equal(created.id, repeated.id)
  assert.equal(created.status, 'draft')
  assert.equal(created.url, 'https://example.com/Docs/Guide?tag=A&tag=B#Intro')
  assert.equal(created.domain, 'example.com')
  assert.equal(created.avatar, null)
  assert.equal(created.publishedAt, null)
  assert.equal((await request(`/links/${created.id}`)).status, 404)
  assert.equal((await request('/links?status=draft')).status, 400)
  assert.equal((await request('/links?featured=all')).status, 400)
  assert.equal((await request(adminPath, 'POST', { ...body, name: '改变提交' }, true)).status, 409)
  const duplicateId = randomUUID()
  const duplicate = await request(adminPath, 'POST', { ...body, url: created.url, requestId: duplicateId }, true)
  assert.equal(duplicate.status, 400)
  assert.match(JSON.stringify(duplicate.body), /已存在/)
  assert.equal((await request(`${adminPath}/submissions/${duplicateId}`, 'GET', undefined, true)).status, 404)
  const corrected = await ok(
    adminPath,
    'POST',
    { ...body, url: created.url.replace('/Docs/', '/docs/'), requestId: duplicateId },
    true,
  )
  assert.notEqual(corrected.id, created.id, '重复失败后可保留同一请求标识修正地址重新提交')
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).item.id, created.id)
  for (const url of [
    created.url + '/',
    created.url.replace('tag=A&tag=B', 'tag=B&tag=A'),
    created.url.replace('#Intro', '#intro'),
    created.url.replace('/Guide?', '/Guide/?'),
  ])
    await ok(adminPath, 'POST', { name: '不同路径与参数', url, requestId: randomUUID() }, true)
  assert.equal((await ok('/links?q=100%25')).total, 0, '非公开搜索不能泄露草稿')
  const upload = new FormData()
  upload.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'friend-logo.png',
  )
  const asset = await ok('/admin/media', 'POST', upload, true)
  let saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    { revision: created.revision, status: 'published', isFeatured: true, sortOrder: 9, logoMediaId: asset.id },
    true,
  )
  assert.equal(saved.avatar, asset.url)
  assert.equal(saved.width, asset.width)
  assert.equal(saved.height, asset.height)
  assert.ok(saved.publishedAt)
  const publicItem = await ok(`/links/${saved.id}`)
  for (const field of [
    'status',
    'revision',
    'requestId',
    'requestHash',
    'deletedAt',
    'logoMediaId',
    'logoUrl',
    'storageKey',
  ])
    assert.equal(field in publicItem, false, field)
  assert.equal((await fetch(fixture.origin + asset.url)).status, 200)
  assert.equal((await ok('/links?q=100%25')).total, 1)
  assert.equal((await ok('/links?featured=true')).total, 1)
  assert.equal((await ok('/links?featured=false')).total, 0)
  assert.equal(
    (await request(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, url: corrected.url }, true)).status,
    400,
  )
  assert.equal((await ok(`${adminPath}/${saved.id}`, 'GET', undefined, true)).url, created.url)
  const refs = await ok(`/admin/media/${asset.id}/references`, 'GET', undefined, true)
  assert(refs.items.some((item) => item.kind === 'link' && item.url === `/admin/links/${saved.id}`))
  const gallery = await ok(
    '/admin/gallery',
    'POST',
    { title: '共享一张配图', mediaId: asset.id, requestId: randomUUID() },
    true,
  )
  const project = await ok(
    '/admin/projects',
    'POST',
    { title: '共享封面', coverMediaId: asset.id, requestId: randomUUID() },
    true,
  )
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status, 409)
  const changed = await Promise.all([
    request(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, description: '版本一' }, true),
    request(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, description: '版本二' }, true),
  ])
  assert.deepEqual(changed.map((item) => item.status).sort(), [200, 409])
  saved = await ok(`${adminPath}/${saved.id}`, 'GET', undefined, true)
  assert.equal(
    (
      await request(
        `${adminPath}/${saved.id}`,
        'PATCH',
        { revision: saved.revision, logoUrl: 'https://example.com/avatar.png' },
        true,
      )
    ).status,
    400,
  )
  saved = await ok(
    `${adminPath}/${saved.id}`,
    'PATCH',
    { revision: saved.revision, logoMediaId: null, logoUrl: 'https://EXAMPLE.COM:443/avatar.png' },
    true,
  )
  assert.equal(saved.avatar, 'https://example.com/avatar.png')
  assert.equal(saved.width, null)
  assert.equal(saved.height, null)
  assert(
    !(await ok(`/admin/media/${asset.id}/references`, 'GET', undefined, true)).items.some(
      (item) => item.kind === 'link',
    ),
  )
  assert.equal(
    (await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status,
    409,
    '图库和项目仍使用文件',
  )
  const [copy] = await em.execute(
    `insert into friend_link (name,url,status,created_at,updated_at) values (?,?,'draft',now(),now()) returning id`,
    ['迁入后待核对', saved.url],
  )
  let copied = await ok(
    `${adminPath}/${copy.id}`,
    'PATCH',
    { revision: 0, description: '保留同址导入草稿的编辑' },
    true,
  )
  assert.equal(
    (await request(`${adminPath}/${copy.id}`, 'PATCH', { revision: copied.revision, status: 'published' }, true))
      .status,
    400,
  )
  saved = await ok(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, status: 'withdrawn' }, true)
  assert.equal((await request(`/links/${saved.id}`)).status, 404)
  copied = await ok(`${adminPath}/${copy.id}`, 'PATCH', { revision: copied.revision, status: 'published' }, true)
  assert.equal(copied.status, 'published')
  assert.equal(
    (await request(`${adminPath}/${saved.id}`, 'PATCH', { revision: saved.revision, status: 'published' }, true))
      .status,
    400,
  )
  for (let i = 0; i < 16; i++)
    await ok(
      adminPath,
      'POST',
      {
        name: `阅读清单 ${i}`,
        description: i === 0 ? '说明'.repeat(150) : '',
        url: `https://read.example/Notes/${i}?type=A&type=B`,
        isFeatured: i % 3 === 0,
        sortOrder: i % 2,
        status: 'published',
        requestId: randomUUID(),
      },
      true,
    )
  const all = await ok('/links?pageSize=48'),
    first = await ok('/links'),
    second = await ok('/links?page=2')
  const expected = await em.execute(
    `select id from friend_link where status='published' and deleted_at is null order by is_featured desc,sort_order desc,id desc`,
  )
  assert.equal(first.items.length, 12)
  assert.equal(second.items.length, 5)
  assert.deepEqual(
    [...first.items, ...second.items].map((item) => item.id),
    expected.map((item) => item.id),
  )
  const metadata = await ok('/links/metadata')
  assert.deepEqual(metadata.stats, {
    links: all.total,
    featured: all.items.filter((item) => item.isFeatured).length,
    domains: new Set(all.items.map((item) => item.domain)).size,
  })
  assert.equal((await ok('/links?q=missing')).total, 0)
  assert.equal((await ok('/links?page=99')).items.length, 0)
  const settings = await ok(adminPath + '/settings', 'GET', undefined, true)
  for (const rules of [null, [''], [true], Array.from({ length: 13 }, () => '规则'), ['长'.repeat(301)]])
    assert.equal(
      (await request(adminPath + '/settings', 'PATCH', { revision: settings.revision, rules }, true)).status,
      400,
    )
  const rules = await ok(
    adminPath + '/settings',
    'PATCH',
    { revision: settings.revision, rules: [' 分享认真维护的站点 ', '推荐表示博主的选择。'] },
    true,
  )
  assert.deepEqual(rules.rules, ['分享认真维护的站点', '推荐表示博主的选择。'])
  assert.equal(
    (await request(adminPath + '/settings', 'PATCH', { revision: settings.revision, rules: [] }, true)).status,
    409,
  )
  assert.deepEqual((await ok('/links/metadata')).rules, rules.rules)
  const trapUrl = `http://127.0.0.1:${external.address().port}/SubmittedSite`
  const noFetch = await ok(
    adminPath,
    'POST',
    { name: '地址只用于跳转', url: trapUrl, status: 'published', requestId: randomUUID() },
    true,
  )
  await ok(`/links/${noFetch.id}`)
  assert.equal(externalVisits, 0, '保存或读取友链不抓取站点信息')
  assert.equal((await request('/links', 'POST', {})).status, 404, '未开放公开申请')
  assert.equal((await request(`${adminPath}/${saved.id}?revision=0`, 'DELETE', undefined, true)).status, 409)
  await ok(`${adminPath}/${saved.id}?revision=${saved.revision}`, 'DELETE', undefined, true)
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).state, 'deleted')
  assert.equal((await request(adminPath, 'POST', body, true)).status, 409)
  await ok(`/admin/gallery/${gallery.id}?revision=${gallery.revision}`, 'DELETE', undefined, true)
  await ok(`/admin/projects/${project.id}?revision=${project.revision}`, 'DELETE', undefined, true)
  await ok(`/admin/media/${asset.id}`, 'DELETE', undefined, true)
  const siteResponse = await fetch(fixture.origin + '/api/v1/site')
  const oldContext = siteResponse.headers.get('x-content-context')
  const newContext = randomUUID()
  await em.execute(`update content_context set require_context=true,generation=? where id='default'`, [newContext])
  assert.equal(
    (await request(`${adminPath}/${copied.id}`, 'PATCH', { revision: copied.revision, name: '缺少内容库标识' }, true))
      .status,
    428,
  )
  assert.equal(
    (
      await request(`${adminPath}/${copied.id}`, 'PATCH', { revision: copied.revision, name: '旧页面' }, true, {
        'X-Content-Context': oldContext,
      })
    ).status,
    409,
  )
  await ok(`${adminPath}/${copied.id}`, 'PATCH', { revision: copied.revision, description: '新内容库继续维护' }, true, {
    'X-Content-Context': newContext,
  })
  const audits = await em.execute(`select action,summary from audit_entry where action like 'link.%'`)
  for (const action of ['link.create', 'link.update', 'link.delete', 'link.settings'])
    assert(
      audits.some((item) => item.action === action),
      action,
    )
  assert(!JSON.stringify(audits).includes(token))
  assert(!JSON.stringify(audits).includes(trapUrl))
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    `友链接口通过：${checks}请求，公开过滤、规范化路径、重复可修正、并发版本、真实媒体复用、独立规则、无抓取及恢复上下文\n`,
  )
} finally {
  await new Promise((resolve) => external.close(resolve))
  await fixture.close()
}
