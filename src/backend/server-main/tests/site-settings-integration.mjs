/**
 * @file site-settings-integration.mjs
 * @description 隔离配置的真实持久化、版本并发、历史恢复和头像媒体引用保护。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  const login = await fetch(`${fixture.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  const token = (await login.json()).data.accessToken
  let writes = 0
  async function request(path, method = 'GET', body, admin = true) {
    if (method !== 'GET' && ++writes % 7 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  async function ok(path, method = 'GET', body, admin = true) {
    const response = await request(path, method, body, admin)
    assert(response.status < 300, `${path}: ${response.status} ${JSON.stringify(response.body)}`)
    return response.body.data
  }
  function editable(value) {
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...input } = value
    return input
  }
  const initial = await ok('/site', 'GET', undefined, false)
  assert.equal(initial.name, 'TixXin Blog')
  assert.equal(initial.announcement, '')
  assert.equal((await request('/admin/site', 'GET', undefined, false)).status, 401)
  assert.equal((await request('/admin/site/revisions', 'GET', undefined, false)).status, 401)
  const input = {
    ...editable(initial),
    name: '隔离站点 <文字>',
    description: '真实简介 & 测试',
    announcement: '真实公告',
    socials: [{ label: '博客', href: 'https://example.test/blog', icon: 'lucide:globe' }],
  }
  assert.equal((await request('/admin/site', 'PATCH', { ...input, avatar: '//evil.test/a.png' })).status, 400)
  assert.equal(
    (
      await request('/admin/site', 'PATCH', {
        ...input,
        socials: [{ label: '非法', icon: 'lucide:globe', href: 'javascript:alert(1)' }],
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await request('/admin/site', 'PATCH', {
        ...input,
        socials: [{ label: '非法', icon: 'lucide:globe', href: 'https://name:password@example.test/' }],
      })
    ).status,
    400,
  )
  assert.equal((await request('/admin/site', 'PATCH', { ...input, socials: [null] })).status, 400)
  const changed = await ok('/admin/site', 'PATCH', input)
  assert.equal(changed.revision, initial.revision + 1)
  assert(changed.announcementUpdatedAt)
  assert.equal((await ok('/site', 'GET', undefined, false)).name, input.name)
  assert.equal((await request('/admin/site', 'PATCH', input)).status, 409)
  assert.equal((await ok('/admin/site/revisions')).total, 2)
  assert.equal((await ok('/admin/site/revisions/0')).name, initial.name)
  const beforeFailure = await ok('/site')
  assert.equal(
    (
      await request('/admin/site', 'PATCH', {
        ...editable(beforeFailure),
        avatar: `/api/v1/media/${randomUUID()}.webp`,
      })
    ).status,
    409,
  )
  assert.equal((await ok('/site')).revision, beforeFailure.revision)
  assert.equal((await ok('/admin/site/revisions')).total, 2)
  const restored = await ok('/admin/site/revisions/0/restore', 'POST', { revision: changed.revision })
  assert.equal(restored.name, initial.name)
  assert.equal(restored.revision, 2)
  assert.equal(
    (await request('/admin/site/revisions/999/restore', 'POST', { revision: restored.revision })).status,
    404,
  )
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'site-avatar.png')
  const uploaded = await fetch(`${fixture.origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  const avatar = await ok('/admin/site', 'PATCH', {
    ...editable(restored),
    avatar: asset.url,
    avatarAlt: '头像真实说明',
  })
  const references = await ok(`/admin/media/${asset.id}/references`)
  assert.equal(references.total, 2)
  assert(references.items.every((item) => item.url === '/admin/site'))
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE')).status, 409)
  await ok('/admin/site', 'PATCH', { ...editable(avatar), avatar: '' })
  assert.equal((await ok(`/admin/media/${asset.id}/references`)).total, 1)
  assert.equal((await request(`/admin/media/${asset.id}`, 'DELETE')).status, 409, '历史配置仍引用头像')
  const current = await ok('/site')
  await delay(1100)
  const concurrent = await Promise.all(
    ['A', 'B'].map((name) => request('/admin/site', 'PATCH', { ...editable(current), name })),
  )
  assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409])
  assert.equal((await ok('/site')).revision, current.revision + 1)
  const profileBase = await ok('/admin/site')
  const about = {
    visible: true,
    introduction: '从代码中记录技术实践',
    sections: [
      { kind: 'skill', visible: true, items: [
        { title: 'Web 开发', detail: '公开说明', period: '', visible: true },
        { title: '尚未确认', detail: '隐藏的个人资料', period: '', visible: false },
      ] },
      { kind: 'experience', visible: false, items: [{ title: '隐藏经历', detail: '', period: '', visible: true }] },
    ],
  }
  const withAbout = await ok('/admin/site', 'PATCH', { ...editable(profileBase), about })
  assert.deepEqual((await ok('/admin/site')).about, about)
  const publishedAbout = (await ok('/site', 'GET', undefined, false)).about
  assert.equal(publishedAbout.sections.length, 1)
  assert.equal(publishedAbout.sections[0].items.length, 1)
  assert(!JSON.stringify(publishedAbout).includes('隐藏'))
  assert.equal((await request('/admin/site', 'PATCH', { ...editable(withAbout), about: null })).status, 400)
  assert.equal((await request('/admin/site', 'PATCH', { ...editable(withAbout), about: { ...about, sections: [about.sections[0], about.sections[0]] } })).status, 400)
  const { about: _about, ...oldClient } = editable(withAbout)
  const preservedAbout = await ok('/admin/site', 'PATCH', { ...oldClient, announcement: '独立公告修改' })
  assert.deepEqual(preservedAbout.about, about, '旧客户端未提供新字段时不得清除关于页')
  const hiddenAbout = await ok('/admin/site', 'PATCH', { ...editable(preservedAbout), about: { ...about, visible: false } })
  assert.deepEqual((await ok('/site', 'GET', undefined, false)).about, { visible: false, introduction: '', sections: [] })
  const restoredAbout = await ok(`/admin/site/revisions/${withAbout.revision}/restore`, 'POST', { revision: hiddenAbout.revision })
  assert.deepEqual(restoredAbout.about, about)
  process.stdout.write(
    '站点设置集成通过：权限、字段/URL 校验、运行时持久化、版本并发、历史恢复、失败回滚和头像历史引用保护\n',
  )
} finally {
  await fixture.close()
}
