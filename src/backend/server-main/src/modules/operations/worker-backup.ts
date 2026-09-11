/** @file worker-backup.ts @description 完整备份执行、校验与自有目录保留；不扫描或清理用户历史备份 */
import { access, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { resolve, join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { OperationConfig } from './operation-config'
const scripts = resolve(__dirname, '../../../scripts')
interface Marker {
  format: 'tixxin-worker-backup'
  version: 1
  ownerId: string
  taskId: string
  createdAt: string
}
export async function cleanWorkerBackups(directory: string, ownerId: string, retentionDays: number, now = Date.now()) {
  const root = await realpath(directory)
  let removed = 0
  for (const name of await readdir(root)) {
    if (!/^backup-[a-f0-9-]{36}-[1-9][0-9]*$/.test(name)) continue
    const target = resolve(root, name)
    if (!target.startsWith(root + sep)) continue
    try {
      const stat = await lstat(target)
      if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(target)) !== target) continue
      const markerPath = join(target, 'worker-owner.json')
      if ((await lstat(markerPath)).isSymbolicLink()) continue
      const marker = JSON.parse(await readFile(markerPath, 'utf8')) as Marker
      if (
        marker.format !== 'tixxin-worker-backup' ||
        marker.version !== 1 ||
        marker.ownerId !== ownerId ||
        !name.startsWith(`backup-${marker.taskId}-`)
      )
        continue
      const age = now - Date.parse(marker.createdAt)
      if (!Number.isFinite(age) || age < retentionDays * 86400_000) continue
      // 目录内任何符号链接都拒绝自动清理，避免把链接目标当作归属资源。
      const children = await readdir(target, { recursive: true, withFileTypes: true })
      if (children.some((entry) => entry.isSymbolicLink())) continue
      await rm(target, { recursive: true })
      removed++
    } catch {
      /* 未知、不完整或不可访问目录保留，不能扩大清理范围。 */
    }
  }
  return removed
}
export async function performWorkerBackup(config: OperationConfig, taskId: string, attempt: number) {
  await mkdir(config.backup.directory, { recursive: true, mode: 0o700 })
  const root = await realpath(config.backup.directory)
  if ((await lstat(config.backup.directory)).isSymbolicLink()) throw new Error('备份根目录不能是符号链接')
  const output = resolve(root, `backup-${taskId}-${attempt}`)
  if (!output.startsWith(root + sep)) throw new Error('备份目录越界')
  try {
    await access(output)
    throw Object.assign(new Error('本次备份目录已存在'), { operationCode: 'backup_destination_exists' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const { createFullBackup, verifyFullBackup } = await import(pathToFileURL(join(scripts, 'full-backup.mjs')).href)
  let result
  try {
    result = await createFullBackup({ output, mode: config.backup.mode, container: config.backup.container })
  } finally {
    try {
      if ((await realpath(output)) === output && !(await lstat(output)).isSymbolicLink()) {
        const marker: Marker = {
          format: 'tixxin-worker-backup',
          version: 1,
          ownerId: config.backup.ownerId,
          taskId,
          createdAt: new Date().toISOString(),
        }
        await writeFile(join(output, 'worker-owner.json'), JSON.stringify(marker), { flag: 'wx', mode: 0o600 })
      }
    } catch {
      /* 未完成目录保持原样；没有可信归属标记的目录不会自动清理。 */
    }
  }
  await verifyFullBackup(output)
  let transfer: Record<string, unknown> = { configured: false, verified: false }
  if (config.backup.transferUrl) {
    try {
      const { transferBackup } = await import(pathToFileURL(join(scripts, 'backup-transfer.mjs')).href)
      transfer = {
        configured: true,
        ...(await transferBackup(output, {
          url: config.backup.transferUrl,
          token: config.backup.transferToken,
          ownerId: config.backup.ownerId,
          taskId: `${taskId}-${attempt}`,
        })),
      }
    } catch {
      throw Object.assign(new Error('备份传输未通过校验'), {
        operationCode: 'backup_transfer_failed',
        operationResult: {
          generated: true,
          integrityVerified: true,
          transfer: { configured: true, verified: false },
          backupId: `${taskId}-${attempt}`,
        },
      })
    }
  }
  const removed = await cleanWorkerBackups(root, config.backup.ownerId, config.backup.retentionDays)
  return {
    generated: true,
    integrityVerified: true,
    manifestVersion: result.manifest.version,
    databaseBytes: result.manifest.database.bytes,
    mediaFiles: result.manifest.media.length,
    snapshotAt: result.manifest.snapshotAt,
    transfer,
    retainedCleanupCount: removed,
    backupId: `${taskId}-${attempt}`,
  }
}
