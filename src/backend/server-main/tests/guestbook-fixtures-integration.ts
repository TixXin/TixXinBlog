/** @file guestbook-fixtures-integration.ts @description 留言样本必须可公开分页且具备真实审核、引用与回应，重复导入保留用户变更 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const run = () =>
    seedDevelopmentData(
      ['--dataset', 'guestbook-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
  try {
    const seeded = await run()
    assert.equal(seeded.ready, true)
    assert.equal(seeded.created.length, seeded.expectedRecords)
    const em = fixture.testOrm.em.fork()
    assert.equal((await inspectDataCatalog(em, 'guestbook')).ready, true)
    const page = (await (await fetch(fixture.origin + '/api/v1/guestbook')).json()).data
    assert.equal(page.items.length, 20)
    assert.equal(page.total, 26)
    assert(page.nextCursor)
    assert(
      page.items.every(
        (note) =>
          note.moderationStatus === 'published' &&
          !note.content.includes('[开发示例]') &&
          !('region' in note) &&
          !('status' in note),
      ),
    )
    const metadata = (await (await fetch(fixture.origin + '/api/v1/guestbook/metadata')).json()).data
    assert.equal(metadata.stats.messages, 26)
    assert(metadata.pinned?.isOwner)
    const [reactionCount] = await em.execute('select count(*)::int as count from guestbook_reaction')
    assert(reactionCount.count > 0)
    const snapshots = await em.execute('select * from guestbook_message order by id')
    const repeated = await run()
    assert.equal(repeated.created.length, 0)
    assert.deepEqual(await em.execute('select * from guestbook_message order by id'), snapshots)
    await em.execute('delete from guestbook_message where id=?', [snapshots[0].id])
    const afterDelete = await run()
    assert.equal(afterDelete.created.length, 0)
    assert(afterDelete.unavailable.includes('guestbook-v1/guestbook/0'))
    assert.equal(
      (await em.execute('select count(*)::int as count from guestbook_message where id=?', [snapshots[0].id]))[0].count,
      0,
    )
    process.stdout.write('留言样本验证通过：29条留言、公开分页、置顶与审核、真实回应、重复不改写和删除不复活\n')
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
