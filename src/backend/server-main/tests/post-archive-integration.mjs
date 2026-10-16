/** @file post-archive-integration.mjs @description 独立数据库验证归档稳定分页、UTC年份、可见性与旧统计兼容 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
try {
  const em = fixture.testOrm.em.fork()
  await em.execute("update post set published_at='2026-01-01T00:30:00+01:00' where id=1")
  await em.execute("update post set published_at='2026-01-01T00:30:00Z',seo_noindex=true where id=2")
  await em.execute("update post set status='draft' where id=3")
  await em.execute("update post set status='archived' where id=4")
  await em.execute('update post set deleted_at=now() where id=5')
  await em.execute("update post set published_at='2026-01-02T00:00:00Z' where id in (105,106)")
  async function get(path) {
    const response = await fetch(fixture.origin + '/api/v1/posts' + path)
    assert.equal(response.status, 200, path)
    return (await response.json()).data
  }
  const legacy = await get('/metadata')
  const explicit = await get('/metadata?includeArchive=true')
  const summary = await get('/metadata?includeArchive=false')
  assert.equal(legacy.archive.length, 103)
  assert.deepEqual(explicit.archive, legacy.archive)
  assert.equal(summary.stats.posts, 103)
  assert.equal(Object.hasOwn(summary, 'archive'), false)
  const pages = []
  for (let page = 1; page <= 3; page++) {
    const value = await get(`/archive?page=${page}`)
    assert.equal(value.total, 103)
    assert.equal(value.pageSize, 50)
    assert.equal(value.items.length, page === 3 ? 3 : 50)
    assert.deepEqual(value.years, [
      { year: 2026, count: 102 },
      { year: 2025, count: 1 },
    ])
    pages.push(...value.items)
  }
  assert.equal(new Set(pages.map((item) => item.id)).size, 103)
  assert.deepEqual(
    pages.map((item) => item.id),
    legacy.archive.map((item) => item.id),
  )
  assert.deepEqual(
    pages.slice(0, 2).map((item) => item.id),
    [106, 105],
  )
  assert(!pages.some((item) => [3, 4, 5].includes(item.id)))
  const previous = await get('/archive?year=2025')
  assert.equal(previous.total, 1)
  assert.equal(previous.items[0].id, 1)
  assert.equal(previous.items[0].date, '2025-12-31T23:30:00.000Z')
  assert.equal((await get('/archive?year=2024')).total, 0)
  assert.deepEqual((await get('/archive?page=99')).items, [])
  for (const query of [
    'metadata?includeArchive=0',
    'metadata?includeArchive=',
    'metadata?includeArchive=false&includeArchive=true',
    'archive?year=0',
    'archive?year=',
    'archive?page=0',
    'archive?pageSize=101',
  ])
    assert.equal((await fetch(fixture.origin + '/api/v1/posts/' + query)).status, 400, query)
  process.stdout.write('归档集成通过：轻量统计、旧契约、UTC年份、稳定分页、状态排除与参数校验\n')
} finally {
  await fixture.close()
}
