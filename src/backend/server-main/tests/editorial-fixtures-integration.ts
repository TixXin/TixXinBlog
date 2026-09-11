/** @file editorial-fixtures-integration.ts @description 事实草稿及资料整理的隔离备份、目标保护、幂等、编辑与删除保护 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
    const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
    const { preparePersonalProfile } = await import('../src/seeders/prepare-personal-profile')
    const args = ['--apply', '--confirm', database]
    const before = await fixture.testOrm.em.execute('select * from site_settings')
    assert.equal((await preparePersonalProfile([], fixture.backupOptions)).changed, false)
    await assert.rejects(preparePersonalProfile(['--apply', '--confirm', 'wrong'], fixture.backupOptions), /本机非生产/)
    await assert.rejects(preparePersonalProfile(['unknown'], fixture.backupOptions), /用法/)
    const prepared = await preparePersonalProfile(args, fixture.backupOptions)
    assert.equal(prepared.changed, true)
    assert(prepared.backup)
    const [after] = await fixture.testOrm.em.execute('select * from site_settings')
    assert.equal(after.values.ownerName, 'tixxin')
    assert.deepEqual(after.values.socials, [])
    assert.equal(after.values.about.visible, true)
    for (const key of ['name', 'description', 'announcement', 'seoTitle', 'seoDescription'])
      assert.equal(after.values[key], before[0].values[key])
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).changed, false)
    const seed = () =>
      seedDevelopmentData(['--dataset', 'editorial-v1', ...args], () => undefined, fixture.backupOptions)
    const first = await seed()
    assert('created' in first && first.created.length === 4)
    const rows = await fixture.testOrm.em.execute(
      "select f.resource_id,p.status,p.content_raw from development_fixture f join post p on p.id::text=f.resource_id where f.dataset='editorial-v1' and f.kind='post'",
    )
    assert.equal(rows.length, 3)
    assert(
      rows.every(
        (row: { status: string; content_raw: string }) =>
          row.status === 'draft' && row.content_raw.includes('可核查的位置'),
      ),
    )
    const [project] = await fixture.testOrm.em.execute(
      "select p.* from project p join development_fixture f on f.resource_id=p.id::text and f.kind='project' where f.dataset='editorial-v1'",
    )
    assert.equal(project.status, 'draft')
    assert.equal(project.cover_media_id, null)
    await fixture.testOrm.em.execute('update post set title=? where id=?', ['保留编辑后的标题', rows[0].resource_id])
    await fixture.testOrm.em.execute('update post set deleted_at=now() where id=?', [rows[1].resource_id])
    const again = await seed()
    assert('created' in again && again.created.length === 0)
    assert('unavailable' in again && again.unavailable.length === 1)
    const [edited] = await fixture.testOrm.em.execute('select title from post where id=?', [rows[0].resource_id])
    assert.equal(edited.title, '保留编辑后的标题')
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '事实草稿与资料整理隔离验证通过：4条归属、全草稿、备份、默认预览、目标拒绝、配置保留、重复无新增、编辑删除保护、零漂移\n',
    )
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
})
