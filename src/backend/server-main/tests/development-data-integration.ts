/** @file development-data-integration.ts @description 隔离库验证数据覆盖与正常筛选空结果，检查本身不写入业务数据 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createBrowserTestApp } from './test-app.mjs'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'
import { loadLocalEnvironment } from '../src/config/environment'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const em = fixture.testOrm.em.fork()
    const missing = await inspectDataCatalog(em, 'moments')
    assert.equal(missing.ready, false)
    assert.equal(missing.domains[0].state, 'missing-data')
    assert.equal(missing.domains[0].counts.total, 0)
    await em.transactional(async (transaction) => {
      await transaction.execute('alter table guestbook_message rename to catalog_held_guestbook')
      try {
        const schema = await inspectDataCatalog(transaction, 'guestbook')
        assert.equal(schema.domains[0].state, 'missing-schema')
        assert.equal(schema.domains[0].counts, null)
      } finally {
        await transaction.execute('alter table catalog_held_guestbook rename to guestbook_message')
      }
    })
    const login = await fetch(fixture.origin + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fixture.username, password: fixture.password }),
    })
    assert.equal(login.status, 200)
    const token = (await login.json()).data.accessToken
    const media = new FormData()
    media.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'catalog.png')
    const uploaded = await fetch(fixture.origin + '/api/v1/admin/media', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: media,
    })
    assert.equal(uploaded.status, 201)
    const image = (await uploaded.json()).data.url
    for (let index = 0; index < 18; index++)
      await em.execute(
        'insert into moment (id,content,status,created_at,updated_at,published_at,images) values (?,?,?,now(),now(),now(),?::jsonb)',
        [
          randomUUID(),
          index === 0 ? '100% 可重复的记录' : `目录覆盖 ${index}`,
          index === 16 ? 'draft' : index === 17 ? 'archived' : 'published',
          JSON.stringify(index === 0 ? [image] : []),
        ],
      )
    const present = await inspectDataCatalog(em, 'moments')
    assert.equal(present.ready, true)
    assert.equal(present.domains[0].counts.total, 18)
    const emptyFilter = await inspectDataCatalog(em, 'moments', '没有这个词')
    assert.equal(emptyFilter.ready, true)
    assert.deepEqual(emptyFilter.domains[0].filter, { matched: 0, state: 'normal-empty-filter' })
    const literal = await inspectDataCatalog(em, 'moments', '%')
    assert.equal(literal.domains[0].filter.matched, 1)
    assert.deepEqual((await inspectDataCatalog(em, 'moments')).domains[0].counts, present.domains[0].counts)
    const full = await inspectDataCatalog(em)
    assert.deepEqual(
      full.domains.map((domain) => domain.domain).sort(),
      [
        'writing',
        'notifications',
        'posts',
        'comments',
        'flashes',
        'moments',
        'gallery',
        'gallery-external',
        'projects',
        'links',
        'media',
        'site',
        'guestbook',
      ].sort(),
    )
    assert.equal(full.domains.find((domain) => domain.domain === 'writing')?.state, 'missing-data')
    assert.equal(full.domains.find((domain) => domain.domain === 'notifications')?.state, 'missing-data')
    assert.equal(full.preservedSources.find((item) => item.id === 'bookmarks').storage, 'localStorage')
    await assert.rejects(inspectDataCatalog(em, 'arbitrary-table'), /不支持/)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write('开发数据目录验证通过：空库、缺表、覆盖缺口、正常筛选空结果、字面搜索、只读及数据源边界\n')
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
