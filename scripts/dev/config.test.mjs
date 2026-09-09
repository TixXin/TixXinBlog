/** @file config.test.mjs @description 环境优先级与凭据脱敏回归 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readEnvironment, redact, databaseFingerprint } from './config.mjs'

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
