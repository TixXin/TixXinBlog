/** @file core-fixtures-integration.ts @description 隔离库验证增量样本、真实媒体/互动、失败回滚及删除不复活 */
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { inspectDataCatalog } from '../src/seeders/development-data-catalog'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const target = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const run = (apply = false) =>
    seedDevelopmentData(['--dataset', 'core-v1', ...(apply ? ['--apply', '--confirm', target] : [])], () => undefined)
  try {
    const em = fixture.testOrm.em.fork()
    const preview = await run()
    assert.equal(preview.preview, true)
    assert.equal((await em.execute('select count(*)::int as n from development_fixture'))[0].n, 0)
    await em.execute(
      "create function reject_core_fixture() returns trigger language plpgsql as $$ begin if new.content like '周末的公园散步%' then raise exception 'core_fixture_failure'; end if; return new; end $$",
    )
    await em.execute(
      'create trigger reject_core_fixture before insert on flash_note for each row execute function reject_core_fixture()',
    )
    await assert.rejects(run(true))
    assert.equal((await em.execute('select count(*)::int as n from development_fixture'))[0].n, 0)
    assert.equal((await em.execute('select count(*)::int as n from post'))[0].n, 106)
    assert.equal((await em.execute('select count(*)::int as n from media_asset'))[0].n, 0)
    assert.equal((await readdir(process.env.MEDIA_DIRECTORY!)).length, 0)
    await em.execute('drop trigger reject_core_fixture on flash_note')
    await em.execute('drop function reject_core_fixture()')
    const first = await run(true)
    assert.equal(first.ready, true)
    assert.equal(first.created.length, 71)
    for (const domain of ['posts', 'comments', 'flashes', 'moments', 'media', 'site'])
      assert.equal((await inspectDataCatalog(em, domain)).ready, true, domain)
    const [image] = await em.execute('select * from media_asset')
    const bytes = await readFile(join(process.env.MEDIA_DIRECTORY!, image.storage_key))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), image.sha256)
    assert.equal((await fetch(fixture.origin + `/api/v1/media/${image.storage_key}`)).status, 200)
    for (const [table, relation, kind] of [
      ['post', 'post_id', 'post_like'],
      ['flash_note', 'flash_note_id', 'flash_like'],
      ['moment', 'moment_id', 'moment_like'],
    ]) {
      const [value] = await em.execute(
        `select count(*)::int as n from ${table} p where p.likes<>(select count(*) from ${kind} l where l.${relation}=p.id)`,
      )
      assert.equal(value.n, 0, `${kind} 实际计数`)
    }
    const before = await em.execute('select * from development_fixture order by key')
    const repeat = await run(true)
    assert.equal(repeat.created.length, 0)
    assert.deepEqual(await em.execute('select * from development_fixture order by key'), before)
    const postId = before.find((row) => row.key === 'core-v1/post/0').resource_id
    await em.execute("update post set title='用户修改后保留的标题',revision=revision+1 where id=?", [postId])
    const flashId = before.find((row) => row.key === 'core-v1/flash/0').resource_id
    await em.execute('delete from flash_note where id=?', [flashId])
    const afterDelete = await run(true)
    assert.equal(afterDelete.created.length, 0)
    assert.equal(afterDelete.ready, false)
    assert(afterDelete.unavailable.includes('core-v1/flash/0'))
    assert.equal((await em.execute('select count(*)::int as n from flash_note where id=?', [flashId]))[0].n, 0)
    assert.equal((await em.execute('select title from post where id=?', [postId]))[0].title, '用户修改后保留的标题')
    assert.equal((await em.execute('select count(*)::int as n from development_fixture'))[0].n, 71)
    process.stdout.write('核心样本验证通过：71条归属、真实图片/互动、全事务回滚、重复不增殖、编辑保留、删除不复活\n')
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
