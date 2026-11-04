/** @file presence-integration.mjs @description 隔离验收实时在线与访问统计：在线人数、正在阅读、离开上报、浏览去重、访客计数、访问构成与后台统计、博主识别与隐身与隐身、自动化客户端、开关与鉴权。 */
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost')
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
try {
  const login = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).data.accessToken

  async function call(path, { method = 'POST', body, visitor, admin = false, agent = BROWSER } = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(fixture.origin + '/api/v1' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': agent,
          ...(visitor ? { 'X-Visitor-Id': visitor } : {}),
          ...(admin ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const text = await response.text()
      const result = text ? JSON.parse(text) : null
      if (response.status === 429 && attempt < 3) {
        await delay(1100)
        continue
      }
      return { status: response.status, body: result }
    }
  }
  const session = () => randomBytes(16).toString('hex')
  async function beat(body, options) {
    const result = await call('/presence', { body, ...options })
    assert.equal(result.status, 200, JSON.stringify(result.body))
    return result.body.data
  }

  // 输入边界与鉴权
  assert.equal((await call('/presence', { body: { session: 'not-hex' } })).status, 400)
  assert.equal((await call('/admin/presence', { method: 'GET' })).status, 401)
  assert.deepEqual(
    { ...(await call('/admin/presence', { method: 'GET', admin: true })).body.data, ownerLastSeenAt: null },
    { autoPresence: true, publicStats: true, invisible: false, ownerLastSeenAt: null },
  )

  // 访问统计：空库返回补零的 30 天与空排行；只接受 7/30/90 天；需要登录
  const sql = (text, params = []) => fixture.testOrm.em.fork().getConnection().execute(text, params)
  const beijing = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const daysAgo = (n) => {
    const date = new Date(`${beijing}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - n)
    return date.toISOString().slice(0, 10)
  }
  // 超出 365 天保留期的访问构成在当天第一次计浏览时清理
  await sql(`insert into site_traffic_daily (id, day, dimension, key, count) values (?, ?, 'page', '/expired', 3)`, [
    randomUUID(),
    daysAgo(400),
  ])
  const report = async (days) => {
    const result = await call(`/admin/presence/traffic${days ? `?days=${days}` : ''}`, { method: 'GET', admin: true })
    assert.equal(result.status, 200, JSON.stringify(result.body))
    return result.body.data
  }
  let traffic = await report()
  assert.equal(traffic.days.length, 30)
  assert.equal(traffic.to, beijing)
  assert.equal(traffic.from, daysAgo(29))
  assert.ok(traffic.days.every((day) => day.views === 0 && day.visitors === 0))
  assert.deepEqual(
    { totals: traffic.totals, pages: traffic.pages, referrers: traffic.referrers, devices: traffic.devices },
    { totals: { views: 0, visitors: 0 }, pages: [], referrers: [], devices: [] },
  )
  assert.equal((await report(7)).days.length, 7)
  assert.equal((await report(90)).days.length, 90)
  assert.equal((await call('/admin/presence/traffic?days=15', { method: 'GET', admin: true })).status, 400)
  assert.equal((await call('/admin/presence/traffic', { method: 'GET' })).status, 401)

  // 未带访客 ID：计入在线人数，不计浏览与访客
  const first = session()
  let data = await beat({ session: first, path: '/', view: true })
  assert.equal(data.online, 1)
  assert.deepEqual(data.stats, { visitors: 0, todayViews: 0, totalViews: 0 })
  assert.deepEqual(data.owner, { status: 'away', lastSeenAt: null })

  // 访客 A 进入首页：计一次浏览与一位访客；同页重复与定时心跳不再计数
  const visitorA = randomUUID()
  const second = session()
  data = await beat({ session: second, path: '/', view: true, referrer: 'WWW.Google.com' }, { visitor: visitorA })
  assert.equal(data.online, 2)
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 1, totalViews: 1 })
  data = await beat({ session: second, path: '/?ref=rss', view: true }, { visitor: visitorA })
  data = await beat({ session: second, path: '/' }, { visitor: visitorA })
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 1, totalViews: 1 })

  // 访客 A 换页面计浏览不计新访客；访客 B 计新访客；后台与预览页不计
  data = await beat({ session: second, path: '/articles/1', view: true }, { visitor: visitorA })
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 2, totalViews: 2 })
  const readerB = session()
  data = await beat({ session: readerB, path: '/articles/1', view: true, referrer: '' }, { visitor: randomUUID() })
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })

  // 正在阅读：心跳返回同页在线会话数（含自己），查询接口不登记心跳；离开上报后立即移出
  assert.equal(data.readers, 2)
  const readers = async (path) => {
    const result = await call('/presence/readers?path=' + encodeURIComponent(path), { method: 'GET' })
    assert.equal(result.status, 200, JSON.stringify(result.body))
    return result.body.data.readers
  }
  assert.equal(await readers('/articles/1'), 2)
  assert.equal(await readers('/articles/1?from=list#comments'), 2)
  assert.equal(await readers('/articles/2'), 0)
  assert.equal(await readers('/admin/posts'), null)
  assert.equal((await call('/presence/readers', { method: 'GET' })).status, 400)
  const onlineBeforeLeave = (await beat({ session: readerB, path: '/articles/1' })).online
  const left = await call('/presence/leave', { body: { session: readerB } })
  assert.equal(left.status, 204)
  assert.equal(await readers('/articles/1'), 1)
  assert.equal((await call('/presence/leave', { body: { session: 'not-hex' } })).status, 400)
  data = await beat({ session: second, path: '/articles/1' }, { visitor: visitorA })
  assert.equal(data.online, onlineBeforeLeave - 1)
  assert.equal(data.readers, 1)
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })
  data = await beat({ session: session(), path: '/admin/posts', view: true }, { visitor: randomUUID() })
  data = await beat({ session: session(), path: '/posts/preview', view: true }, { visitor: randomUUID() })
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })

  // 单日访问构成：页面按路径计浏览，来源只计落地浏览（空串为直接访问），设备按当日访客计；过期构成已清理
  traffic = await report()
  assert.deepEqual(traffic.days.at(-1), { date: beijing, views: 3, visitors: 2 })
  assert.deepEqual(traffic.totals, { views: 3, visitors: 2 })
  assert.deepEqual(traffic.pages, [
    { key: '/articles/1', count: 2 },
    { key: '/', count: 1 },
  ])
  assert.deepEqual(traffic.referrers, [
    { key: '', count: 1 },
    { key: 'google.com', count: 1 },
  ])
  assert.deepEqual(traffic.devices, [{ key: 'desktop', count: 2 }])
  assert.deepEqual(traffic.browsers, [{ key: 'safari', count: 2 }])
  assert.equal((await sql(`select count(*)::int as n from site_traffic_daily where key = '/expired'`))[0].n, 0)
  // 非法来源不计来源但照常计浏览
  assert.equal(
    (await call('/presence', { body: { session: session(), path: '/', view: true, referrer: 'a'.repeat(254) } }))
      .status,
    400,
  )

  // 每天每个维度的不同键有上限，新来源超出后计入 (other)
  for (let index = 0; index < 200; index++)
    await sql(`insert into site_traffic_daily (id, day, dimension, key, count) values (?, ?, 'referrer', ?, 0)`, [
      randomUUID(),
      beijing,
      `filler-${index}.example`,
    ])
  await beat({ session: session(), path: '/links', view: true, referrer: 'new.example' }, { visitor: randomUUID() })
  const capped = await sql(
    `select key, count from site_traffic_daily where day = ? and dimension = 'referrer' and key in ('new.example', '(other)')`,
    [beijing],
  )
  assert.deepEqual(
    capped.map((row) => ({ ...row })),
    [{ key: '(other)', count: 1 }],
  )
  data = await beat({ session: session(), path: '/', view: false })
  const onlineBeforeBot = data.online

  // 自动化客户端不计在线与浏览，但照常拿到数字
  data = await beat(
    { session: session(), path: '/links', view: true },
    { visitor: randomUUID(), agent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  )
  assert.equal(data.online, onlineBeforeBot)
  assert.deepEqual(data.stats, { visitors: 3, todayViews: 4, totalViews: 4 })

  // 博主令牌：显示在线并记录最后在线时间；无效令牌按普通访客处理
  assert.equal((await call('/presence', { body: { session: session() }, admin: false })).status, 200)
  data = await beat({ session: session() }, { admin: true })
  assert.equal(data.owner.status, 'online')
  assert.ok(Date.now() - Date.parse(data.owner.lastSeenAt) < 60_000)
  const settings = (await call('/admin/presence', { method: 'GET', admin: true })).body.data
  assert.ok(settings.ownerLastSeenAt, '博主最后在线时间应写入数据库')
  const forged = await fetch(fixture.origin + '/api/v1/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER, Authorization: 'Bearer forged.token.value' },
    body: JSON.stringify({ session: session() }),
  })
  assert.equal(forged.status, 200)

  // 隐身：博主照常记录活动，访客看到离线且没有最后在线时间；关闭后恢复
  assert.equal((await call('/admin/presence', { method: 'PATCH', admin: true, body: { invisible: true } })).status, 200)
  data = await beat({ session: session() }, { admin: true })
  assert.deepEqual(data.owner, { status: 'away', lastSeenAt: null })
  data = await beat({ session: session() })
  assert.deepEqual(data.owner, { status: 'away', lastSeenAt: null })
  const hidden = (await call('/admin/presence', { method: 'GET', admin: true })).body.data
  assert.equal(hidden.invisible, true)
  assert.ok(hidden.ownerLastSeenAt, '隐身时后台仍能看到最后在线时间')
  assert.equal(
    (await call('/admin/presence', { method: 'PATCH', admin: true, body: { invisible: 'yes' } })).status,
    400,
  )
  await call('/admin/presence', { method: 'PATCH', admin: true, body: { invisible: false } })
  assert.equal((await beat({ session: session() })).owner.status, 'online')

  // 统计按北京时间日期落库
  const [row] = await fixture.testOrm.em
    .fork()
    .getConnection()
    .execute(`select to_char(day, 'YYYY-MM-DD') as day, views, visitors from site_daily_stats`)
  assert.deepEqual({ ...row }, { day: beijing, views: 4, visitors: 3 })

  // 开关：关闭公开统计后不返回在线人数与统计；关闭自动在线后不返回博主状态
  const saved = await call('/admin/presence', { method: 'PATCH', admin: true, body: { publicStats: false } })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.data.publicStats, false)
  assert.equal(saved.body.data.autoPresence, true)
  data = await beat({ session: session() })
  assert.equal(data.online, null)
  assert.equal(data.stats, null)
  assert.equal(data.readers, null)
  assert.equal(await readers('/articles/1'), null)
  assert.equal(data.owner.status, 'online')
  await call('/admin/presence', { method: 'PATCH', admin: true, body: { autoPresence: false, publicStats: true } })
  data = await beat({ session: session() })
  assert.equal(data.owner, null)
  assert.notEqual(data.online, null)
  assert.equal(
    (await call('/admin/presence', { method: 'PATCH', admin: true, body: { publicStats: 'yes' } })).status,
    400,
  )

  console.log(
    'presence integration: 在线人数、正在阅读、离开上报、浏览去重、访客计数、访问构成与后台统计、博主识别、自动化客户端、北京时间切日与开关通过',
  )
} finally {
  await fixture.close()
}
