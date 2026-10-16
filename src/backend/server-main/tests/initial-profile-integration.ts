/** @file initial-profile-integration.ts @description 新库中性资料、精确旧默认升级、任意编辑保留及显式定位整理的隔离回归。 */
import assert from 'node:assert/strict'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { Migration20260911225000_sanitize_initial_profile } from '../src/migrations/20260911225000_sanitize_initial_profile'
import {
  LEGACY_INITIAL_SITE_VALUES,
  LEGACY_SANITIZED_SITE_VALUES,
  SAFE_INITIAL_SITE_VALUES,
  INITIAL_PROFILE_REASON,
  SAFE_INITIAL_PROFILE_REASON,
  EMPTY_INITIAL_ABOUT,
} from '../src/modules/site/initial-profile'

// 在线状态、签名与上线日期是后加字段，老库写入的初始JSON里并不存在；指纹常量为类型完整补了空串，
// 这里模拟历史库时必须去掉，否则与迁移内固定的历史JSON对不上。
function withoutLaterFields<T extends Record<string, unknown>>(values: T) {
  const {
    presenceLabel: _presenceLabel,
    presenceSignature: _presenceSignature,
    launchedAt: _launchedAt,
    ...rest
  } = values
  void _presenceLabel
  void _presenceSignature
  void _launchedAt
  return rest
}
const LEGACY_HISTORY_VALUES = withoutLaterFields(LEGACY_INITIAL_SITE_VALUES)
const LEGACY_SANITIZED_HISTORY_VALUES = withoutLaterFields(LEGACY_SANITIZED_SITE_VALUES)

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  try {
    const em = fixture.testOrm.em.fork()
    const current = async () => (await em.execute("select * from site_settings where id='default'"))[0]
    const history = () => em.execute('select * from site_settings_revision order by revision')
    const fresh = await current(),
      freshHistory = await history()
    // 新建库写入的就是中性初始值，收起旧资料的迁移匹配0行空转，因此停在revision0且只有一条历史。
    assert.equal(fresh.revision, 0)
    assert.deepEqual(fresh.values, SAFE_INITIAL_SITE_VALUES)
    assert.equal(freshHistory.length, 1)
    assert.deepEqual(freshHistory[0].values, SAFE_INITIAL_SITE_VALUES)
    assert.equal(freshHistory[0].reason, INITIAL_PROFILE_REASON)
    const publicResponse = await fetch(fixture.origin + '/api/v1/site')
    assert.equal(publicResponse.status, 200)
    const publicProfile = (await publicResponse.json()).data
    assert.equal(publicProfile.name, 'My Blog')
    assert.equal(publicProfile.description, '')
    assert.equal(publicProfile.ownerName, '博主')
    assert.equal(publicProfile.ownerTitle, '')
    assert.equal(publicProfile.avatar, '/avatar.svg')
    assert.deepEqual(publicProfile.socials, [])
    assert.deepEqual(publicProfile.about, EMPTY_INITIAL_ABOUT)
    for (const old of ['前端开发工程师', 'twitter.com', 'mailto:', 'avatar-photo.webp'])
      assert(!JSON.stringify(publicProfile).includes(old))
    // 全新建库不得带出作者身份：姓名、域名与人物肖像都不应出现。
    for (const owner of ['TixXin', 'tix.xin', 'avatar-photo.webp'])
      assert(!JSON.stringify(publicProfile).includes(owner), `全新建库的站点资料不应包含 ${owner}`)
    const { preparePersonalProfile } = await import('../src/seeders/prepare-personal-profile')
    // 中性初始资料同样属于“未经编辑”，显式整理工具仍能识别；默认预览不写入。
    assert.equal((await preparePersonalProfile([], fixture.backupOptions)).eligible, true)
    assert.deepEqual((await current()).values, SAFE_INITIAL_SITE_VALUES)
    const login = await fetch(fixture.origin + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fixture.username, password: fixture.password }),
    })
    assert.equal(login.status, 200)
    const token = (await login.json()).data.accessToken
    const { announcementUpdatedAt: _announcementUpdatedAt, ...initialInput } = SAFE_INITIAL_SITE_VALUES
    void _announcementUpdatedAt
    const stale = await fetch(fixture.origin + '/api/v1/admin/site', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...initialInput, revision: 1 }),
    })
    assert.equal(stale.status, 409, '拒绝持有错误revision的编辑请求')
    async function migrate(down = false) {
      const migration = new Migration20260911225000_sanitize_initial_profile(em.getDriver(), fixture.testOrm.config)
      if (down) await migration.down()
      else await migration.up()
      await em.transactional(async (transaction) => {
        for (const sql of migration.getQueries()) await transaction.execute(sql)
      })
    }
    await migrate()
    await migrate(true)
    assert.deepEqual(await current(), fresh)
    assert.deepEqual(await history(), freshHistory)

    const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
    const args = ['--apply', '--confirm', database]
    async function oldDefault(patch: Record<string, unknown> = {}, revision = 0) {
      await em.transactional(async (transaction) => {
        await transaction.execute('delete from site_settings_revision where revision>0')
        await transaction.execute('update site_settings_revision set "values"=?::jsonb,reason=? where revision=0', [
          JSON.stringify(LEGACY_HISTORY_VALUES),
          INITIAL_PROFILE_REASON,
        ])
        await transaction.execute(
          'update site_settings set revision=?,"values"=?::jsonb,updated_at=? where id=\'default\'',
          [
            revision,
            JSON.stringify({ ...LEGACY_HISTORY_VALUES, about: EMPTY_INITIAL_ABOUT, ...patch }),
            new Date('2026-09-01T00:00:00Z'),
          ],
        )
      })
    }
    await oldDefault()
    const preservedZero = (await history())[0]
    await migrate()
    assert.deepEqual((await current()).values, LEGACY_SANITIZED_HISTORY_VALUES)
    assert.deepEqual((await history())[0], preservedZero, '升级不得改写旧revision0历史')
    assert.equal((await current()).revision, 1)
    assert.equal((await history())[1].reason, SAFE_INITIAL_PROFILE_REASON)
    for (const patch of [
      { name: '自行命名的站点' },
      { description: '自己维护的介绍' },
      { announcement: '自己的公告' },
      { socials: [{ ...LEGACY_INITIAL_SITE_VALUES.socials[0], label: '自己确认的链接' }] },
      { about: { visible: false, introduction: '尚未公开但已编辑', sections: [] } },
      { footerNote: '额外手工维护配置' },
    ]) {
      await oldDefault(patch)
      const before = await current(),
        beforeHistory = await history()
      await migrate()
      assert.deepEqual(await current(), before)
      assert.deepEqual(await history(), beforeHistory)
      assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).changed, false)
      assert.deepEqual(await current(), before)
    }
    await oldDefault(
      {
        ...LEGACY_SANITIZED_HISTORY_VALUES,
        about: { visible: true, introduction: '当前日常已维护的站点介绍', sections: [] },
      },
      1,
    )
    await em.execute(
      'insert into site_settings_revision(revision,"values",reason,created_at) select 1,"values",\'用户已维护资料\',updated_at from site_settings',
    )
    const edited = await current()
    await migrate()
    assert.deepEqual(await current(), edited, '日常revision1+非空介绍保持不变')
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).changed, false)
    await oldDefault()
    await em.execute("update site_settings_revision set reason='另行维护的历史' where revision=0")
    await migrate()
    assert.equal((await current()).revision, 0)
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).eligible, false)
    await oldDefault()
    await em.execute(
      'update site_settings_revision set "values"="values"||\'{"description":"历史快照已被手工维护"}\'::jsonb where revision=0',
    )
    const historyEdited = await current()
    await migrate()
    assert.deepEqual(await current(), historyEdited)
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).eligible, false)
    await oldDefault()
    await em.execute(
      'insert into site_settings_revision(revision,"values",reason,created_at) select 1,"values",\'保留的既有历史\',updated_at from site_settings',
    )
    const existingHistory = await history()
    await migrate()
    assert.equal((await current()).revision, 0)
    assert.deepEqual(await history(), existingHistory)
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).eligible, false)

    await oldDefault()
    await migrate()
    const initialRevision = (await current()).revision
    assert.equal((await preparePersonalProfile([], fixture.backupOptions)).eligible, true)
    const prepared = await preparePersonalProfile(args, fixture.backupOptions)
    assert.equal(prepared.changed, true)
    assert.equal(prepared.revision, initialRevision + 1)
    assert(prepared.backup)
    assert.equal((await current()).values.about.visible, true)
    assert((await current()).values.about.introduction.includes('myblog'))
    assert.deepEqual((await history())[0].values, LEGACY_HISTORY_VALUES)
    assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).changed, false)

    // 即使手工SQL未递增revision，备份期间的修改也必须在锁内复核后保留。
    await oldDefault()
    await migrate()
    const prototype = Object.getPrototypeOf(fixture.testOrm.em),
      originalExecute = prototype.execute
    const own = Object.hasOwn(prototype, 'execute')
    let injected = 0
    prototype.execute = async function (sql: unknown, ...rest: unknown[]) {
      const value = await Reflect.apply(originalExecute, this, [sql, ...rest])
      if (typeof sql === 'string' && sql.includes('pg_export_snapshot()') && injected === 0) {
        injected++
        await Reflect.apply(originalExecute, em, [
          'update site_settings set "values"="values"||\'{"description":"备份期间的手工修改"}\'::jsonb where id=\'default\'',
        ])
      }
      return value
    }
    try {
      assert.equal((await preparePersonalProfile(args, fixture.backupOptions)).changed, false)
    } finally {
      if (own) prototype.execute = originalExecute
      else delete prototype.execute
    }
    assert.equal(injected, 1)
    assert.equal((await current()).values.description, '备份期间的手工修改')
    assert.equal((await current()).revision, 1)
    assert.equal((await fixture.testOrm.schema.getUpdateSchemaSQL({ wrap: false })).trim(), '')
    process.stdout.write(
      '初始资料安全验证通过：新库中性资料不含作者身份、旧默认精确升级、历史保留、重复/down不复发、任意编辑与备份中并发修改保护、显式定位整理。\n',
    )
  } finally {
    await fixture.close()
  }
}
void main().catch((error) => {
  process.stderr.write(String(error.stack ?? error) + '\n')
  process.exitCode = 1
})
