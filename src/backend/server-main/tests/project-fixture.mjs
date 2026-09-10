/** @file project-fixture.mjs @description 浏览器隔离项目样本独立补齐作品与封面；只接受程序创建的数据库和临时媒体目录 */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname } from 'node:path'
import { require as tsxRequire } from 'tsx/cjs/api'

const require = createRequire(import.meta.url)

export async function seedProjectBrowserFixture(fixture) {
  const orm = fixture.testOrm
  const database = orm.config.get('dbName')
  assert(/^tixxin_browser_\d+_\d+$/.test(database), '项目浏览器样本只允许写入程序创建的隔离数据库')
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)), database)
  const directory = realpathSync(process.env.MEDIA_DIRECTORY)
  assert.equal(dirname(directory), realpathSync(tmpdir()))
  assert(basename(directory).startsWith('tixxin-media-test-'), '项目浏览器样本必须使用隔离媒体目录')
  const { seedProjectFixtures, PROJECT_FIXTURE_COUNT } = tsxRequire(
    '../src/seeders/project-fixtures.ts',
    import.meta.url,
  )
  const { ConfigService } = require('@nestjs/config')
  const { LocalMediaStorage } = require('../dist/modules/media/media-storage.js')
  const { lockMedia } = require('../dist/modules/media/media-references.js')
  const storage = new LocalMediaStorage(new ConfigService(process.env))
  const progress = { created: [], retained: [], unavailable: [] }
  await orm.em.fork().transactional(async (em) => {
    await lockMedia(em)
    await seedProjectFixtures(em, storage, progress, [])
  })
  assert.deepEqual(progress.unavailable, [])
  assert.equal(progress.created.length + progress.retained.length, PROJECT_FIXTURE_COUNT)
  const [counts] = await orm.em.fork().execute(`
    select count(*)::int as total,
      count(*) filter(where status='published' and deleted_at is null)::int as published,
      count(*) filter(where status='draft' and deleted_at is null)::int as draft,
      count(*) filter(where status='withdrawn' and deleted_at is null)::int as withdrawn
    from project
  `)
  assert.deepEqual(counts, { total: 18, published: 16, draft: 1, withdrawn: 1 })
  return { ...progress, counts }
}
