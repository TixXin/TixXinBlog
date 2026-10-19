/**
 * @file initial-locale-integration.ts
 * @description 站点默认语言为 en 时初始资料本地化迁移的隔离回归：只改写未编辑的中文初始资料，编辑过的不动，
 *              zh 下不改动，重复执行幂等，整理工具同时识别中英两种未编辑初始资料
 * @author TixXin
 * @since 2026-10-19
 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { Migration20261019120000_localize_initial_site_settings } from '../src/migrations/20261019120000_localize_initial_site_settings'
import {
  INITIAL_PROFILE_REASON,
  INITIAL_PROFILE_REASON_EN,
  SAFE_INITIAL_SITE_VALUES,
  SAFE_INITIAL_SITE_VALUES_EN,
} from '../src/modules/site/initial-profile'

async function main() {
  loadLocalEnvironment()
  delete process.env.SITE_DEFAULT_LOCALE
  // 隔离库按缺省中文完成全部迁移，之后在同一库上按不同语言重放本地化迁移。
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const em = fixture.testOrm.em.fork()
    const current = async () => (await em.execute("select * from site_settings where id='default'"))[0]
    const history = () => em.execute('select revision,"values",reason from site_settings_revision order by revision')
    async function migrate(locale: string | undefined) {
      if (locale === undefined) delete process.env.SITE_DEFAULT_LOCALE
      else process.env.SITE_DEFAULT_LOCALE = locale
      try {
        const migration = new Migration20261019120000_localize_initial_site_settings(
          em.getDriver(),
          fixture.testOrm.config,
        )
        await migration.up()
        await em.transactional(async (transaction) => {
          for (const sql of migration.getQueries()) await transaction.execute(sql)
        })
        return migration.getQueries().length
      } finally {
        delete process.env.SITE_DEFAULT_LOCALE
      }
    }
    async function resetInitial(values: Record<string, unknown> = SAFE_INITIAL_SITE_VALUES) {
      await em.transactional(async (transaction) => {
        await transaction.execute('delete from site_settings_revision where revision>0')
        await transaction.execute('update site_settings_revision set "values"=?::jsonb,reason=? where revision=0', [
          JSON.stringify(values),
          INITIAL_PROFILE_REASON,
        ])
        await transaction.execute(`update site_settings set "values"=?::jsonb,revision=0 where id='default'`, [
          JSON.stringify(values),
        ])
      })
    }
    const { eligibleInitialProfile } = await import('../src/seeders/prepare-personal-profile')

    const fresh = await current()
    const freshHistory = await history()
    assert.equal(fresh.revision, 0)
    assert.deepEqual(fresh.values, SAFE_INITIAL_SITE_VALUES)
    assert.equal(freshHistory[0].reason, INITIAL_PROFILE_REASON)

    // zh 与无效值：不产生语句，数据保持原样。
    for (const locale of [undefined, 'zh-CN', 'fr', 'EN']) assert.equal(await migrate(locale), 0)
    assert.deepEqual(await current(), fresh)
    assert.deepEqual(await history(), freshHistory)

    // en：未编辑的中文初始资料改为英文，当前值与修订 0 一致，其余字段与更新时间不变。
    assert.equal(await migrate('en'), 1)
    const english = await current()
    assert.deepEqual(english.values, SAFE_INITIAL_SITE_VALUES_EN)
    assert.equal(english.revision, 0)
    assert.equal(String(english.updated_at), String(fresh.updated_at))
    const englishHistory = await history()
    assert.equal(englishHistory.length, 1)
    assert.deepEqual(englishHistory[0].values, SAFE_INITIAL_SITE_VALUES_EN)
    assert.equal(englishHistory[0].reason, INITIAL_PROFILE_REASON_EN)
    const publicProfile = (await (await fetch(fixture.origin + '/api/v1/site')).json()).data
    assert.equal(publicProfile.ownerName, 'Blogger')
    assert.equal(publicProfile.avatarAlt, 'Blogger avatar')
    // 整理工具同时识别英文的未编辑初始资料。
    assert.equal(await eligibleInitialProfile(em.fork()), true)

    // 重复执行幂等。
    await migrate('en')
    assert.deepEqual(await current(), english)
    assert.deepEqual(await history(), englishHistory)

    // 只改写与中文初始值逐字一致的字段：博主名称已改为其他值时只改头像说明。
    await resetInitial({ ...SAFE_INITIAL_SITE_VALUES, ownerName: '小林' })
    await migrate('en')
    assert.equal((await current()).values.ownerName, '小林')
    assert.equal((await current()).values.avatarAlt, 'Blogger avatar')

    // 保存过（产生修订 1，与站点设置服务的保存效果一致）的资料一律不动。
    await resetInitial()
    assert.equal(await eligibleInitialProfile(em.fork()), true)
    await em.transactional(async (transaction) => {
      await transaction.execute(
        `update site_settings set "values"="values" || '{"description":"博主写的简介"}'::jsonb,revision=1 where id='default'`,
      )
      await transaction.execute(
        `insert into site_settings_revision(revision,"values",reason,created_at) select 1,"values",'更新站点资料',now() from site_settings where id='default'`,
      )
    })
    const edited = await current()
    const editedHistory = await history()
    assert.equal(edited.revision, 1)
    await migrate('en')
    assert.deepEqual(await current(), edited)
    assert.deepEqual(await history(), editedHistory)
    assert.equal(edited.values.ownerName, '博主')

    // 修订 0 之后被直接改动（当前值与修订 0 不一致）也视为已编辑。
    await resetInitial()
    await em.execute(`update site_settings set "values"="values" || '{"description":"手工维护"}'::jsonb`)
    await migrate('en')
    assert.equal((await current()).values.ownerName, '博主')
    assert.equal((await history())[0].reason, INITIAL_PROFILE_REASON)

    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '初始资料本地化验证通过：en 下只改写未编辑的中文初始资料，zh/无效值不改动，重复执行幂等，已编辑资料保留，整理工具识别英文初始资料。\n',
    )
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(String(error.stack ?? error) + '\n')
  process.exitCode = 1
})
