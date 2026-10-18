/** @file prompts-backup-integration.mjs @description 图片提示词 v10 迁入、旧包兼容、媒体引用、幂等草稿与预览冲突的隔离验收。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
import { stripV10Fields } from './legacy-content-package.mjs'

const fixture = await createBrowserTestApp('http://localhost')
const nativeFetch = globalThis.fetch
const externalRequests = []
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.origin !== fixture.origin) {
    externalRequests.push(url.href)
    throw new Error('提示词导出迁入不能自动请求外部图片或来源链接')
  }
  return nativeFetch(input, options)
}
try {
  let token,
    writes = 0
  async function request(path, method = 'GET', body) {
    if (method !== 'GET' && ++writes % 5 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, data: await response.json() }
  }
  async function ok(path, method = 'GET', body) {
    const response = await request(path, method, body)
    assert(response.status < 300, `${path}: ${response.status} ${response.data.message ?? ''}`)
    return response.data.data
  }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  const image = new FormData()
  image.append(
    'file',
    new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }),
    'window-light.png',
  )
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: image,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const managed = await ok('/admin/prompts', 'POST', {
    requestId: randomUUID(),
    title: '窗边的光',
    description: '柔和漫射光下的静物。',
    prompt: 'A ceramic vase in diffused window light.\nQuiet composition.',
    negativePrompt: 'watermark, blur',
    model: 'Flux',
    tags: ['静物', '光影'],
    mediaId: asset.id,
    externalImageUrl: null,
    imageAlt: '窗边的白色花瓶',
    sourceUrl: 'https://example.org/process',
    status: 'published',
  })
  const external = await ok('/admin/prompts', 'POST', {
    requestId: randomUUID(),
    title: '雨后的巷子',
    prompt: 'An empty alley after rain, delicate reflections.',
    mediaId: null,
    externalImageUrl: 'https://images.example.org/Alley.JPG?tag=A&tag=B#AfterRain',
    status: 'draft',
  })
  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.data
  assert.equal(bundle.version, 13)
  assert.equal(bundle.prompts.length, 2)
  assert.equal(bundle.prompts.find((row) => row.sourceId === managed.id).values.mediaId, asset.id)
  assert.equal(
    bundle.prompts.find((row) => row.sourceId === external.id).values.externalImageUrl,
    external.externalImageUrl,
  )
  for (const key of ['requestId', 'requestHash', 'revision'])
    assert(!JSON.stringify(bundle.prompts).includes(`"${key}"`))
  bundle.posts = []
  bundle.tags = []
  bundle.folders = []
  async function preview(input, strategy = 'skip') {
    if (++writes % 5 === 0) await delay(1100)
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(input)], { type: 'application/json' }), 'prompts.json')
    form.append('requestId', randomUUID())
    form.append('strategy', strategy)
    form.append('includeSettings', 'false')
    const response = await fetch(`${fixture.origin}/api/v1/admin/backup/imports/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    return { status: response.status, data: await response.json() }
  }
  const execute = (plan) =>
    request(`/admin/backup/imports/${plan.ticket}/execute`, 'POST', {
      acknowledgement: '导入为新草稿',
      confirmation: plan.confirmation,
    })
  const same = await preview(bundle)
  assert.equal(same.status, 201)
  assert.equal(same.data.data.plan.counts.prompts, 0)
  assert.equal(same.data.data.plan.counts.skipped, 2)
  const legacy = stripV10Fields({ ...structuredClone(bundle), version: 9 })
  const old = await preview(legacy)
  assert.equal(old.status, 201)
  assert.equal(old.data.data.plan.counts.prompts, 0)
  assert.equal((await preview({ ...legacy, prompts: [] })).status, 400)
  const copy = await preview(bundle, 'copy')
  assert.equal(copy.status, 201)
  assert.equal(copy.data.data.plan.counts.prompts, 2)
  const copied = await execute(copy.data.data)
  assert.equal(copied.status, 201)
  assert.equal(copied.data.data.result.prompts.length, 2)
  assert.deepEqual((await execute(copy.data.data)).data.data.result, copied.data.data.result)
  for (const row of copied.data.data.result.prompts) {
    const saved = await ok(`/admin/prompts/${row.id}`)
    const original = bundle.prompts.find((source) => source.sourceId === row.sourceId)
    assert.equal(saved.status, 'draft')
    assert.equal(saved.prompt, original.values.prompt)
    assert.equal(saved.negativePrompt, original.values.negativePrompt)
    assert.equal(saved.mediaId, original.values.mediaId)
    assert.equal(saved.externalImageUrl, original.values.externalImageUrl)
    assert.equal(saved.createdAt, original.createdAt)
    assert.equal((await request(`/prompts/${row.id}`)).status, 404)
  }
  assert.equal((await preview(bundle)).data.data.plan.counts.prompts, 0)
  const references = await ok(`/admin/media/${asset.id}/references`)
  assert.equal(references.items.filter((row) => row.kind === 'image-prompt').length, 2)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE')).status, 409)

  // 预览后正文变化必须使旧确认失效，不能在目标发生变化后沿用原计划。
  const stale = (await preview(bundle, 'copy')).data.data
  await ok(`/admin/prompts/${managed.id}`, 'PATCH', { revision: managed.revision, title: '窗边的清晨' })
  assert.equal((await execute(stale)).status, 409)
  const changed = structuredClone(bundle)
  changed.prompts = [
    {
      ...changed.prompts[0],
      sourceId: 101,
      values: {
        ...changed.prompts[0].values,
        title: '远处的海',
        mediaId: randomUUID(),
      },
    },
  ]
  const missing = await preview(changed)
  assert.equal(missing.status, 201)
  assert.equal(missing.data.data.plan.ready, false)
  assert(missing.data.data.plan.errors.some((message) => message.includes('未登记的媒体')))
  assert.deepEqual(externalRequests, [])
  console.log('图片提示词内容包验收通过：v10、v9兼容、草稿迁入、幂等去重、媒体保护与预览冲突。')
} finally {
  globalThis.fetch = nativeFetch
  await fixture.close()
}
