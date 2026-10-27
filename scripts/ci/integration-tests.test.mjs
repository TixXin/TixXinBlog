/** @file integration-tests.test.mjs @description 集成测试挑选：清单与 CI 一致、按模块和别名匹配、公共代码退到通用测试 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { integrationTests, selectIntegrationTests } from './integration-tests.mjs'

const backend = 'src/backend/server-main/'
const available = integrationTests(
  JSON.parse(readFileSync(new URL(`../../${backend}package.json`, import.meta.url), 'utf8')).scripts[
    'test:integration'
  ],
)
const select = (...files) => selectIntegrationTests(files, available)

test('清单取自 test:integration，排除构建与端口单测', () => {
  assert.ok(available.length > 20)
  assert.equal(available[0], 'integration.mjs')
  assert.ok(available.every((name) => /^[\w-]+\.mjs$/.test(name)))
  assert.ok(!available.includes('http-test-port.test.mjs'))
})

test('模块改动选中以模块名开头的测试，按 CI 顺序输出', () => {
  assert.deepEqual(select(`${backend}src/modules/link/link.service.ts`).tests, [
    'link-integration.mjs',
    'link-backup-integration.mjs',
  ])
  assert.deepEqual(select(`${backend}src/modules/gallery/gallery.dto.ts`).tests, [
    'gallery-integration.mjs',
    'gallery-external-integration.mjs',
  ])
})

test('名字不对应的模块走别名，内容包改动覆盖各领域备份测试', () => {
  assert.deepEqual(select(`${backend}src/modules/operations/notification-targets.ts`).tests, [
    'notifications-integration.mjs',
  ])
  const backup = select(`${backend}src/modules/backup/content-import.service.ts`).tests
  for (const name of ['backup-integration.mjs', 'link-backup-integration.mjs', 'unicode-content-integration.mjs'])
    assert.ok(backup.includes(name), name)
  assert.ok(!backup.includes('link-integration.mjs'))
})

test('改动测试本身时只跑该测试；测试辅助或公共代码退到通用测试并提示', () => {
  assert.deepEqual(select(`${backend}tests/link-integration.mjs`), { tests: ['link-integration.mjs'], notes: [] })
  for (const file of [`${backend}tests/test-app.mjs`, `${backend}src/entities/friend-link.entity.ts`]) {
    const result = select(file)
    assert.deepEqual(result.tests, ['integration.mjs'])
    assert.equal(result.notes.length, 1)
  }
})

test('与后端接口无关的改动不选测试，--all 选中全部', () => {
  assert.deepEqual(select('src/frontend/web-blog/app/pages/links.vue', `${backend}src/seeders/link-fixtures.ts`), {
    tests: [],
    notes: [],
  })
  assert.deepEqual(selectIntegrationTests([], available, { all: true }).tests, available)
})
