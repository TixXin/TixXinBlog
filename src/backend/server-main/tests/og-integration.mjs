/** @file og-integration.mjs @description 分享卡片的真实 HTTP 回归：三类内容与站点卡的 PNG、草稿与删除 404、ETag/304、HEAD 与地址白名单。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
const require = createRequire(import.meta.url)
const sharp = require('sharp')
try {
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  async function admin(path, body) {
    const response = await fetch(fixture.origin + '/api/v1/admin' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    assert(response.status < 300, `${path}: ${response.status} ${await response.clone().text()}`)
    return (await response.json()).data
  }
  async function card(path, init) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1/og/' + path, init)
      if (response.status !== 429 || attempt === 3) return response
      await delay(1100)
    }
  }
  async function expectPng(path) {
    const response = await card(path)
    assert.equal(response.status, 200, path)
    assert.equal(response.headers.get('content-type'), 'image/png', path)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400')
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
    assert.deepEqual([meta.format, meta.width, meta.height], ['png', 1200, 630], path)
    return response.headers.get('etag')
  }

  const post = await admin('/posts', { title: '分享卡片验收', contentRaw: '正文', status: 'published' })
  const draft = await admin('/posts', { title: '草稿不出卡片', contentRaw: '正文', status: 'draft' })
  const flash = await admin('/flashes', { content: '## 闪念\n分享卡片验收', isDraft: false })
  const moment = await admin('/moments', { requestId: randomUUID(), content: '朋友圈分享卡片', status: 'published' })

  const etag = await expectPng(`nexus/zh-CN/post/${post.id}.png?v=abc`)
  await expectPng(`aurora/en/flash/${flash.id}.png`)
  await expectPng(`dock/zh-CN/moment/${moment.id}.png`)
  await expectPng('nexus/zh-CN/site.png')

  assert.match(etag, /^"og-[0-9a-f]{32}"$/)
  assert.equal((await card(`nexus/zh-CN/post/${post.id}.png`, { headers: { 'If-None-Match': etag } })).status, 304)
  const head = await card(`nexus/zh-CN/post/${post.id}.png`, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert(Number(head.headers.get('content-length')) > 1000)

  for (const path of [
    `nexus/zh-CN/post/${draft.id}.png`,
    'nexus/zh-CN/post/999999.png',
    `retro/zh-CN/post/${post.id}.png`,
    `nexus/ja/post/${post.id}.png`,
    `nexus/zh-CN/gallery/${post.id}.png`,
    'nexus/zh-CN/index.png',
  ])
    assert.equal((await card(path)).status, 404, path)

  await fixture.testOrm.em.fork().execute('update moment set deleted_at=now() where id=?', [moment.id])
  assert.equal((await card(`nexus/zh-CN/moment/${moment.id}.png`)).status, 404, '删除后的朋友圈不再出卡片')
  console.log('分享卡片验证通过：三类内容与站点卡 PNG、草稿与删除 404、ETag/304、HEAD 与地址白名单。')
} finally {
  await fixture.close()
}
