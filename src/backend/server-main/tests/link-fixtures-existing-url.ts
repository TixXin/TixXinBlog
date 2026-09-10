/** @file link-fixtures-existing-url.ts @description 独立测试进程验证已有同址友链不被种子覆盖或接管 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { LinkService } from '../src/modules/link/link.service'
import { seedDevelopmentData } from '../src/seeders/seed-development-data'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  try {
    const em = fixture.testOrm.em.fork()
    const user = await new LinkService(em).save(null, {
      name: '我收藏的 Vue 资料',
      url: 'https://vuejs.org/',
      description: '自己的整理说明',
      requestId: randomUUID(),
      status: 'published',
    })
    const before = (await em.execute('select * from friend_link where id=?', [user.id]))[0]
    const result = await seedDevelopmentData(
      ['--dataset', 'link-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
    assert.equal(result.ready, false)
    assert.equal(result.created.length, 20)
    assert(result.unavailable.includes('link-v1/link/0/url-already-present'))
    assert.deepEqual((await em.execute('select * from friend_link where id=?', [user.id]))[0], before)
    assert.equal(
      (
        await em.execute("select count(*)::int n from development_fixture where kind='link' and resource_id=?", [
          String(user.id),
        ])
      )[0].n,
      0,
    )
    const repeated = await seedDevelopmentData(
      ['--dataset', 'link-v1', '--apply', '--confirm', database],
      () => undefined,
      fixture.backupOptions,
    )
    assert.equal(repeated.created.length, 0)
    assert.equal((await em.execute('select count(*)::int n from friend_link'))[0].n, 18)
    process.stdout.write('友链已有地址保护通过：同URL用户记录不覆盖、不接管归属，其余样本继续补齐且重复不增殖\n')
  } finally {
    await fixture.close()
  }
  await assert.rejects(createBrowserTestApp('http://localhost'), /只允许创建一次隔离应用/)
}

void main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
