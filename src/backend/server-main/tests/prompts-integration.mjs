/** @file prompts-integration.mjs @description 图片提示词真实接口隔离验证：公开边界、媒体、筛选、幂等与并发 */
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
  const adminPath = '/admin/prompts'
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  for (const [path, method, body] of [
    [adminPath, 'GET'],
    [adminPath, 'POST', {}],
    [adminPath + '/1', 'PATCH', { revision: 0 }],
  ])
    assert.equal((await request(path, method, body)).status, 401)
  assert.equal((await ok('/prompts')).total, 0)
  assert.deepEqual(await ok('/prompts/metadata'), { stats: { prompts: 0, models: 0, tags: 0 }, models: [], tags: [] })
  const body = {
    requestId: randomUUID(),
    title: '100% 夜色练习',
    prompt: '一座雨后的城市，暖色窗灯。\n35mm film, soft grain.',
    externalImageUrl: 'https://images.example.com/city%2Fnight.webp?a=1&a=2',
    imageAlt: '雨后街道和暖色窗灯',
    model: 'Flux.1',
    tags: [' 夜色 ', 'Film', 'film'],
  }
  for (const extra of [
    { title: '' },
    { title: null },
    { prompt: ' ' },
    { prompt: null },
    { tags: [' '] },
    { tags: [1] },
    { tags: null },
    { model: null },
    { description: null },
    { status: 'withdrawn' },
    { externalImageUrl: null },
    { externalImageUrl: 'javascript:alert(1)' },
    { externalImageUrl: 'https://user:secret@example.com/a' },
    { externalImageUrl: 'https://example.com/a b' },
    { sourceUrl: 'file:///tmp/a' },
    { mediaId: randomUUID() },
    { revision: 0 },
    { publishedAt: '2020-01-01' },
    { likes: 5 },
  ])
    assert.equal((await request(adminPath, 'POST', { ...body, ...extra }, true)).status, 400, JSON.stringify(extra))
  assert.equal((await request(adminPath, 'POST', body, true, { Origin: 'https://unrelated.example' })).status, 403)
  const [created, repeated] = await Promise.all([ok(adminPath, 'POST', body, true), ok(adminPath, 'POST', body, true)])
  assert.equal(created.id, repeated.id)
  assert.equal(created.status, 'draft')
  assert.equal(created.publishedAt, null)
  assert.deepEqual(created.tags, ['夜色', 'Film'])
  assert.equal(created.imageUrl, body.externalImageUrl)
  assert.equal(created.width, null)
  assert.equal(created.height, null)
  assert.equal((await request(`/prompts/${created.id}`)).status, 404)
  assert.equal((await request('/prompts?status=draft')).status, 400)
  assert.equal((await request(adminPath, 'POST', { ...body, title: '变化的提交' }, true)).status, 409)
  assert.equal((await ok(`${adminPath}/submissions/${body.requestId}`, 'GET', undefined, true)).item.id, created.id)
  assert.equal((await ok(`${adminPath}?status=draft`, 'GET', undefined, true)).total, 1)
  let saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    {
      revision: created.revision,
      status: 'published',
      negativePrompt: 'blur, oversaturated',
      sourceUrl: 'HTTPS://EXAMPLE.COM:443/Work',
    },
    true,
  )
  assert.equal(saved.sourceUrl, 'https://example.com/Work')
  const publishedAt = saved.publishedAt
  const publicItem = await ok(`/prompts/${created.id}`)
  assert.equal(publicItem.prompt, body.prompt)
  for (const field of [
    'status',
    'revision',
    'requestId',
    'requestHash',
    'mediaId',
    'externalImageUrl',
    'storageKey',
    'createdAt',
    'updatedAt',
  ])
    assert(!(field in publicItem), field)
  assert.equal((await ok('/prompts?tag=film&model=flux.1')).total, 1)
  assert.equal((await ok('/prompts?q=100%25')).total, 1)
  assert.equal((await ok('/prompts?q=_')).total, 0)
  assert.equal((await ok('/prompts?q=35mm')).total, 1)
  assert.equal((await ok('/prompts?tag=missing')).total, 0)
  const concurrent = await Promise.all([
    request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, description: '第一份整理' }, true),
    request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, description: '第二份整理' }, true),
  ])
  assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409])
  saved = await ok(`${adminPath}/${created.id}`, 'GET', undefined, true)
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'prompt-image.png')
  const asset = await ok('/admin/media', 'POST', form, true)
  assert.equal(
    (await request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, mediaId: asset.id }, true))
      .status,
    400,
  )
  saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    { revision: saved.revision, mediaId: asset.id, externalImageUrl: null, status: 'draft' },
    true,
  )
  assert.equal(saved.imageUrl, asset.url)
  assert.equal(saved.width, asset.width)
  assert.equal((await request(`/prompts/${created.id}`)).status, 404)
  assert.equal((await ok('/prompts/metadata')).stats.prompts, 0)
  assert.equal(
    (await request(`/admin/media/${asset.id}`, 'DELETE', undefined, true)).status,
    409,
    '草稿图片也必须受引用保护',
  )
  const refs = await ok(`/admin/media/${asset.id}/references`, 'GET', undefined, true)
  assert(refs.items.some((item) => item.kind === 'image-prompt' && item.title === body.title))
  saved = await ok(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, status: 'published' }, true)
  assert.equal(saved.publishedAt, publishedAt)
  for (let index = 0; index < 13; index++)
    await ok(
      adminPath,
      'POST',
      {
        title: `光影练习 ${index}`,
        prompt: `窗边的静物，方向 ${index}`,
        requestId: randomUUID(),
        externalImageUrl: 'https://images.example.com/still-life.webp',
        status: 'published',
        tags: ['film'],
        model: index % 2 ? 'flux.1' : 'Imagen',
      },
      true,
    )
  const first = await ok('/prompts'),
    second = await ok('/prompts?page=2')
  assert.equal(first.total, 14)
  assert.equal(first.items.length, 12)
  assert.equal(second.items.length, 2)
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 14)
  const meta = await ok('/prompts/metadata')
  assert.deepEqual(meta.stats, { prompts: 14, models: 2, tags: 2 })
  assert.equal(meta.tags.find((tag) => tag.label.toLowerCase() === 'film').count, 14)
  assert.equal(meta.models.find((model) => model.label.toLowerCase() === 'flux.1').count, 7)
  saved = await ok(
    `${adminPath}/${created.id}`,
    'PATCH',
    { revision: saved.revision, mediaId: null, externalImageUrl: body.externalImageUrl },
    true,
  )
  assert.equal((await ok(`/admin/media/${asset.id}/references`, 'GET', undefined, true)).items.length, 0)
  await ok(`/admin/media/${asset.id}`, 'DELETE', undefined, true)
  const em = fixture.testOrm.em.fork()
  const audit = await em.execute("select action,state from audit_entry where action like 'image-prompt.%'")
  assert(audit.some((item) => item.action === 'image-prompt.create' && item.state === 'success'))
  assert(audit.some((item) => item.action === 'image-prompt.update' && item.state === 'success'))
  await em.execute("update content_context set require_context=true,generation=? where id='default'", [randomUUID()])
  assert.equal(
    (await request(`${adminPath}/${created.id}`, 'PATCH', { revision: saved.revision, description: '旧编辑器' }, true))
      .status,
    428,
  )
  assert.equal(
    (
      await request(
        `${adminPath}/${created.id}`,
        'PATCH',
        { revision: saved.revision, description: '错误上下文' },
        true,
        { 'X-Content-Context': randomUUID() },
      )
    ).status,
    409,
  )
  assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
  process.stdout.write(
    `图片提示词接口验证通过：${checks} 请求，公开过滤、来源互斥、模型标签、分页、媒体保护、幂等并发及迁移零漂移\n`,
  )
} finally {
  await fixture.close()
}
