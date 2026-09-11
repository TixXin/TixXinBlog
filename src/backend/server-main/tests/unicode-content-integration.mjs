/** @file unicode-content-integration.mjs @description 三域UTF16写入边界与v4-v6导出再预览，使用单次隔离库且不改日常数据 */
import assert from 'node:assert/strict'
import { stripV9Fields } from './legacy-content-package.mjs'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  let token,
    writes = 0,
    checks = 0
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
    const result = await request(path, method, body)
    assert(result.status < 300, `${method} ${path}: ${result.status} ${JSON.stringify(result.data)}`)
    return result.data.data
  }
  function rejected(result) {
    assert.equal(result.status, 400)
    assert.match(JSON.stringify(result.data), /UTF-16 code units/)
  }
  token = (await ok('/auth/login', 'POST', { username: fixture.username, password: fixture.password })).accessToken
  const file = new FormData()
  file.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'unicode.png')
  const media = await ok('/admin/media', 'POST', file)

  // 创建与编辑共用DTO；创建失败不能留下记录或请求编号占位。
  const records = []
  for (const [path, body, key, max] of [
    ['/admin/gallery', { title: '河畔', mediaId: media.id }, 'title', 160],
    ['/admin/projects', { title: '手记' }, 'title', 160],
    ['/admin/links', { name: '远山', url: 'https://example.org/Notes?a=A&a=B#Start' }, 'name', 80],
  ]) {
    const before = await ok(path)
    const requestId = randomUUID()
    rejected(await request(path, 'POST', { ...body, requestId, [key]: '𠮷'.repeat(max / 2) + '长' }))
    assert.deepEqual(await ok(path), before)
    records.push(await ok(path, 'POST', { ...body, requestId }))
  }
  const [gallery, project, link] = records
  await ok('/admin/gallery/settings', 'PATCH', {
    revision: (await ok('/admin/gallery/settings')).revision,
    gear: [{ icon: 'lucide:camera', name: '相机', description: '沿途记录' }],
  })
  await ok('/admin/links/settings', 'PATCH', {
    revision: (await ok('/admin/links/settings')).revision,
    rules: ['欢迎交换阅读视角。'],
  })
  const direct = (path, fields) =>
    Object.entries(fields).map(([key, max]) => ({
      path,
      name: key,
      max,
      patch: (_before, value) => ({ [key]: value }),
    }))
  const boundaries = [
    ...direct(`/admin/gallery/${gallery.id}`, {
      title: 160,
      description: 5000,
      category: 40,
      location: 160,
      device: 160,
    }),
    ...Object.entries({ name: 80, description: 300 }).map(([key, max]) => ({
      path: '/admin/gallery/settings',
      name: `gear.${key}`,
      max,
      patch: (before, value) => ({ gear: [{ ...before.gear[0], [key]: value }] }),
    })),
    ...direct(`/admin/projects/${project.id}`, { title: 160, description: 5000 }),
    {
      path: `/admin/projects/${project.id}`,
      name: 'tags.label',
      max: 40,
      patch: (_before, value) => ({ tags: [{ label: value, color: 'sky' }] }),
    },
    ...direct(`/admin/links/${link.id}`, { name: 80, description: 300 }),
    {
      path: '/admin/links/settings',
      name: 'rules',
      max: 300,
      patch: (_before, value) => ({ rules: ['欢迎交换阅读视角。', value] }),
    },
  ]
  for (const boundary of boundaries) {
    const before = await ok(boundary.path)
    const accepted = '𠮷'.repeat(boundary.max / 2)
    const invalid = await request(boundary.path, 'PATCH', {
      revision: before.revision,
      ...boundary.patch(before, accepted + '长'),
    })
    rejected(invalid)
    assert.deepEqual(await ok(boundary.path), before, `${boundary.path}.${boundary.name} 越界不能修改值或版本`)
    const patch = boundary.patch(before, accepted)
    await ok(boundary.path, 'PATCH', { revision: before.revision, ...patch })
    const stored = await ok(boundary.path)
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(stored[key], value)
  }

  const exported = await request('/admin/backup/export', 'POST', { mediaIncluded: true })
  assert.equal(exported.status, 201)
  const bundle = exported.data
  assert.equal(bundle.version, 9)
  const selected = {
    gallery: bundle.gallery.find((item) => item.sourceId === gallery.id),
    projects: bundle.projects.find((item) => item.sourceId === project.id),
    links: bundle.links.find((item) => item.sourceId === link.id),
  }
  // 比对落库记录与导出内容，确保合法字符没有截断、替换或转义失真。
  for (const [path, row] of [
    [`/admin/gallery/${gallery.id}`, selected.gallery],
    [`/admin/projects/${project.id}`, selected.projects],
    [`/admin/links/${link.id}`, selected.links],
  ]) {
    const stored = await ok(path)
    for (const key of Object.keys(row.values)) assert.deepEqual(row.values[key], stored[key], `${path}.${key}`)
  }
  assert.deepEqual(bundle.gallerySettings.gear, (await ok('/admin/gallery/settings')).gear)
  assert.deepEqual(bundle.linkSettings.rules, (await ok('/admin/links/settings')).rules)
  async function preview(content) {
    const form = new FormData()
    form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }), 'unicode.json')
    form.append('requestId', randomUUID())
    form.append('strategy', 'copy')
    form.append('includeSettings', 'true')
    return request('/admin/backup/imports/preview', 'POST', form)
  }
  for (const version of [4, 5, 6]) {
    const legacy = structuredClone(bundle)
    legacy.version = version
    stripV9Fields(legacy)
    delete legacy.site.about
    for (const photo of legacy.gallery ?? []) delete photo.values.externalUrl
    if (version < 6) {
      delete legacy.links
      delete legacy.linkSettings
    }
    if (version < 5) delete legacy.projects
    const result = await preview(legacy)
    assert.equal(result.status, 201, `v${version}: ${JSON.stringify(result.data)}`)
    assert.equal(result.data.data.plan.counts.gallery, 1)
    if (version >= 5) assert.equal(result.data.data.plan.counts.projects, 1)
    if (version >= 6) assert.equal(result.data.data.plan.counts.links, 1)
    const field = version === 4 ? 'gallery' : version === 5 ? 'projects' : 'links'
    legacy[field][0].values[field === 'links' ? 'name' : 'title'] += '长'
    const invalid = await preview(legacy)
    assert.equal(invalid.status, 400, `v${version}仍须拒绝超过UTF16原合同的包`)
    assert.match(JSON.stringify(invalid.data), /内容包字段不合法/)
  }
  console.log(
    JSON.stringify({ checks, boundaries: boundaries.length, versions: [4, 5, 6], preservedBeforeRejection: true }),
  )
} finally {
  await fixture.close()
}
