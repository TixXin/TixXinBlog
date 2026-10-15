/** @file menu.test.mjs @description 数据管理菜单的命令拼装与确认约束回归，不连接数据库 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commandFor, describe, findEntry, withConfirmation, ENTRIES } from './menu.mjs'

test('只读条目直接拼装既有命令，可选参数缺省时不出现空参数', () => {
  assert.deepEqual(commandFor('status').args, ['status'])
  assert.deepEqual(commandFor('check-domain', { domain: 'subscriptions' }).args, [
    'check-data',
    '--domain',
    'subscriptions',
  ])
  assert.deepEqual(commandFor('check-domain', { domain: 'links', search: '示例' }).args, [
    'check-data',
    '--domain',
    'links',
    '--search',
    '示例',
  ])
  assert.equal(commandFor('status').write, false)
  assert.equal(describe(commandFor('check-data')), 'corepack pnpm --filter server-main run db:dev check-data')
})

test('缺少必填项或传入无关参数时不拼装半成品命令', () => {
  assert.throws(() => commandFor('check-domain'), /需要提供 domain/)
  assert.throws(() => commandFor('seed-dataset', { dataset: '  ' }), /需要提供 dataset/)
  assert.throws(() => commandFor('status', { dataset: 'core-v1' }), /不接受 dataset/)
  assert.throws(() => commandFor('unknown-entry'), /未知的数据管理条目/)
})

test('写入条目必须经确认补齐 --apply --confirm，只读条目不接受确认', () => {
  const command = commandFor('seed-dataset', { dataset: 'subscription-v1' })
  assert.equal(command.write, true)
  assert.deepEqual(withConfirmation(command, 'tixxinblog_dev').args, [
    'seed-data',
    '--dataset',
    'subscription-v1',
    '--apply',
    '--confirm',
    'tixxinblog_dev',
  ])
  assert.throws(() => withConfirmation(commandFor('status'), 'tixxinblog_dev'), /只读命令/)
  assert.throws(() => withConfirmation(command, '  '), /需要输入目标数据库名/)
})

test('破坏性条目保持标记，备份条目走各自脚本', () => {
  assert.deepEqual(
    ENTRIES.filter((entry) => entry.danger).map((entry) => entry.id),
    ['clear-content', 'reset'],
  )
  for (const entry of ENTRIES.filter((item) => item.danger)) assert.equal(findEntry(entry.id).write, true)
  assert.equal(commandFor('backup-create').script, 'backup:full')
  assert.deepEqual(commandFor('backup-verify', { directory: '.artifacts/backup/2026-10-16' }).args, [
    '--directory',
    '.artifacts/backup/2026-10-16',
  ])
  assert.equal(commandFor('seed-all').script, 'db:dev')
})
