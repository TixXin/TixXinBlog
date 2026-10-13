/** @file subscription-fixture.mjs @description 隔离浏览器订阅样本入口；只写入程序创建的数据库与媒体目录 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { realpathSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { require as tsxRequire } from 'tsx/cjs/api'
const require = createRequire(import.meta.url)
export async function seedSubscriptionBrowserFixture(fixture) {
  const orm = fixture.testOrm,
    database = orm.config.get('dbName')
  assert(/^tixxin_browser_\d+_\d+$/.test(database), '订阅样本只允许写入程序创建的隔离数据库')
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1)), database)
  const directory = realpathSync(process.env.MEDIA_DIRECTORY)
  assert.equal(dirname(directory), realpathSync(tmpdir()))
  assert(basename(directory).startsWith('tixxin-media-test-'))
  const { seedSubscriptionFixtures, SUBSCRIPTION_FIXTURE_COUNT } = tsxRequire(
    '../src/seeders/subscription-fixtures.ts',
    import.meta.url,
  )
  const { ConfigService } = require('@nestjs/config')
  const { LocalMediaStorage } = require('../dist/modules/media/media-storage.js')
  const { lockMedia } = require('../dist/modules/media/media-references.js')
  const { faviconKey } = require('../dist/modules/subscription/subscription-favicon.service.js')
  const progress = { created: [], retained: [], unavailable: [] }
  await orm.em.fork().transactional(async (em) => {
    await lockMedia(em)
    await seedSubscriptionFixtures(em, new LocalMediaStorage(new ConfigService(process.env)), progress, [])
  })
  assert.deepEqual(progress.unavailable, [])
  assert.equal(progress.created.length + progress.retained.length, SUBSCRIPTION_FIXTURE_COUNT)
  // 仅为隔离验收预热受控图标，来源为仓库已有许可素材，不请求供应商。
  const cache = join(directory, '.subscription-favicons')
  mkdirSync(cache, { recursive: true })
  writeFileSync(
    join(cache, `${faviconKey('vuejs.org')}.webp`),
    readFileSync(new URL('../src/seeders/link-assets/vue.webp', import.meta.url)),
  )
  return progress
}
