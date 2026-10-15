/** @file config.test.mjs @description 环境优先级与凭据脱敏回归 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readEnvironment, readConfig, redact, databaseFingerprint } from './config.mjs'

test('后端环境优先级为进程、本地、通用；不污染进程环境', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tixxin-dev-env-'))
  try {
    writeFileSync(join(directory, '.env.local'), 'DEV_SAMPLE=local\nLOCAL_ONLY=from-local\n')
    writeFileSync(join(directory, '.env'), 'DEV_SAMPLE=default\nLOCAL_ONLY=default\nDEFAULT_ONLY=default\n')
    assert.deepEqual(readEnvironment(directory, ['.env.local', '.env'], { DEV_SAMPLE: 'process' }), {
      DEV_SAMPLE: 'process',
      LOCAL_ONLY: 'from-local',
      DEFAULT_ONLY: 'default',
    })
    assert.equal(process.env.LOCAL_ONLY, undefined)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('日志隐藏原始及编码凭据，数据库身份与密码无关', () => {
  const url = 'postgres://tester:sensitive-password@127.0.0.1:15433/sample'
  const text = redact(url + ' abc-secret ' + encodeURIComponent(url), { DATABASE_URL: url, JWT_SECRET: 'abc-secret' })
  assert(!text.includes('sensitive-password'))
  assert(!text.includes('abc-secret'))
  assert.equal(databaseFingerprint(url), databaseFingerprint(url.replace('sensitive-password', 'changed')))
  assert.notEqual(databaseFingerprint(url), databaseFingerprint(url.replace('/sample', '/other')))
})

function fixtureConfig(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tixxin-dev-ports-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'tixxinblog', packageManager: 'pnpm@9.15.0' }))
  const api = join(root, 'src/backend/server-main'),
    web = join(root, 'src/frontend/web-blog')
  mkdirSync(join(api, 'node_modules/@nestjs/cli/bin'), { recursive: true })
  mkdirSync(join(web, 'node_modules/nuxt/bin'), { recursive: true })
  writeFileSync(join(api, 'node_modules/@nestjs/cli/bin/nest.js'), '')
  writeFileSync(join(web, 'node_modules/nuxt/bin/nuxt.mjs'), '')
  const pnpm = join(root, 'pnpm.js')
  writeFileSync(pnpm, '')
  const inherited = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://dev:fixture-only@127.0.0.1:5433/tixxin_fixture',
    JWT_ACCESS_SECRET: 'fixture-secret-with-at-least-32-characters',
    NUXT_API_BASE_URL: 'http://127.0.0.1:3457/api/v1',
    npm_execpath: pnpm,
    ...overrides,
  }
  return () => readConfig(root, inherited)
}

test('开发默认端口隔离：前端3456、API3457，数据库仍读取显式5433目标', (t) => {
  const config = fixtureConfig(t)()
  assert.equal(config.web.port, 3456)
  assert.equal(config.api.port, 3457)
  assert.equal(config.api.origin, 'http://127.0.0.1:3457')
  assert.equal(config.web.env.NUXT_API_BASE_URL, config.api.origin + '/api/v1')
  assert.equal(config.database.port, '5433')
})

test('显式端口覆盖必须与同源代理配对，不能沿用旧3000代理', (t) => {
  const config = fixtureConfig(t, {
    PORT: '3487',
    NUXT_PORT: '3486',
    NUXT_API_BASE_URL: 'http://127.0.0.1:3487/api/v1',
  })()
  assert.equal(config.api.port, 3487)
  assert.equal(config.web.port, 3486)
  assert.throws(fixtureConfig(t, { NUXT_API_BASE_URL: 'http://127.0.0.1:3000/api/v1' }), /需要指向本机后端端口/)
  assert.throws(fixtureConfig(t, { PORT: '3456', NUXT_API_BASE_URL: 'http://127.0.0.1:3456/api/v1' }), /互不相同/)
})
