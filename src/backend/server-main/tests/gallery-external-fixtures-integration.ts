/** @file gallery-external-fixtures-integration.ts @description 外链样本的增量备份、重复不增殖、编辑保护、删除不复活及定向清理 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const seed = () =>
    seedDevelopmentData(
      ['--dataset', 'gallery-external-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
  const cleanup = (apply = false) =>
    removeDevelopmentData(
      ['--dataset', 'gallery-external-v1', ...(apply ? ['--apply', '--confirm', database] : [])],
      () => undefined,
      fixture.backupOptions,
    )
  let reconnected = false
  try {
    const em = fixture.testOrm.em.fork()
    assert.equal((await inspectDataCatalog(em, 'gallery-external')).ready, false)
    assert.equal((await seed()).created.length, 4)
    const rows = await em.execute('select * from gallery_photo order by id')
    assert.equal(rows.length, 4)
    assert(rows.every((row) => row.media_id === null && row.external_url.includes('?') && row.taken_on === null))
    assert.equal((await em.execute('select * from media_asset')).length, 0)
    assert.equal((await em.execute('select * from media_reference')).length, 0)
    assert.equal((await inspectDataCatalog(em, 'gallery-external')).ready, true)
    assert.equal((await seed()).created.length, 0)
    assert.deepEqual(await em.execute('select * from gallery_photo order by id'), rows)
    await em.execute('update gallery_photo set external_url=?,revision=revision+1 where id=?', [
      'https://example.org/Edited?Signature=A',
      rows[0].id,
    ])
    assert.equal(
      (await em.execute('select external_url from gallery_photo where id=?', [rows[0].id]))[0].external_url,
      'https://example.org/Edited?Signature=A',
    )
    await em.execute('delete from gallery_photo where id=?', [rows[1].id])
    assert.equal((await seed()).created.length, 0)
    const plan = await cleanup()
    assert.equal(plan.remove.length, 2, JSON.stringify(plan))
    assert.equal(plan.preserve.length, 2)
    await fixture.stopServices()
    await cleanup(true)
    await fixture.testOrm.connect()
    reconnected = true
    assert.equal((await fixture.testOrm.em.fork().execute('select * from gallery_photo')).length, 1)
    assert.equal((await seed()).created.length, 0)
    assert.equal(
      (await fixture.testOrm.em.fork().execute('select external_url from gallery_photo'))[0].external_url,
      'https://example.org/Edited?Signature=A',
    )
    console.log('外链样本通过：4条增量、0虚假媒体、备份、幂等、编辑保护、删除不复活与定向清理')
  } finally {
    if (reconnected) await fixture.testOrm.close(true)
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
