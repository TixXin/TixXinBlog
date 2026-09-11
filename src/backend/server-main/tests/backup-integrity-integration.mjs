/** @file backup-integrity-integration.mjs @description 隔离派生备份验证完成标记续传、清单表集合和实际媒体库存，拒绝伪恢复成功。 */
import assert from 'node:assert/strict'
import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, cp, rename, access, rm } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createBrowserTestApp } from './test-app.mjs'
import { createFullBackup, verifyFullBackup, restoreFullBackup } from '../scripts/full-backup.mjs'
import { createBackupReceiver } from '../scripts/backup-transfer.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const directory = resolve(root, '.artifacts/backup-integrity', randomUUID()),
  work = join(directory, 'work')
assert(work.startsWith(resolve(root, '.artifacts') + sep))
await mkdir(work, { recursive: true })
process.env.NOTIFICATION_EMAIL_ENABLED = 'false'
const fixture = await createBrowserTestApp('http://localhost')
const report = { completed: false, cleanup: false, checks: [] }
const restoredTargets = []
let receiver
try {
  const em = fixture.testOrm.em.fork()
  const session = await fetch(fixture.origin + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  })
  assert.equal(session.status, 200)
  const sessionToken = (await session.json()).data.accessToken
  const image = new FormData()
  image.append('file', new Blob([Buffer.from(fixture.mediaSample, 'base64')], { type: 'image/png' }), 'inventory.png')
  const uploaded = await fetch(fixture.origin + '/api/v1/admin/media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: image,
  })
  assert.equal(uploaded.status, 201)
  await em.execute("update operation_control set external_paused=false,backup_paused=false where id='default'")
  await em.execute(
    "insert into background_task(id,dedupe_key,kind,state,generation,payload,available_at,created_at) select ?,?,'mail','queued',generation,'{}',now(),now() from operation_control where id='default'",
    [randomUUID(), 'inventory-check:' + randomUUID()],
  )
  const source = await createFullBackup({ output: join(work, 'source') })
  assert.equal(source.manifest.media.length, 1)
  const sourceManifestBytes = await readFile(join(source.directory, 'manifest.json'))
  const manifestSha256 = createHash('sha256').update(sourceManifestBytes).digest('hex')
  async function derived(name) {
    const path = join(work, name)
    assert(path.startsWith(work + sep))
    await cp(source.directory, path, { recursive: true, errorOnExist: true, force: false })
    return path
  }
  async function replaceManifest(path, change) {
    const manifest = JSON.parse(sourceManifestBytes.toString())
    change(manifest)
    await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest))
    return manifest
  }
  async function rejectedRestore(path, name, error) {
    let unexpected
    try {
      await assert.rejects(async () => {
        unexpected = await restoreFullBackup(path, { output: join(work, name) })
      }, error)
    } finally {
      await unexpected?.cleanup()
    }
    await assert.rejects(access(join(work, name, 'restore-report.json')))
    await assert.rejects(access(join(work, name, 'connection.json')))
  }

  const ownerId = randomUUID(),
    token = randomBytes(32).toString('hex')
  receiver = await createBackupReceiver({ directory: join(work, 'receiver'), ownerId, token })
  await new Promise((done) => receiver.listen(0, '127.0.0.1', done))
  const endpoint = `http://127.0.0.1:${receiver.address().port}/backups/${ownerId}`
  const complete = (backupId) =>
    fetch(`${endpoint}/${backupId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Manifest-SHA256': manifestSha256 },
    })
  async function staged(changes = {}) {
    const backupId = `${randomUUID()}-1`,
      path = join(work, 'receiver', '.staging', backupId)
    await cp(source.directory, path, { recursive: true, errorOnExist: true, force: false })
    const marker = {
      format: 'tixxin-backup-receiver',
      version: 1,
      ownerId,
      backupId,
      manifestSha256,
      completedAt: '2026-09-11T00:00:00.000Z',
      ...changes,
    }
    const bytes = JSON.stringify(marker)
    await writeFile(join(path, 'receiver-owner.json'), bytes, { flag: 'wx' })
    return { backupId, path, bytes }
  }
  // 精确重建“标记已写入，目录尚未rename”的崩溃现场。
  const resumable = await staged()
  const completed = await complete(resumable.backupId)
  assert.equal(completed.status, 200)
  assert.equal((await completed.json()).verified, true)
  const final = join(work, 'receiver', ownerId, resumable.backupId)
  assert.equal(await readFile(join(final, 'receiver-owner.json'), 'utf8'), resumable.bytes)
  await assert.rejects(access(resumable.path))
  assert.equal((await complete(resumable.backupId)).status, 200)
  report.checks.push('staging_same_marker_resumed_and_final_confirmation_idempotent')
  for (const changes of [
    { ownerId: randomUUID() },
    { backupId: `${randomUUID()}-1` },
    { manifestSha256: 'f'.repeat(64) },
  ]) {
    const invalid = await staged(changes)
    const result = await complete(invalid.backupId)
    assert.equal(result.status, 400)
    assert.equal(await readFile(join(invalid.path, 'receiver-owner.json'), 'utf8'), invalid.bytes)
    await assert.rejects(access(join(work, 'receiver', ownerId, invalid.backupId)))
  }
  report.checks.push('staging_wrong_owner_id_or_digest_rejected_without_overwrite')

  const missingTable = await derived('missing-operation-table')
  await replaceManifest(missingTable, (manifest) => {
    delete manifest.counts.operation_control
  })
  await verifyFullBackup(missingTable)
  await rejectedRestore(missingTable, 'rejected-table', /实际数据表集合与备份清单不一致/)
  report.checks.push('dump_with_omitted_operation_control_rejected_before_safety_or_success_record')

  const noMedia = await derived('missing-media-list')
  await replaceManifest(noMedia, (manifest) => {
    manifest.media = []
  })
  await assert.rejects(verifyFullBackup(noMedia), /媒体清单数量与数据库记录计数不一致/)
  await rejectedRestore(noMedia, 'rejected-media-list', /媒体清单数量与数据库记录计数不一致/)
  report.checks.push('empty_media_manifest_with_nonempty_database_rejected')

  // 清单数量、文件摘要都合法，但所列UUID不是dump里的真实媒体，不能只做文件自洽校验。
  const wrongMedia = await derived('wrong-media-inventory')
  const oldKey = source.manifest.media[0].key,
    replacementId = randomUUID()
  await rename(join(wrongMedia, 'media', oldKey), join(wrongMedia, 'media', `${replacementId}.webp`))
  await replaceManifest(wrongMedia, (manifest) => {
    manifest.media[0].id = replacementId
    manifest.media[0].key = `${replacementId}.webp`
  })
  await verifyFullBackup(wrongMedia)
  await rejectedRestore(wrongMedia, 'rejected-inventory', /实际媒体库存与备份清单不一致/)
  report.checks.push('self_consistent_wrong_media_inventory_rejected_against_restored_database')

  const restored = await restoreFullBackup(source.directory, { output: join(work, 'valid-restored') })
  restoredTargets.push(restored)
  assert.equal(restored.report.tableInventoryVerified, true)
  assert.equal(restored.report.mediaInventoryVerified, true)
  assert.equal(restored.report.operationSafety.externalDeliveryPaused, true)
  assert.equal(restored.report.operationSafety.automaticBackupPaused, true)
  assert.equal(restored.report.operationSafety.generationRotated, true)
  assert(restored.report.operationSafety.recoveryRecordId)
  await access(join(restored.connection.mediaDirectory, source.manifest.media[0].key))
  report.checks.push('valid_current_backup_restored_with_exact_inventory_and_forced_pauses')

  // 合法旧库确实没有运行表；不要求它包含当前代码新加的表，也不把现有表当作“旧版”跳过。
  for (const table of ['background_task', 'owner_notification', 'operation_control'])
    await em.execute(`drop table ${table}`)
  await em.execute("delete from mikro_orm_migrations where name='20260911220000_add_operation_tasks'")
  const legacy = await createFullBackup({ output: join(work, 'legacy-source') })
  const legacyRestored = await restoreFullBackup(legacy.directory, { output: join(work, 'legacy-restored') })
  restoredTargets.push(legacyRestored)
  assert.equal(legacyRestored.report.operationSafety.present, false)
  assert.equal(legacyRestored.report.tableInventoryVerified, true)
  assert.equal(legacyRestored.report.mediaInventoryVerified, true)
  report.checks.push('actual_legacy_schema_without_operation_tables_remains_supported')
  report.completed = true
} finally {
  for (const restored of restoredTargets) await restored.cleanup()
  if (receiver) {
    receiver.closeAllConnections()
    await new Promise((done) => receiver.close(done))
  }
  await fixture.close()
  assert(work.startsWith(directory + sep))
  await rm(work, { recursive: true, force: true })
  report.cleanup = true
  await writeFile(join(directory, 'verification-report.json'), JSON.stringify(report, null, 2) + '\n')
}
process.stdout.write(`备份清单与接收完成恢复验证通过；报告 ${directory}\n`)
