/**
 * @file auth-sessions-integration.mjs
 * @description 隔离账号的稳定会话、单会话撤销、退出即时失效和旧 Cookie 兼容验收。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'
const fixture = await createBrowserTestApp('http://localhost')
try {
  let writes = 0
  async function request(
    path,
    { method = 'GET', body, token, cookie, agent = 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 private-build-id' } = {},
  ) {
    if (method !== 'GET' && ++writes % 5 === 0) await delay(1100)
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': agent,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    }
  }
  async function login(username = fixture.username) {
    const response = await request('/auth/login', { method: 'POST', body: { username, password: fixture.password } })
    assert.equal(response.status, 200)
    return { token: response.body.data.accessToken, cookie: response.cookie }
  }
  const first = await login()
  const second = await login()
  const other = await login(fixture.accountUsername)
  const decode = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  const firstId = decode(first.token).sid
  const secondId = decode(second.token).sid
  assert(firstId && firstId !== secondId)
  const list = await request('/auth/sessions', first)
  assert.equal(list.status, 200)
  assert.equal(list.body.data.total, 2)
  assert.equal(list.body.data.items.filter((item) => item.current).length, 1)
  assert(list.body.data.items.every((item) => item.device === 'Windows · Chrome'))
  assert(!JSON.stringify(list.body).includes('private-build-id'))
  const em = fixture.testOrm.em.fork()
  assert.equal(
    (await em.execute('select count(*)::int as count from refresh_token where user_agent is not null'))[0].count,
    0,
  )
  const refreshed = await request('/auth/refresh', { method: 'POST', cookie: first.cookie })
  assert.equal(refreshed.status, 200)
  assert.equal(decode(refreshed.body.data.accessToken).sid, firstId)
  first.token = refreshed.body.data.accessToken
  first.cookie = refreshed.cookie
  assert.equal((await request(`/auth/sessions/${decode(other.token).sid}`, { ...first, method: 'DELETE' })).status, 404)
  assert.equal((await request(`/auth/sessions/${secondId}`, { ...first, method: 'DELETE' })).status, 200)
  assert.equal((await request('/admin/posts', second)).status, 401, '撤销后旧访问令牌立即拒绝')
  assert.equal((await request('/auth/refresh', { cookie: second.cookie, method: 'POST' })).status, 401)
  assert.equal((await request('/auth/session', { cookie: second.cookie })).body.data.authenticated, false)
  assert.equal((await request('/admin/posts', first)).status, 200)
  assert.equal((await request('/admin/posts', other)).status, 200, '不影响其他账号')
  const third = await login()
  const revoked = await request('/auth/sessions/revoke-others', { ...first, method: 'POST' })
  assert.equal(revoked.status, 201)
  assert.equal(revoked.body.data.revoked, 1)
  assert.equal((await request('/auth/me', third)).status, 401)
  const logout = await request('/auth/logout', { ...first, method: 'POST' })
  assert.equal(logout.status, 200)
  assert.equal((await request('/admin/posts', first)).status, 401)
  assert.equal((await request('/auth/refresh', { cookie: first.cookie, method: 'POST' })).status, 401)
  await delay(1100)
  const bearerOnly = await login()
  assert.equal((await request('/auth/logout', { token: bearerOnly.token, method: 'POST' })).status, 200)
  assert.equal((await request('/auth/me', bearerOnly)).status, 401, '没有 Cookie 时也可通过当前访问令牌退出')
  await delay(1100)
  const mixedA = await login()
  const mixedB = await login()
  const mixedLogout = await request('/auth/logout', { token: mixedA.token, cookie: mixedB.cookie, method: 'POST' })
  assert.equal(mixedLogout.status, 200)
  assert.equal(mixedLogout.body.data.revoked, 2)
  assert.equal((await request('/auth/me', mixedA)).status, 401)
  assert.equal((await request('/auth/me', mixedB)).status, 401)
  const legacy = await login()
  const hash = createHash('sha256').update(legacy.cookie.split('=')[1]).digest('hex')
  await em.execute('update refresh_token set session_id=null where token_hash=?', [hash])
  assert.equal((await request('/auth/session', { cookie: legacy.cookie })).body.data.authenticated, true)
  const upgraded = await request('/auth/refresh', { cookie: legacy.cookie, method: 'POST' })
  assert.equal(upgraded.status, 200)
  const upgradedToken = upgraded.body.data.accessToken
  assert.equal((await request('/auth/me', { token: upgradedToken })).status, 200)
  const upgradedId = decode(upgradedToken).sid
  await em.execute("update admin_session set expires_at=now() - interval '1 second' where id=?", [upgradedId])
  assert.equal((await request('/auth/me', { token: upgradedToken })).status, 401)
  assert.equal((await request('/auth/refresh', { cookie: upgraded.cookie, method: 'POST' })).status, 401)
  process.stdout.write(
    '会话集成通过：稳定轮换、最小设备信息、跨账号隔离、单会话/其他会话撤销、退出即时失效、无 Cookie 退出、旧记录升级和会话到期\n',
  )
} finally {
  await fixture.close()
}
