/** @file fixture-backup-directory.mjs @description 隔离数据测试的备份与失败半备份均留在本次专用目录，退出时核对绝对路径后清理 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function createFixtureBackupDirectory() {
  const configured = fileURLToPath(new URL('../../../../.artifacts/database-fixtures/', import.meta.url))
  mkdirSync(configured, { recursive: true })
  const root = realpathSync(configured)
  const directory = mkdtempSync(join(root, 'run-'))
  return {
    directory,
    cleanup() {
      if (!existsSync(directory)) return
      const target = realpathSync(directory)
      assert.equal(dirname(target), root)
      assert(basename(target).startsWith('run-'))
      rmSync(target, { recursive: true, force: true })
      assert.equal(existsSync(target), false)
    },
  }
}
