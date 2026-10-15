/** @file subscription-fixtures-integration.ts @description 订阅代表样本的预览、完整备份、事务补偿、幂等、编辑删除保护与引用清理验收 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { access, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createBrowserTestApp } from './test-app.mjs'
import { seedSubscriptionBrowserFixture } from './subscription-fixture.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'
import { SUBSCRIPTION_FIXTURE_COUNT, SUBSCRIPTION_RECORD_COUNT } from '../src/seeders/subscription-fixtures'
import { ProjectService } from '../src/modules/project/project.service'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const seed = (apply = true) =>
    seedDevelopmentData(
      ['--dataset', 'subscription-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
      () => undefined,
      fixture.backupOptions,
    )
  const cleanup = (apply = false) =>
    removeDevelopmentData(
      ['--dataset', 'subscription-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
      () => undefined,
      fixture.backupOptions,
    )
  const get = async (path: string) => {
    const response = await fetch(fixture.origin + '/api/v1' + path)
    assert.equal(response.status, 200, path)
    return (await response.json()).data
  }
  let reconnected = false
  try {
    const em = fixture.testOrm.em.fork()
    const beforePosts = await em.execute('select * from post order by id')
    await assert.rejects(
      seedSubscriptionBrowserFixture({ testOrm: { config: { get: () => 'tixxin_blog' } } }),
      /隔离数据库/,
    )
    const preview = await seed(false)
    assert.equal(preview.preview, true)
    assert.equal(preview.expectedRecords, SUBSCRIPTION_FIXTURE_COUNT)
    assert.equal((await inspectDataCatalog(em, 'subscriptions')).domains[0].ownership.state, 'not-seeded')
    assert.equal((await em.execute('select count(*)::int as count from subscription'))[0].count, 0)
    await assert.rejects(
      seedDevelopmentData(
        ['--dataset', 'subscription-v1', '--apply', '--confirm', 'wrong-target'],
        () => undefined,
        fixture.backupOptions,
      ),
      /未执行写入/,
    )

    await em.execute(
      "create function reject_subscription_fixture() returns trigger language plpgsql as $$ begin if new.name='Kindle Unlimited（日本）' then raise exception 'subscription_fixture_failure'; end if; return new; end $$",
    )
    await em.execute(
      'create trigger reject_subscription_fixture before insert on subscription for each row execute function reject_subscription_fixture()',
    )
    await assert.rejects(seed(), /subscription_fixture_failure/)
    for (const table of ['subscription', 'media_asset', 'development_fixture'])
      assert.equal((await em.execute(`select count(*)::int as count from ${table}`))[0].count, 0)
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), [])
    await em.execute('drop trigger reject_subscription_fixture on subscription')
    await em.execute('drop function reject_subscription_fixture()')

    const seeded = await seed()
    assert.equal(seeded.ready, true)
    assert.equal(seeded.created.length, SUBSCRIPTION_FIXTURE_COUNT)
    assert.equal(seeded.expectedRecords, SUBSCRIPTION_FIXTURE_COUNT)
    await access(seeded.backup)
    const catalog = await inspectDataCatalog(em, 'subscriptions')
    assert.equal(catalog.ready, true, JSON.stringify(catalog))
    assert.equal(catalog.domains[0].counts.total, SUBSCRIPTION_RECORD_COUNT)
    assert.equal(catalog.domains[0].counts.published, 13)
    assert.equal(catalog.domains[0].counts.drafts, 1)
    assert.equal(catalog.domains[0].counts.withdrawn, 1)
    assert.equal(catalog.domains[0].counts.managed, catalog.domains[0].counts.references)
    assert.equal(catalog.domains[0].media.available, 1)
    assert.deepEqual((await inspectDataCatalog(em, 'subscriptions', '没有这个订阅')).domains[0].filter, {
      matched: 0,
      state: 'normal-empty-filter',
    })
    const first = await get('/subscriptions?pageSize=8'),
      second = await get('/subscriptions?page=2&pageSize=8')
    assert.equal(first.total, 13)
    assert.equal(first.items.length, 8)
    assert.equal(second.items.length, 5)
    const records = [...first.items, ...second.items]
    assert.equal(new Set(records.map((item) => item.id)).size, 13)
    assert(records.every((item) => !('notes' in item) && !('status' in item) && !('revision' in item)))
    assert(records.every((item) => !/开发示例|测试数据|演示用途/.test(item.name + item.description)))
    const stats = await get('/subscriptions/stats?currency=USD&pageSize=1')
    assert.equal(stats.total, 3)
    assert.equal(stats.currencies[0].annualAmount, 52900)
    assert.equal((await get('/subscriptions?currency=JPY')).items[0].amount, 1000)
    const withMedia = records.find((item) => item.name === 'Vue 开源支持')
    assert(withMedia.iconUrl.startsWith('/api/v1/media/'))
    assert.equal((await fetch(fixture.origin + withMedia.iconUrl)).status, 200)
    assert(records.find((item) => item.name === 'ChatGPT Plus').priceHistory.length === 3)
    assert(records.find((item) => item.name === '季度写作空间').priceHistory.length === 2)
    assert(records.find((item) => item.name === '日语阅读室').priceHistory.length === 2)

    const snapshots = await em.execute('select * from subscription order by id')
    const ownership = await em.execute('select * from development_fixture order by key')
    const repeated = await seedSubscriptionBrowserFixture(fixture)
    assert.equal(repeated.created.length, 0)
    assert.equal(repeated.retained.length, SUBSCRIPTION_FIXTURE_COUNT)
    const automatic = records.find((item) => item.name === 'Vue 生态支持')
    assert(automatic.iconUrl.startsWith('/api/v1/subscriptions/favicons/'))
    assert.equal((await fetch(fixture.origin + automatic.iconUrl)).status, 200)
    assert.equal((await seed()).created.length, 0)
    assert.deepEqual(
      await em.execute('select * from subscription order by id'),
      snapshots,
      '重复补种不得重写日期、价格历史或版本',
    )
    assert.equal((await cleanup()).remove.length, SUBSCRIPTION_FIXTURE_COUNT)

    const [media] = await em.execute('select * from media_asset order by id')
    const mediaPath = join(process.env.MEDIA_DIRECTORY!, media.storage_key)
    const bytes = await readFile(mediaPath)
    await unlink(mediaPath)
    try {
      const missing = await inspectDataCatalog(em, 'subscriptions')
      assert.equal(missing.ready, false)
      assert.deepEqual(missing.domains[0].media.unavailable, [media.id])
      await assert.rejects(seed(), /ENOENT|missing|不存在|缺失/)
    } finally {
      await writeFile(mediaPath, bytes)
    }
    await em.execute('delete from media_reference where subscription_id=?', [withMedia.id])
    const brokenReferences = await inspectDataCatalog(em, 'subscriptions')
    assert.equal(brokenReferences.ready, false)
    assert(brokenReferences.domains[0].missing.some((value) => value.includes('引用不一致')))
    await em.execute('insert into media_reference (asset_id,source_key,kind,subscription_id) values (?,?,?,?)', [
      media.id,
      `subscription:${withMedia.id}`,
      'subscription',
      withMedia.id,
    ])

    const [edited, deleted] = snapshots
    await em.execute("update subscription set name='自己维护的订阅',revision=revision+1 where id=?", [edited.id])
    await em.execute('delete from subscription where id=?', [deleted.id])
    const noRevival = await seed()
    assert.equal(noRevival.created.length, 0)
    assert.equal(noRevival.ready, false)
    assert(noRevival.unavailable.includes('subscription-v1/subscription/1'))
    assert.equal((await em.execute('select name from subscription where id=?', [edited.id]))[0].name, '自己维护的订阅')
    assert.equal(
      (await em.execute('select count(*)::int as count from subscription where id=?', [deleted.id]))[0].count,
      0,
    )
    const changed = await inspectDataCatalog(em, 'subscriptions')
    assert.deepEqual(changed.domains[0].ownership.edited, ['subscription-v1/subscription/0'])
    assert.deepEqual(changed.domains[0].ownership.deleted, ['subscription-v1/subscription/1'])

    const project = await new ProjectService(em).save(null, {
      requestId: randomUUID(),
      title: '保留的工具项目',
      coverMediaId: media.id,
    })
    const projectBefore = await em.execute('select * from project where id=?', [project.id])
    const guarded = await cleanup()
    assert(guarded.preserve.some((item) => item.key === 'subscription-v1/media/vue'))
    assert(guarded.preserve.some((item) => item.key === 'subscription-v1/subscription/0'))
    assert(guarded.remove.some((item) => item.key === 'subscription-v1/subscription/6'))
    await assert.rejects(cleanup(true), /其他连接/)
    const files = await readdir(process.env.MEDIA_DIRECTORY!)
    await fixture.stopServices()
    const removed = await cleanup(true)
    assert('backup' in removed)
    await fixture.testOrm.connect()
    reconnected = true
    const after = fixture.testOrm.em.fork()
    assert.deepEqual(await after.execute('select * from project where id=?', [project.id]), projectBefore)
    assert.deepEqual(await after.execute('select * from post order by id'), beforePosts)
    assert.deepEqual(await after.execute('select * from development_fixture order by key'), ownership)
    assert.equal(
      (await after.execute('select count(*)::int as count from media_asset where id=?', [media.id]))[0].count,
      1,
    )
    assert.equal(
      (
        await after.execute('select count(*)::int as count from media_reference where project_id=? and asset_id=?', [
          project.id,
          media.id,
        ])
      )[0].count,
      1,
    )
    assert.deepEqual(await readdir(process.env.MEDIA_DIRECTORY!), files)
    assert.equal((await cleanup()).remove.length, 0)
    assert.equal((await seed()).created.length, 0)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '订阅样本通过：15订阅/1图标、预览与备份、事务补偿、真实分页统计、受管与自动图标、日期历史幂等、编辑删除保护、缺失文件与引用诊断、跨模块引用保护、清理不复活\n',
    )
  } finally {
    if (reconnected) await fixture.testOrm.close(true)
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
