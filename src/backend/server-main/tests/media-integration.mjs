/**
 * @file media-integration.mjs
 * @description 独立数据库与文件目录中的真实上传、引用保护和回收恢复验收。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import sharp from 'sharp'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  const login = await fetch(`${fixture.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  async function request(path, method = 'GET', body) {
    const result = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: result.status, body: await result.json() }
  }
  const bytes = await sharp({ create: { width: 5, height: 4, channels: 3, background: '#123456' } })
    .png()
    .toBuffer()
  const uploadId = randomUUID()
  async function upload(buffer, name, id = uploadId, authenticated = true) {
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: 'image/png' }), name)
    form.append('uploadId', id)
    form.append('alt', '集成媒体说明')
    const response = await fetch(`${fixture.origin}/api/v1/admin/media`, {
      method: 'POST',
      headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    return { status: response.status, body: await response.json() }
  }
  assert.equal((await upload(bytes, 'sample.png', uploadId, false)).status, 401)
  assert.equal((await upload(bytes, '../escape.png')).status, 400)
  assert.equal((await upload(Buffer.from('<svg></svg>'), 'fake.png')).status, 400)
  assert.equal((await upload(Buffer.alloc(8 * 1024 * 1024 + 1), 'large.png')).status, 413)
  const uploaded = await upload(bytes, 'sample.png')
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body))
  const asset = uploaded.body.data
  assert.equal(asset.mimeType, 'image/webp')
  assert.equal(asset.description, '')
  assert.equal((await upload(bytes, 'sample.png')).body.data.id, asset.id)
  assert.equal((await request('/admin/media')).body.data.total, 1)
  assert.equal((await fetch(`${fixture.origin}/api/v1/admin/media`)).status, 401)
  const described = await request(`/admin/media/${asset.id}`, 'PATCH', {
    description: '晨光照片的素材出处，使用比例 100%',
  })
  assert.equal(described.status, 200)
  assert.equal(described.body.data.alt, asset.alt)
  const oldClient = await request(`/admin/media/${asset.id}`, 'PATCH', { alt: '山谷中的晨光' })
  assert.equal(oldClient.body.data.description, '晨光照片的素材出处，使用比例 100%')
  assert.equal((await request(`/admin/media/${asset.id}`, 'PATCH', { description: '长'.repeat(1001) })).status, 400)
  assert.equal((await request(`/admin/media/${asset.id}`, 'PATCH', { description: null })).status, 400)
  assert.equal((await request('/admin/media?search=100%25')).body.data.total, 1)
  assert.equal((await request('/admin/media?search=%25')).body.data.total, 1, '搜索百分号按字面匹配')
  const binary = await fetch(`${fixture.origin}${asset.url}`)
  assert.equal(binary.status, 200)
  assert.equal(binary.headers.get('content-type'), 'image/webp')
  assert.equal((await sharp(Buffer.from(await binary.arrayBuffer())).metadata()).format, 'webp')
  const postBody = { title: '媒体引用测试', contentRaw: `![图片](${asset.url})`, cover: asset.url, status: 'draft' }
  const created = await request('/admin/posts', 'POST', postBody)
  assert.equal(created.status, 201)
  assert.equal((await request(`/admin/media/${asset.id}/references`)).body.data.total, 2)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE')).status, 409)
  assert.equal(
    (
      await request(`/admin/posts/${created.body.data.id}`, 'PATCH', {
        ...postBody,
        contentRaw: '移除当前图片',
        cover: '',
        revision: created.body.data.revision,
      })
    ).status,
    200,
  )
  assert.equal((await request(`/admin/media/${asset.id}/references`)).body.data.total, 1)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE')).status, 409, '历史修订仍引用图片')
  assert.equal((await request('/admin/media?usage=used')).body.data.total, 1, '只剩历史引用仍算已使用')
  assert.equal((await request('/admin/media?usage=unused')).body.data.total, 0)
  const flash = await request('/admin/flashes', 'POST', { content: '受管图片闪念', images: [asset.url], isDraft: true })
  assert.equal(flash.status, 201)
  assert(
    (await request(`/admin/media/${asset.id}/references`)).body.data.items.some(
      (item) => item.kind === 'flash' && item.url === `/admin/flashes?edit=${flash.body.data.id}`,
    ),
  )
  const unused = (await upload(bytes, 'unused.png', randomUUID())).body.data
  await delay(1100)
  await request(`/admin/media/${unused.id}`, 'PATCH', { description: '回收与恢复时保留的说明' })
  assert.equal((await request(`/admin/media/${unused.id}`, 'DELETE')).status, 200)
  assert.equal((await fetch(`${fixture.origin}${unused.url}`)).status, 404)
  assert.equal((await request(`/admin/media/${unused.id}/restore`, 'POST')).status, 201)
  assert.equal((await fetch(`${fixture.origin}${unused.url}`)).status, 200)
  assert.equal(
    (await request(`/admin/media?search=${unused.id}`)).body.data.items[0].description,
    '回收与恢复时保留的说明',
  )
  const portraitBytes = await sharp({ create: { width: 4, height: 8, channels: 3, background: '#456789' } })
    .png()
    .toBuffer()
  const squareBytes = await sharp({ create: { width: 6, height: 6, channels: 3, background: '#789abc' } })
    .png()
    .toBuffer()
  const portrait = (await upload(portraitBytes, '构图-portrait.png', randomUUID())).body.data
  const square = (await upload(squareBytes, 'square.png', randomUUID())).body.data
  assert.equal((await request('/admin/media?orientation=landscape')).body.data.total, 2)
  assert.equal((await request('/admin/media?orientation=portrait')).body.data.items[0].id, portrait.id)
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await request(
      '/admin/media?page=1&pageSize=20&search=%E6%9E%84%E5%9B%BE-&deleted=false&orientation=portrait',
    )
    assert.equal(result.status, 200, JSON.stringify(result.body))
    assert.equal(result.body.data.total, 1)
    assert.equal(result.body.data.items[0].id, portrait.id)
  }
  assert.equal((await request('/admin/media?orientation=square')).body.data.items[0].id, square.id)
  const combined = await request('/admin/media?orientation=landscape&usage=used&search=素材')
  assert.equal(combined.body.data.total, 1)
  assert.equal(combined.body.data.items[0].id, asset.id)
  assert.equal((await request('/admin/media?orientation=portrait&usage=used')).body.data.total, 0)
  const pages = []
  for (const page of [1, 2, 3]) {
    const result = (await request(`/admin/media?usage=unused&pageSize=1&page=${page}`)).body.data
    assert.equal(result.total, 3)
    assert.equal(result.items.length, 1)
    pages.push(result.items[0].id)
  }
  assert.equal(new Set(pages).size, 3)
  assert.deepEqual(new Set(pages), new Set([unused.id, portrait.id, square.id]))
  assert.equal((await request('/admin/media?orientation=wide')).status, 400)
  assert.equal((await request('/admin/media?usage=popular')).status, 400)
  assert.equal(
    (await request(`/admin/media/${asset.id}/references`)).body.data.total,
    2,
    '筛选和说明维护不改变历史及业务引用',
  )
  process.stdout.write(
    '媒体集成通过：权限、上传幂等、真实 WebP、说明独立更新、尺寸与历史引用筛选、稳定分页、业务入口及回收恢复\n',
  )
} finally {
  await fixture.close()
}
