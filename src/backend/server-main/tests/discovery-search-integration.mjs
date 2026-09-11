/** @file discovery-search-integration.mjs @description 六域公开搜索的正文覆盖、中文通配符字面语义、状态排除和稳定分页。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
const require = createRequire(import.meta.url)
try {
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken
  async function request(path, method = 'GET', body, admin = false) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const value = await response.json()
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      return { status: response.status, body: value }
    }
  }
  async function ok(path, method = 'GET', body, admin = false) {
    const result = await request(path, method, body, admin)
    assert(result.status < 300, `${path}: ${result.status} ${JSON.stringify(result.body)}`)
    return result.body.data
  }
  const em = fixture.testOrm.em.fork(),
    marker = '中文检索100%_\\路径'
  const domains = [
    {
      name: 'post',
      path: '/posts',
      table: 'post',
      param: 'search',
      body: (content, state) => ({
        title: '正文索引',
        contentRaw: content,
        status: state === 'withdrawn' ? 'archived' : state,
      }),
    },
    {
      name: 'project',
      path: '/projects',
      table: 'project',
      param: 'q',
      body: (content, state) => ({ requestId: randomUUID(), title: '项目介绍', description: content, status: state }),
    },
    {
      name: 'link',
      path: '/links',
      table: 'friend_link',
      param: 'q',
      body: (content, state) => ({
        requestId: randomUUID(),
        name: '链接来源',
        description: content,
        url: 'https://example.com/' + randomUUID(),
        status: state,
      }),
    },
    {
      name: 'gallery',
      path: '/gallery',
      table: 'gallery_photo',
      param: 'q',
      body: (content, state) => ({
        requestId: randomUUID(),
        title: '作品说明',
        description: content,
        externalUrl: 'https://example.com/photo.jpg',
        status: state,
      }),
    },
    {
      name: 'flash',
      path: '/flashes',
      table: 'flash_note',
      param: 'q',
      body: (content, state) => ({ content, isDraft: state === 'draft', isArchived: state === 'withdrawn' }),
    },
    {
      name: 'moment',
      path: '/moments',
      table: 'moment',
      param: 'q',
      body: (content, state) => ({
        requestId: randomUUID(),
        content,
        status: state === 'withdrawn' ? 'archived' : state,
      }),
    },
  ]
  for (const domain of domains) {
    const records = []
    for (const state of ['published', 'draft', 'withdrawn'])
      records.push(await ok('/admin' + domain.path, 'POST', domain.body(marker, state), true))
    await ok('/admin' + domain.path, 'POST', domain.body('中文检索100XX路径', 'published'), true)
    const path = domain.path + (domain.name === 'flash' ? '/search' : '')
    const query = (q) => path + '?' + new URLSearchParams({ [domain.param]: q, pageSize: '10' })
    for (const keyword of [marker, '%', '_', '\\']) {
      const result = await ok(query(keyword))
      assert.equal(result.total, 1, domain.name + ' 对特殊字符采用字面搜索')
      assert.equal(String(result.items[0].id), String(records[0].id))
      assert(!JSON.stringify(result).includes('requestHash'))
    }
    if (domain.name === 'post') {
      assert.equal(records[0].title, '正文索引')
      assert.equal((await ok(query(marker))).items[0].title, '正文索引', '匹配只出现在正文时仍可找到文章')
    }
    if (domain.name === 'flash') await em.execute('update flash_note set is_archived=true where id=?', [records[0].id])
    else await em.execute(`update ${domain.table} set deleted_at=now() where id=?`, [records[0].id])
    assert.equal((await ok(query(marker))).total, 0, domain.name + ' 删除或归档立即移出检索')
    assert.equal((await request(domain.path + '/' + records[0].id)).status, 404)
  }
  // 同一毫秒大量记录必须用稳定编号补足排序，分页不能重复或漏项。
  const { FlashNote } = require('../dist/entities/flash-note.entity.js')
  for (let index = 0; index < 23; index++)
    em.create(FlashNote, {
      id: `stable-search-${String(index).padStart(2, '0')}`,
      userId: 'tixxin',
      content: '稳定分页长记录',
      tags: [],
      images: [],
      type: 'memo',
      createdAt: new Date('2026-09-11T00:00:00Z'),
      updatedAt: new Date(),
    })
  await em.flush()
  const pages = []
  for (let page = 1; page <= 3; page++) {
    const result = await ok(
      '/flashes/search?' + new URLSearchParams({ q: '稳定分页', page: String(page), pageSize: '10' }),
    )
    assert.equal(result.total, 23)
    pages.push(...result.items.map((item) => item.id))
  }
  assert.equal(new Set(pages).size, 23)
  assert.deepEqual(
    pages,
    Array.from({ length: 23 }, (_, index) => `stable-search-${String(22 - index).padStart(2, '0')}`),
  )
  const extended = '中'.repeat(180)
  assert.equal((await request('/posts?' + new URLSearchParams({ search: extended }))).status, 200)
  assert.equal((await request('/flashes/search?' + new URLSearchParams({ q: extended }))).status, 200)
  console.log('六域检索隔离验证通过：文章正文、中文特殊字符、草稿撤回删除排除、23项稳定分页与200字契约。')
} finally {
  await fixture.close()
}
