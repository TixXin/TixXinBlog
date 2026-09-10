/** @file development-backup.ts @description 开发数据写入始终完整备份；隔离测试可指定独立保留根目录 */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { createFullBackup } from '../../scripts/full-backup.mjs'

export interface DevelopmentBackupOptions {
  backupRoot?: string
}
export function createDevelopmentBackup(options: DevelopmentBackupOptions) {
  return createFullBackup(options.backupRoot ? { output: join(options.backupRoot, `backup-${randomUUID()}`) } : {})
}
