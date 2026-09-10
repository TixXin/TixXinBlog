/** @file link-fixture.mjs @description 友链浏览器样本复用版本种子，只允许程序生成的隔离库与临时媒体目录 */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname } from 'node:path'
import { require as tsxRequire } from 'tsx/cjs/api'

const require = createRequire(import.meta.url)
export async function seedLinkBrowserFixture(fixture) {
  const orm = fixture.testOrm
  const database = orm.config.get('dbName')
  assert(/^tixxin_browser_\d+_\d+$/.test(database), '友链浏览器样本仅允许隔离数据库')
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)), database)
  const directory = realpathSync(process.env.MEDIA_DIRECTORY)
  assert.equal(dirname(directory), realpathSync(tmpdir()))
  assert(basename(directory).startsWith('tixxin-media-test-'), '友链浏览器样本需要隔离媒体目录')
  const { seedLinkFixtures, LINK_FIXTURE_COUNT } = tsxRequire('../src/seeders/link-fixtures.ts', import.meta.url)
  const { ConfigService } = require('@nestjs/config')
  const { LocalMediaStorage } = require('../dist/modules/media/media-storage.js')
  const { lockMedia } = require('../dist/modules/media/media-references.js')
  const progress = { created: [], retained: [], unavailable: [] }
  const storage = new LocalMediaStorage(new ConfigService(process.env))
  await orm.em.fork().transactional(async (em) => {
    await lockMedia(em)
    await seedLinkFixtures(em, storage, progress, [])
  })
  assert.deepEqual(progress.unavailable, [])
  assert.equal(progress.created.length + progress.retained.length, LINK_FIXTURE_COUNT)
  const [counts] = await orm.em.fork().execute(`select count(*)::int total,
    count(*) filter(where status='published' and deleted_at is null)::int published,
    count(*) filter(where status='draft' and deleted_at is null)::int draft,
    count(*) filter(where status='withdrawn' and deleted_at is null)::int withdrawn
    from friend_link`)
  assert.deepEqual(counts, { total: 18, published: 16, draft: 1, withdrawn: 1 })
  return { ...progress, counts }
}
