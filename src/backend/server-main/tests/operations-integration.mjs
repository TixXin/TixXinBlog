/** @file operations-integration.mjs @description 隔离数据库、本机 SMTP 捕获与 TCP 备份接收器验收；仅清理本次资源。 */
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createBrowserTestApp } from './test-app.mjs'
import { createBackupReceiver, transferBackup } from '../scripts/backup-transfer.mjs'
import { verifyFullBackup, restoreFullBackup } from '../scripts/full-backup.mjs'
const require = createRequire(import.meta.url)
const backend = fileURLToPath(new URL('../', import.meta.url))
const verificationRoot = resolve(backend, '../../../.artifacts/operations')
const directory = resolve(verificationRoot, randomUUID()),
  work = join(directory, 'work')
assert(directory.startsWith(verificationRoot + sep))
await mkdir(work, { recursive: true })
process.env.NOTIFICATION_EMAIL_ENABLED = 'false'
const fixture = await createBrowserTestApp('http://localhost')
const { readOperationConfig, operationConfigStatus } = require('../dist/modules/operations/operation-config.js')
const {
  runTaskOnce,
  scheduleBackup,
  setOperationPaused,
  classifyMailError,
} = require('../dist/modules/operations/task-runner.js')
const { recordOwnerEvent } = require('../dist/modules/operations/owner-events.js')
const { cleanWorkerBackups } = require('../dist/modules/operations/worker-backup.js')
const { validateEnv } = require('../dist/config/env.validation.js')
const em = fixture.testOrm.em.fork()
let smtp, receiver, restored
const sockets = new Set(),
  messages = []
