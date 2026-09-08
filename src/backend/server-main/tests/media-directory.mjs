/**
 * @file media-directory.mjs
 * @description 测试媒体专用临时目录；清理前验证真实绝对路径及父目录，禁止指向开发资源。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
export function createMediaTestDirectory() {
  const root = realpathSync(tmpdir())
  const directory = mkdtempSync(join(root, 'tixxin-media-test-'))
  return {
    directory,
    cleanup() {
      if (!existsSync(directory)) return
      const target = realpathSync(directory)
      assert.equal(dirname(target), root)
      assert(basename(target).startsWith('tixxin-media-test-'))
      rmSync(target, { recursive: true, force: true })
    },
  }
}
