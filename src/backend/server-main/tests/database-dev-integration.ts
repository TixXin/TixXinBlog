/** @file database-dev-integration.ts @description 开发数据库工具在独立临时库中验证预览、备份、样本、清空及事务重建 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const sourceUrl = process.env.DATABASE_URL!
  const { runDevDatabase } = await import('../src/seeders/database-dev')
  const target = decodeURIComponent(new URL(sourceUrl).pathname.slice(1))
  const output: string[] = []
  const run = (action: string, apply = false) =>
    runDevDatabase([action, ...(apply ? ['--apply', '--confirm', target] : [])], (text) => output.push(text))
  try {
    const preview = await run('seed-moments')
    assert.equal(preview.counts.moment, 0)
    assert.equal((await run('status')).counts.moment, 0)
    await assert.rejects(runDevDatabase(['seed-moments', '--apply', '--confirm', 'wrong-target']), /确认不匹配/)
    await assert.rejects(runDevDatabase(['seed-moments', '--unexpected']), /不支持的参数/)
    process.env.NODE_ENV = 'production'
    await assert.rejects(run('seed-moments', true), /本机非生产/)
    process.env.NODE_ENV = 'test'
    const seeded = await run('seed-moments', true)
    assert(seeded.after && seeded.after.moment > 0)
    assert.equal(seeded.after.moment_like, 0)
    assert(seeded.after.moment_comment > 0)
    assert.equal(seeded.after.post, preview.counts.post)
    const firstDates = await fixture.testOrm.em.fork().execute('select id,published_at from moment order by id')
    const latestDate = Math.max(...firstDates.map((note) => new Date(note.published_at).getTime()))
    assert.equal(new Date(latestDate).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
    assert(latestDate <= Date.now(), '开发样本不能发布日期在未来')
    const overviewResponse = await fetch(fixture.origin + '/api/v1/moments/overview')
    assert.equal(overviewResponse.status, 200)
    const overview = (await overviewResponse.json()).data
    assert(overview.photos.length > 0 && overview.topics.length > 0 && overview.recollections.length > 0)
    assert(overview.dates.some((item) => item.date === new Date(latestDate).toISOString().slice(0, 10)))
    const again = await run('seed-moments', true)
    assert.equal(again.samplesToAdd, 0)
    assert.equal('backup' in again, false)
    assert.deepEqual(
      await fixture.testOrm.em.fork().execute('select id,published_at from moment order by id'),
      firstDates,
    )
    await assert.rejects(run('clear-moments', true), /其他连接/)
    await fixture.testOrm.em
      .fork()
      .execute(
        "update moment set content='保留编辑后的样本',revision=1 where id=(select id from moment order by id limit 1)",
      )
    await fixture.testOrm.em.fork().execute('create view database_dev_guard as select id from moment')
    await fixture.stopServices()
    const removed = await run('remove-samples', true)
    assert.equal(removed.after?.moment, 1)
    assert.equal(removed.editedSamplesPreserved, 1)
    const cleared = await run('clear-content', true)
    assert.equal(cleared.after?.moment, 0)
    assert.equal(cleared.after?.post, 0)
    assert.equal(cleared.after?.admin_user, preview.counts.admin_user)
    assert.equal(cleared.after?.site_settings, 1)
    const beforeRejectedReset = await run('status')
    await assert.rejects(run('reset', true), /cannot drop|depend/)
    assert.deepEqual((await run('status')).counts, beforeRejectedReset.counts)
    await fixture.testOrm.connect()
    try {
      await fixture.testOrm.em.getConnection().execute('drop view database_dev_guard')
    } finally {
      await fixture.testOrm.close(true)
    }
    const reset = await run('reset', true)
    assert.equal(reset.after?.admin_user, 0)
    assert.equal(reset.after?.post, 0)
    assert.equal(reset.after?.site_settings, 1)
    assert.equal(reset.after?.content_context, 1)
    assert.equal(reset.pendingMigrations, 0)
    assert.equal((await run('status')).pendingMigrations, 0)
    assert.equal(reset.after?.mikro_orm_migrations, preview.counts.mikro_orm_migrations)
    const text = output.join('\n')
    assert(!text.includes(sourceUrl))
    assert(!text.includes(`${new URL(sourceUrl).username}:${new URL(sourceUrl).password}@`))
    process.stdout.write(
      '开发数据库工具通过：默认预览、目标/生产/运行连接拒绝、备份、样本幂等、已编辑样本保留、业务清空与全部迁移事务重建\n',
    )
  } finally {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = sourceUrl
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(`${error.stack}\n`)
  process.exitCode = 1
})
