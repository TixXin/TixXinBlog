/** @file manual-backup-record-integration.mjs @description 手动完整备份显式登记、提交后响应丢失去重和失败保留产物；仅使用隔离库。 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createBrowserTestApp } from './test-app.mjs'
import { createFullBackup, verifyFullBackup } from '../scripts/full-backup.mjs'
const execute = promisify(execFile)
const backend = fileURLToPath(new URL('../', import.meta.url))
const directory = resolve(backend, '../../../.artifacts/manual-backup-record', randomUUID()),
  work = join(directory, 'work')
assert(work.startsWith(resolve(backend, '../../../.artifacts') + sep))
await mkdir(work, { recursive: true })
process.env.NOTIFICATION_EMAIL_ENABLED = 'false'
const fixture = await createBrowserTestApp('http://localhost')
const report = { completed: false, cleanup: false, checks: [] }
try {
  const em = fixture.testOrm.em.fork()
  const count = async () => (await em.execute('select count(*)::int as count from background_task'))[0].count
  const controls = async () => (await em.execute("select * from operation_control where id='default'"))[0]
  const originalControl = await controls()
  assert.equal(originalControl.external_paused, true)
  assert.equal(originalControl.backup_paused, true)
  const ordinary = await createFullBackup({ output: join(work, 'ordinary') })
  assert.equal(ordinary.operationRecord, undefined)
  assert.equal(await count(), 0, '原函数默认不附加运行记录')
  report.checks.push('default_direct_call_does_not_register')

  const manual = await createFullBackup({ output: join(work, 'manual'), recordOperation: true })
  assert.equal(manual.operationRecord.recorded, true)
  assert.equal(await count(), 1)
  const [task] = await em.execute('select * from background_task where id=?', [manual.operationRecord.taskId])
  assert.equal(task.kind, 'backup')
  assert.equal(task.state, 'succeeded')
  assert.equal(task.result.generated, true)
  assert.equal(task.result.integrityVerified, true)
  assert.equal(task.result.manual, true)
  assert.equal(task.result.directory, manual.directory)
  assert(task.dedupe_key.startsWith('manual-backup:'))
  assert.equal(manual.manifest.counts.background_task, 0, '本次登记发生在已完成快照之后')
  assert.deepEqual(await controls(), originalControl, '手动登记不改变暂停、代次、限频或控制版本')
  const session = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(session.status, 200)
  const token = (await session.json()).data.accessToken
  const response = await fetch(fixture.origin + '/api/v1/admin/operations/tasks/' + task.id, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(response.status, 200)
  const visible = await response.json()
  assert.equal(visible.data.outcome.integrityVerified, true)
  assert(
    !JSON.stringify(visible).includes(JSON.stringify(manual.directory).slice(1, -1)),
    '私有磁盘位置不进入管理API投影',
  )
  report.checks.push('explicit_registration_visible_without_private_path_or_control_changes')

  async function withFault(handler, work) {
    const prototype = Object.getPrototypeOf(fixture.testOrm.em)
    const original = prototype.execute,
      own = Object.hasOwn(prototype, 'execute')
    prototype.execute = async function (sql, params, ...rest) {
      const invoke = () => Reflect.apply(original, this, [sql, params, ...rest])
      return typeof sql === 'string' &&
        /insert into background_task/.test(sql) &&
        String(params?.[1]).startsWith('manual-backup:')
        ? handler(invoke)
        : invoke()
    }
    try {
      return await work()
    } finally {
      if (own) prototype.execute = original
      else delete prototype.execute
    }
  }
  let insertedId,
    afterCommitFailures = 0,
    insertAttempts = 0
  const acknowledged = await withFault(
    async (invoke) => {
      insertAttempts++
      const rows = await invoke()
      if (afterCommitFailures === 0) {
        assert.equal(rows.length, 1, '必须先真实提交登记，随后才模拟响应丢失')
        insertedId = rows[0].id
        afterCommitFailures++
        throw new Error('isolated_record_response_lost')
      }
      return rows
    },
    () => createFullBackup({ output: join(work, 'ack-lost'), recordOperation: true }),
  )
  assert.equal(afterCommitFailures, 1)
  assert.equal(insertAttempts, 2)
  assert.equal(acknowledged.operationRecord.recorded, true)
  assert.equal(acknowledged.operationRecord.taskId, insertedId)
  assert.equal(await count(), 2, '登记响应丢失后的重试只保留一条运行记录')
  report.checks.push('committed_record_response_lost_retried_without_duplicate')

  let failures = 0
  const retained = await withFault(
    () => {
      failures++
      throw new Error('private-database-error-must-not-be-returned')
    },
    () => createFullBackup({ output: join(work, 'record-failed'), recordOperation: true }),
  )
  assert.equal(failures, 2)
  assert.deepEqual(retained.operationRecord, { recorded: false, errorCode: 'operation_record_failed' })
  assert.equal(await count(), 2)
  await verifyFullBackup(retained.directory)
  assert(!JSON.stringify(retained).includes('private-database-error'))
  report.checks.push('record_failure_returns_fixed_code_and_preserves_verified_backup')

  const cliPath = join(work, 'cli')
  const cli = await execute(
    process.execPath,
    [join(backend, 'scripts/full-backup.mjs'), 'create', '--output', cliPath],
    { cwd: backend, env: { ...process.env }, windowsHide: true },
  )
  assert(cli.stdout.includes('运行工作台已登记本次手动备份'))
  assert.equal(await count(), 3)
  await verifyFullBackup(cliPath)
  assert.deepEqual(await controls(), originalControl)
  assert.equal((await em.execute("select count(*)::int as count from background_task where kind='mail'"))[0].count, 0)
  report.checks.push('official_cli_registers_without_enabling_or_enqueuing_external_tasks')

  for (const table of ['background_task', 'owner_notification', 'operation_control'])
    await em.execute(`drop table ${table}`)
  const old = await createFullBackup({ output: join(work, 'old-schema'), recordOperation: true })
  assert.deepEqual(old.operationRecord, { recorded: false, errorCode: 'operation_tables_missing' })
  await verifyFullBackup(old.directory)
  assert.equal((await em.execute("select to_regclass('public.background_task') as tasks"))[0].tasks, null)
  const oldCli = await execute(
    process.execPath,
    [join(backend, 'scripts/full-backup.mjs'), 'create', '--output', join(work, 'old-cli')],
    { cwd: backend, env: { ...process.env }, windowsHide: true },
  )
  assert(oldCli.stdout.includes('完整备份已生成'))
  assert(oldCli.stdout.includes('未确认登记（operation_tables_missing）'))
  await verifyFullBackup(join(work, 'old-cli'))
  report.checks.push('old_schema_returns_explicit_unregistered_status_without_migration')
  report.completed = true
} finally {
  await fixture.close()
  assert(work.startsWith(directory + sep))
  await rm(work, { recursive: true, force: true })
  report.cleanup = true
  await writeFile(join(directory, 'verification-report.json'), JSON.stringify(report, null, 2) + '\n')
}
process.stdout.write(`手动备份运行登记隔离验证通过；报告 ${directory}\n`)
