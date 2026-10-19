/**
 * @file setup-integration.mjs
 * @description 浏览器初始化向导真实数据库验收：令牌错误、并发提交只成功一次、审计与站点资料写入、完成后接口关闭
 */
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createBrowserTestApp } from './test-app.mjs'

const fixture = await createBrowserTestApp('http://localhost', { setupWizard: true })
try {
  assert.match(fixture.setupToken, /^[a-f0-9]{64}$/)
  async function request(path, { method = 'GET', body, language } = {}) {
    const response = await fetch(`${fixture.origin}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(language ? { 'Accept-Language': language } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json(), headers: response.headers }
  }
  const submit = (body, language) => request('/setup', { method: 'POST', body, language })
  const valid = {
    token: fixture.setupToken,
    username: 'first-owner',
    password: 'integration-password-1',
    siteName: '夜读札记',
    locale: 'en',
  }

  assert.deepEqual((await request('/setup/status')).body.data, { needsSetup: true })
  const wrong = await submit({ ...valid, token: 'f'.repeat(64) }, 'en')
  assert.equal(wrong.status, 403)
  assert.equal(wrong.body.message, 'The setup token is invalid. Check the link printed when installation finished.')
  assert.equal(wrong.headers.get('referrer-policy'), 'no-referrer')
  const short = await submit({ ...valid, password: 'short' })
  assert.equal(short.status, 400)
  assert.equal(short.body.message, '密码至少需要 12 个字符')
  // 测试环境的 setup 窗口为 1 秒；等待窗口重置，避免并发验收被前面的请求限流。
  await delay(1100)

  // 并发两次：表锁保证只有一次成功，另一次返回 409。
  const results = await Promise.all([submit(valid), submit({ ...valid, username: 'second-owner' }, 'en')])
  const statuses = results.map((result) => result.status).sort()
  assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((result) => result.body)))
  const conflict = results.find((result) => result.status === 409)
  assert.equal(conflict.body.code, 40)
  const em = fixture.testOrm.em.fork()
  const admins = await em.execute('select username from admin_user')
  assert.equal(admins.length, 1)
  const winner = admins[0].username
  assert(['first-owner', 'second-owner'].includes(winner))
  const audits = await em.execute(
    `select actor_name, state, resource_type, summary from audit_entry where action = 'setup.complete'`,
  )
  assert.equal(audits.length, 1)
  assert.equal(audits[0].actor_name, winner)
  assert.equal(audits[0].state, 'success')
  assert(!JSON.stringify(audits).includes(fixture.setupToken))
  const [settings] = await em.execute(`select revision, "values" from site_settings where id = 'default'`)
  assert.equal(settings.revision, 1)
  assert.equal(settings.values.name, '夜读札记')
  assert.equal(settings.values.ownerName, 'Blogger')
  const [revision] = await em.execute('select reason from site_settings_revision where revision = 1')
  assert.equal(revision.reason, '初始化向导设置站点资料')

  // 完成后：status 为 false，任何提交（含正确令牌、错误参数）都与不存在的路由一样返回 404。
  assert.deepEqual((await request('/setup/status')).body.data, { needsSetup: false })
  await delay(1100)
  for (const body of [valid, { nonsense: true }]) {
    const closed = await submit(body, 'en')
    assert.equal(closed.status, 404)
    assert.equal(closed.body.message, 'Cannot POST /api/v1/setup')
  }
  const missing = await request('/setup-unknown', { method: 'POST', body: {} })
  assert.equal(missing.status, 404)

  // 新账号可以正常登录。
  const login = await request('/auth/login', {
    method: 'POST',
    body: { username: winner, password: valid.password },
  })
  assert.equal(login.status, 200)

  // 限流：同一地址在窗口内超过 5 次返回 429。
  await delay(1100)
  const burst = []
  for (let index = 0; index < 6; index += 1) burst.push((await submit(valid)).status)
  assert.deepEqual(burst, [404, 404, 404, 404, 404, 429])
  console.log('初始化向导集成验收通过')
} finally {
  await fixture.close()
}
