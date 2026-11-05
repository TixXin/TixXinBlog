/** @file traffic-fixtures-integration.ts @description 访问统计样本的预览、跳过真实日期、每日数字自洽、不写今天、后台报表可读、幂等与清理保留真实记录 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createBrowserTestApp } from './test-app.mjs'
import { loadLocalEnvironment } from '../src/config/environment'
import { TRAFFIC_DATASET, TRAFFIC_DAYS, distribute } from '../src/seeders/traffic-fixtures'
import { TrafficService } from '../src/modules/presence/traffic.service'
import { readSiteTimeZone, siteDay } from '../src/modules/site/site-time-zone'
import { shiftDay } from '../src/modules/presence/traffic-keys'

async function main() {
  loadLocalEnvironment()
  const fixture = await createBrowserTestApp('http://localhost')
  const database = decodeURIComponent(new URL(process.env.DATABASE_URL!).pathname.slice(1))
  const { seedDevelopmentData } = await import('../src/seeders/seed-development-data')
  const { removeDevelopmentData } = await import('../src/seeders/remove-development-data')
  const args = (apply: boolean) => ['--dataset', TRAFFIC_DATASET, ...(apply ? ['--apply', '--confirm', database] : [])]
  const seed = (apply = true) => seedDevelopmentData(args(apply), () => undefined, fixture.backupOptions)
  const cleanup = (apply = false) => removeDevelopmentData(args(apply), () => undefined, fixture.backupOptions)
  let reconnected = false
  try {
    // 分配函数：各项之和等于总数，余数按小数部分从大到小补
    assert.deepEqual(
      distribute(10, [
        ['a', 1],
        ['b', 1],
        ['c', 1],
      ]),
      [
        ['a', 4],
        ['b', 3],
        ['c', 3],
      ],
    )
    const em = fixture.testOrm.em.fork()
    const today = siteDay(new Date(), await readSiteTimeZone(em))
    const realDay = shiftDay(today, -5)
    // 该日已有真实统计：样本跳过，不覆盖也不记为不可用
    await em.execute(`insert into site_daily_stats (id, day, views, visitors) values (?, ?::date, 7, 3)`, [
      randomUUID(),
      realDay,
    ])
    const preview = await seed(false)
    assert.equal(preview.preview, true)
    assert.equal((await em.execute('select count(*)::int as n from site_traffic_daily'))[0].n, 0)

    const report = await seed()
    assert.equal(report.ready, true, JSON.stringify(report.unavailable))
    const days = await em.execute<{ day: string; views: number; visitors: number }[]>(
      `select to_char(s.day, 'YYYY-MM-DD') as day, s.views, s.visitors from site_daily_stats s
       join development_fixture f on f.resource_id = s.id::text and f.kind = 'traffic-day' where f.dataset = ? order by s.day`,
      [TRAFFIC_DATASET],
    )
    assert.equal(days.length, TRAFFIC_DAYS - 1)
    assert.ok(days.every((row) => row.day < today && row.day !== realDay && row.day >= shiftDay(today, -TRAFFIC_DAYS)))
    assert.deepEqual(
      { ...(await em.execute(`select views, visitors from site_daily_stats where day = ?::date`, [realDay]))[0] },
      { views: 7, visitors: 3 },
    )
    const sums = await em.execute<{ day: string; dimension: string; total: number; keys: number }[]>(
      `select to_char(day, 'YYYY-MM-DD') as day, dimension, sum(count)::int as total, count(*)::int as keys
       from site_traffic_daily group by day, dimension`,
    )
    for (const row of days) {
      const of = (dimension: string) => sums.find((sum) => sum.day === row.day && sum.dimension === dimension)
      assert.equal(of('page')?.total, row.views, `${row.day} 页面浏览之和应等于当日浏览`)
      assert.equal(of('device')?.total, row.visitors, `${row.day} 设备访客之和应等于当日访客`)
      assert.equal(of('referrer')?.total, row.visitors, `${row.day} 来源之和应等于当日落地访客`)
    }
    assert.ok(new Set(days.map((row) => row.visitors)).size > 5, '每日访客应有起伏')

    const traffic = await new TrafficService(fixture.testOrm.em).report(30)
    assert.equal(traffic.days.length, 30)
    assert.equal(traffic.days.at(-1)!.views, 0, '样本不写今天')
    assert.ok(traffic.pages.some((page) => page.key === '/'))
    assert.ok(traffic.pages.some((page) => page.key.startsWith('/articles/')))
    assert.ok(traffic.referrers.some((referrer) => referrer.key === ''))
    assert.deepEqual(traffic.devices.map((device) => device.key).sort(), ['desktop', 'mobile'])

    // 重复补种不新增；清理只删样本，真实日期保留
    const again = await seed()
    assert.equal(again.created.length, 0)
    assert.equal(again.retained.length, report.created.length)
    assert.equal((await cleanup()).remove.length, report.created.length)
    await fixture.stopServices()
    await cleanup(true)
    await fixture.testOrm.connect()
    reconnected = true
    const after = fixture.testOrm.em.fork()
    assert.equal((await after.execute('select count(*)::int as n from site_traffic_daily'))[0].n, 0)
    assert.deepEqual(
      (await after.execute(`select to_char(day, 'YYYY-MM-DD') as day from site_daily_stats`)).map((row) => row.day),
      [realDay],
    )
    process.stdout.write(
      `访问统计样本通过：${days.length} 天按日汇总、跳过真实日期、页面/来源/设备之和自洽、不写今天、后台报表可读、幂等与清理保留真实记录\n`,
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