let smtpMode = 'accept'
const report = { smtp: {}, backup: {}, cleanup: false }
try {
  smtp = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.write('220 localhost isolated SMTP\r\n')
    let buffer = '',
      data = false,
      message = ''
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'),
          line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (data) {
          if (line !== '.') {
            message += line + '\r\n'
            continue
          }
          data = false
          messages.push(message)
          message = ''
          if (smtpMode === 'unknown') {
            socket.destroy()
            return
          }
          socket.write('250 message accepted\r\n')
          continue
        }
        if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 SIZE 1000000\r\n')
        else if (/^MAIL FROM/.test(line)) socket.write('250 sender accepted\r\n')
        else if (/^RCPT TO/.test(line))
          socket.write(
            smtpMode === 'transient'
              ? '450 temporary recipient failure\r\n'
              : smtpMode === 'permanent'
                ? '550 recipient rejected\r\n'
                : '250 recipient accepted\r\n',
          )
        else if (line === 'DATA') {
          data = true
          socket.write('354 send message\r\n')
        } else if (line === 'QUIT') socket.end('221 bye\r\n')
        else socket.write('250 ok\r\n')
      }
    })
  })
  await new Promise((done) => smtp.listen(0, '127.0.0.1', done))
  const ownerId = randomUUID(),
    token = randomBytes(32).toString('hex')
  receiver = await createBackupReceiver({ directory: join(work, 'remote'), ownerId, token })
  await new Promise((done) => receiver.listen(0, '127.0.0.1', done))
  const env = {
    NOTIFICATION_EMAIL_ENABLED: 'true',
    NOTIFICATION_SMTP_HOST: '127.0.0.1',
    NOTIFICATION_SMTP_PORT: String(smtp.address().port),
    NOTIFICATION_SMTP_ALLOW_LOCAL_PLAIN: 'true',
    NOTIFICATION_EMAIL_FROM: 'blog@example.test',
    NOTIFICATION_EMAIL_TO: 'owner@example.test',
    NOTIFICATION_SITE_URL: 'http://localhost',
    NOTIFICATION_MAIL_INTERVAL_SECONDS: '1',
    BACKUP_SCHEDULE_ENABLED: 'true',
    // 独立验收 PostgreSQL 可使用自有容器，不能把其备份错误地指向日常数据库容器。
    BACKUP_POSTGRES_CONTAINER: process.env.BACKUP_POSTGRES_CONTAINER,
    BACKUP_DIRECTORY: join(work, 'local'),
    BACKUP_OWNER_ID: ownerId,
    BACKUP_TRANSFER_URL: `http://127.0.0.1:${receiver.address().port}/backups`,
    BACKUP_TRANSFER_TOKEN: token,
  }
  const config = readOperationConfig(env)
  assert.equal(operationConfigStatus(config).email.configured, true)
  assert.equal(readOperationConfig({}).workerEnabled, false)
  assert.equal(readOperationConfig({}).email.enabled, false)
  assert(!JSON.stringify(operationConfigStatus(config)).includes(token))
  const validated = validateEnv({ ...process.env, ...env })
  assert.equal(validated.NOTIFICATION_SMTP_PORT, smtp.address().port)
  assert.throws(() => readOperationConfig({ ...env, NOTIFICATION_SMTP_HOST: 'external.example.test' }))
  assert.equal(classifyMailError({ code: 'ECONNECTION' }).state, 'uncertain')
  const control = async () => (await em.execute("select * from operation_control where id='default'"))[0]
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'paused')
  await setOperationPaused(fixture.testOrm, 'mail', false, (await control()).revision)
  await setOperationPaused(fixture.testOrm, 'backup', false, (await control()).revision)
  process.env.NOTIFICATION_EMAIL_ENABLED = 'true'
  const event = async () => {
    const id = await em.transactional(async (transaction) => {
      const [note] = await transaction.execute(
        "insert into guestbook_message (visitor_id_hash,author,avatar,content,status,is_owner,is_pinned,revision,created_at,updated_at) values (?,'访客','/avatar.svg','private-never-mail-body','pending',false,false,0,now(),now()) returning id",
        [randomUUID()],
      )
      await recordOwnerEvent(transaction, 'guestbook', note.id, 'new_guestbook')
      await recordOwnerEvent(transaction, 'guestbook', note.id, 'new_guestbook')
      return note.id
    })
    const [task] = await em.execute(
      "select t.* from background_task t join owner_notification n on n.id::text=t.payload->>'notificationId' where n.kind='guestbook' and n.source_id=?",
      [String(id)],
    )
    return { id, task }
  }
  const resetRate = () => em.execute("update operation_control set last_mail_at=null where id='default'")
  const first = await event()
  const concurrent = await Promise.all([
    runTaskOnce(fixture.testOrm, config, 'mail'),
    runTaskOnce(fixture.testOrm, config, 'mail'),
  ])
  assert(concurrent.some((result) => result.state === 'succeeded'))
  assert(concurrent.some((result) => ['busy', 'rate_limited', 'idle'].includes(result.state)))
  assert.equal(messages.length, 1)
  assert(messages[0].includes(`Message-ID: <tixxin-${first.task.id}@localhost>`))
  assert(!messages[0].includes('private-never-mail-body'))
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'rate_limited')
  const suppressed = await event()
  await em.execute("update guestbook_message set status='hidden' where id=?", [suppressed.id])
  await resetRate()
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'succeeded')
  assert.equal(
    (await em.execute('select result from background_task where id=?', [suppressed.task.id]))[0].result.suppressed,
    true,
  )
  assert.equal(messages.length, 1)
  smtpMode = 'transient'
  const retry = await event()
  for (let attempt = 1; attempt <= 3; attempt++) {
    await resetRate()
    await em.execute('update background_task set available_at=now() where id=?', [retry.task.id])
    assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, attempt === 3 ? 'failed' : 'retry')
  }
  smtpMode = 'permanent'
  await event()
  await resetRate()
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'failed')
  smtpMode = 'unknown'
  const unknown = await event()
  await resetRate()
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'uncertain')
  const countAfterUnknown = messages.length
  await resetRate()
  await runTaskOnce(fixture.testOrm, config, 'mail')
  assert.equal(messages.length, countAfterUnknown)
  const expired = await event()
  await em.execute(
    "update background_task set state='running',lease_token=?,lease_until=now()-interval '1 minute' where id=?",
    [randomUUID(), expired.task.id],
  )
  await resetRate()
  await runTaskOnce(fixture.testOrm, config, 'mail')
  assert.equal(
    (await em.execute('select state from background_task where id=?', [expired.task.id]))[0].state,
    'uncertain',
  )
  // SMTP 已明确接受后，只在完成状态落库这一条语句注入连接错误；后续数据库操作正常。
  smtpMode = 'accept'
  const acceptedBeforeRecording = await event(),
    beforeRecordingMessages = messages.length
  let completionFailures = 0
  const originalFork = fixture.testOrm.em.fork
  fixture.testOrm.em.fork = function (...args) {
    const fork = Reflect.apply(originalFork, this, args)
    const originalExecute = fork.execute.bind(fork)
    fork.execute = async (sql, params, ...rest) => {
      if (
        typeof sql === 'string' &&
        sql.includes("update background_task set state='succeeded'") &&
        params?.[1] === acceptedBeforeRecording.task.id &&
        completionFailures === 0
      ) {
        assert.equal(messages.length, beforeRecordingMessages + 1, '注入必须发生在本机 SMTP 已接受完整邮件之后')
        completionFailures++
        throw Object.assign(new Error('isolated_completion_connection_failure'), {
          code: 'ECONNREFUSED',
          syscall: 'connect',
        })
      }
      return originalExecute(sql, params, ...rest)
    }
    return fork
  }
  try {
    await resetRate()
    const outcome = await runTaskOnce(fixture.testOrm, config, 'mail')
    assert.equal(completionFailures, 1, '必须确实注入一次 succeeded 落库连接错误')
    assert.equal(outcome.state, 'uncertain', '已送达后记录失败不能按 SMTP 连接失败自动重投')
    assert.equal(outcome.errorCode, 'smtp_result_not_recorded')
  } finally {
    fixture.testOrm.em.fork = originalFork
  }
  const recordedUnknown = (
    await em.execute('select state,attempts,result,error_code from background_task where id=?', [
      acceptedBeforeRecording.task.id,
    ])
  )[0]
  assert.equal(recordedUnknown.state, 'uncertain')
  assert.equal(recordedUnknown.result.accepted, true)
  assert.equal(recordedUnknown.attempts, 1)
  await em.execute('update background_task set available_at=now() where id=?', [acceptedBeforeRecording.task.id])
  await resetRate()
  await runTaskOnce(fixture.testOrm, config, 'mail')
  assert.equal(messages.length, beforeRecordingMessages + 1, '即使到期也不得自动再次投递这封已被接受的邮件')
  assert.equal(
    (await em.execute('select attempts from background_task where id=?', [acceptedBeforeRecording.task.id]))[0]
      .attempts,
    1,
  )
  smtpMode = 'unknown'
  report.smtp = {
    interactionCaptured: messages.length,
    deduplicated: true,
    limitedRetries: 3,
    unknownNotRetried: true,
    expiredLeaseUncertain: true,
    staleSuppressed: true,
    acceptedCompletionFailureInjected: completionFailures,
    acceptedCompletionFailureNotRetried: true,
  }

  const scheduled = await Promise.all([
    scheduleBackup(fixture.testOrm, config),
    scheduleBackup(fixture.testOrm, config),
  ])
  assert.equal(scheduled.filter((item) => item.state === 'queued').length, 1)
  const outcome = await runTaskOnce(fixture.testOrm, config, 'backup')
  assert.equal(outcome.state, 'succeeded', `备份执行状态：${outcome.state}，错误分类：${outcome.errorCode ?? 'none'}`)
  const source = join(config.backup.directory, `backup-${outcome.taskId}-1`)
  const checked = await verifyFullBackup(source)
  assert(checked.manifest.counts.owner_notification > 0)
  const remote = join(work, 'remote', ownerId, `${outcome.taskId}-1`)
  assert.equal((await verifyFullBackup(remote)).manifest.database.sha256, checked.manifest.database.sha256)
  assert.equal(
    (await transferBackup(source, { url: env.BACKUP_TRANSFER_URL, token, ownerId, taskId: `${outcome.taskId}-1` }))
      .verified,
    true,
  )
  await assert.rejects(
    transferBackup(source, {
      url: env.BACKUP_TRANSFER_URL,
      token: 'x'.repeat(32),
      ownerId,
      taskId: `${outcome.taskId}-1`,
    }),
  )
  const corruptId = `${randomUUID()}-1`
  const corrupt = await fetch(`${env.BACKUP_TRANSFER_URL}/${ownerId}/${corruptId}/database.dump`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Length': '4',
      'X-Content-SHA256': createHash('sha256').update('good').digest('hex'),
    },
    body: 'evil',
  })
  assert.equal(corrupt.status, 400)
  const historicalId = randomUUID(),
    historical = join(config.backup.directory, `backup-${historicalId}-1`)
  await mkdir(historical)
  await writeFile(
    join(historical, 'worker-owner.json'),
    JSON.stringify({
      format: 'tixxin-worker-backup',
      version: 1,
      ownerId,
      taskId: historicalId,
      createdAt: '2000-01-01T00:00:00Z',
    }),
  )
  const legacy = join(config.backup.directory, 'existing-user-history')
  await mkdir(legacy)
  assert.equal(await cleanWorkerBackups(config.backup.directory, ownerId, 30), 1)
  await access(legacy)
  const failingBackup = await scheduleBackup(fixture.testOrm, config, new Date(Date.now() + 86400_000))
  assert(failingBackup.taskId)
  await em.execute('update background_task set available_at=now() where id=?', [failingBackup.taskId])
  const failedTransfer = await runTaskOnce(
    fixture.testOrm,
    { ...config, backup: { ...config.backup, transferToken: 'z'.repeat(32) } },
    'backup',
  )
  assert.equal(failedTransfer.errorCode, 'backup_transfer_failed')
  const [failedTask] = await em.execute('select result from background_task where id=?', [failingBackup.taskId])
  assert.equal(failedTask.result.generated, true)
  assert.equal(failedTask.result.integrityVerified, true)
  assert.equal(failedTask.result.transfer.verified, false)
  smtpMode = 'accept'
  const beforeBackupFailureMail = messages.length
  await resetRate()
  assert.equal((await runTaskOnce(fixture.testOrm, config, 'mail')).state, 'succeeded')
  assert.equal(messages.length, beforeBackupFailureMail + 1)
  report.smtp.backupFailureMail = true
  report.smtp.backupFailureCaptured = messages.length - beforeBackupFailureMail
  await event()
  const restoring = await scheduleBackup(fixture.testOrm, config, new Date(Date.now() + 2 * 86400_000))
  if (restoring.taskId)
    await em.execute(
      "update background_task set state='running',lease_token=?,lease_until=now()+interval '1 minute' where id=?",
      [randomUUID(), restoring.taskId],
    )
  const { createFullBackup } = await import('../scripts/full-backup.mjs')
  const restoreSource = await createFullBackup({ output: join(work, 'restore-source') })
  restored = await restoreFullBackup(restoreSource.directory, { output: join(work, 'restored') })
  assert.equal(restored.report.operationSafety.externalDeliveryPaused, true)
  assert.equal(restored.report.operationSafety.automaticBackupPaused, true)
  assert(restored.report.operationSafety.restoredMailTasks > 0)
  assert.equal(restored.report.operationSafety.interruptedBackupTasks, 1)
  assert.equal(restored.report.operationSafety.generationRotated, true)
  assert(restored.report.operationSafety.recoveryRecordId)
  const { spawnSync } = await import('node:child_process')
  const restoredState = spawnSync(
    'docker',
    [
      'exec',
      '-e',
      'PGPASSWORD',
      restored.connection.container,
      'psql',
      '-U',
      'tixxin_restore',
      '-d',
      'tixxin_restore',
      '-At',
      '-c',
      "select external_paused and backup_paused and generation<>'" +
        (await control()).generation +
        "'::uuid from operation_control; select count(*) from background_task where kind='mail' and state in ('queued','retry','running'); select count(*) from background_task where result->>'recoveryVerified'='true';",
    ],
    {
      windowsHide: true,
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: decodeURIComponent(new URL(restored.connection.databaseUrl).password) },
    },
  )
  assert.equal(restoredState.status, 0)
  assert.deepEqual(restoredState.stdout.trim().split(/\r?\n/), ['t', '0', '1'])
  report.backup = {
    consistent: true,
    remoteVerified: true,
    idempotentTransfer: true,
    wrongTokenRejected: true,
    checksumRejected: true,
    ownedRetention: true,
    restoredPaused: true,
    operationSafety: restored.report.operationSafety,
  }
} finally {
  if (restored) await restored.cleanup()
  for (const socket of sockets) socket.destroy()
  if (smtp) await new Promise((done) => smtp.close(done))
  if (receiver) {
    receiver.closeAllConnections()
    await new Promise((done) => receiver.close(done))
  }
  await fixture.close()
  assert(work.startsWith(directory + sep))
  await rm(work, { recursive: true, force: true })
  report.cleanup = true
  await writeFile(join(directory, 'verification-report.json'), JSON.stringify(report, null, 2))
}
process.stdout.write(`隔离运行任务、SMTP捕获、备份传输与恢复验证通过；报告 ${directory}\n`)
