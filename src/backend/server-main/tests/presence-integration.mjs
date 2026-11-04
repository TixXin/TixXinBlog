/** @file presence-integration.mjs @description 隔离验收实时在线与访问统计：在线人数、浏览去重、访客计数、博主识别、自动化客户端、开关与鉴权。 */
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
      const result = await response.json()
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
    { autoPresence: true, publicStats: true, ownerLastSeenAt: null },
  )

  // 未带访客 ID：计入在线人数，不计浏览与访客
  const first = session()
  let data = await beat({ session: first, path: '/', view: true })
  assert.equal(data.online, 1)
  assert.deepEqual(data.stats, { visitors: 0, todayViews: 0, totalViews: 0 })
  assert.deepEqual(data.owner, { status: 'away', lastSeenAt: null })

  // 访客 A 进入首页：计一次浏览与一位访客；同页重复与定时心跳不再计数
  const visitorA = randomUUID()
  const second = session()
  data = await beat({ session: second, path: '/', view: true }, { visitor: visitorA })
  assert.equal(data.online, 2)
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 1, totalViews: 1 })
  data = await beat({ session: second, path: '/?ref=rss', view: true }, { visitor: visitorA })
  data = await beat({ session: second, path: '/' }, { visitor: visitorA })
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 1, totalViews: 1 })

  // 访客 A 换页面计浏览不计新访客；访客 B 计新访客；后台与预览页不计
  data = await beat({ session: second, path: '/articles/1', view: true }, { visitor: visitorA })
  assert.deepEqual(data.stats, { visitors: 1, todayViews: 2, totalViews: 2 })
  data = await beat({ session: session(), path: '/articles/1', view: true }, { visitor: randomUUID() })
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })
  data = await beat({ session: session(), path: '/admin/posts', view: true }, { visitor: randomUUID() })
  data = await beat({ session: session(), path: '/posts/preview', view: true }, { visitor: randomUUID() })
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })
  const onlineBeforeBot = data.online

  // 自动化客户端不计在线与浏览，但照常拿到数字
  data = await beat(
    { session: session(), path: '/links', view: true },
    { visitor: randomUUID(), agent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  )
  assert.equal(data.online, onlineBeforeBot)
  assert.deepEqual(data.stats, { visitors: 2, todayViews: 3, totalViews: 3 })

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

  // 统计按北京时间日期落库
  const [row] = await fixture.testOrm.em
    .fork()
    .getConnection()
    .execute(`select to_char(day, 'YYYY-MM-DD') as day, views, visitors from site_daily_stats`)
  const beijing = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
  assert.deepEqual({ ...row }, { day: beijing, views: 3, visitors: 2 })

  // 开关：关闭公开统计后不返回在线人数与统计；关闭自动在线后不返回博主状态
  const saved = await call('/admin/presence', { method: 'PATCH', admin: true, body: { publicStats: false } })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.data.publicStats, false)
  assert.equal(saved.body.data.autoPresence, true)
  data = await beat({ session: session() })
  assert.equal(data.online, null)
  assert.equal(data.stats, null)
  assert.equal(data.owner.status, 'online')
  await call('/admin/presence', { method: 'PATCH', admin: true, body: { autoPresence: false, publicStats: true } })
  data = await beat({ session: session() })
  assert.equal(data.owner, null)
  assert.notEqual(data.online, null)
  assert.equal((await call('/admin/presence', { method: 'PATCH', admin: true, body: { publicStats: 'yes' } })).status, 400)

  console.log('presence integration: 在线人数、浏览去重、访客计数、博主识别、自动化客户端、北京时间切日与开关通过')
} finally {
  await fixture.close()
}
