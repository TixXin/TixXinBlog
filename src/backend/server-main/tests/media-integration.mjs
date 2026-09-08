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
  assert.equal((await upload(bytes, 'sample.png')).body.data.id, asset.id)
  assert.equal((await request('/admin/media')).body.data.total, 1)
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
  assert.equal(
    (await request('/admin/flashes', 'POST', { content: '受管图片闪念', images: [asset.url], isDraft: true })).status,
    201,
  )
  assert((await request(`/admin/media/${asset.id}/references`)).body.data.items.some((item) => item.kind === 'flash'))
  const unused = (await upload(bytes, 'unused.png', randomUUID())).body.data
  await delay(1100)
  assert.equal((await request(`/admin/media/${unused.id}`, 'DELETE')).status, 200)
  assert.equal((await fetch(`${fixture.origin}${unused.url}`)).status, 404)
  assert.equal((await request(`/admin/media/${unused.id}/restore`, 'POST')).status, 201)
  assert.equal((await fetch(`${fixture.origin}${unused.url}`)).status, 200)
  process.stdout.write(
    '媒体集成通过：权限、格式/路径/大小拒绝、重试幂等、真实 WebP、文章/修订/闪念引用保护、回收恢复\n',
  )
} finally {
  await fixture.close()
}
