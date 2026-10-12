/** @file terminal.test.mjs @description 可见终端命令在实际 shell 下的路径转义及配置边界回归 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { terminalCommand } from './terminal.mjs'

test('含空格、引号及 shell 替换字符的路径保持字面值，执行完整链路参数', { skip: process.platform === 'win32' }, (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tixxin-terminal-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const root = join(directory, '博客 \' " `false` $(false)')
  mkdirSync(join(root, 'scripts'), { recursive: true })
  writeFileSync(
    join(root, 'scripts/dev.mjs'),
    'console.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2), pnpm: process.env.npm_execpath, path: process.env.PATH }))',
  )
  const pnpm = join(root, 'pnpm.js')
  const path = '/usr/bin:/bin:' + root
  const command = terminalCommand({ root, node: process.execPath, pnpm, path, secret: 'never-forward-this-secret' })
  const output = execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' })
  const result = JSON.parse(output.trim().split('\n').at(-1))
  // macOS 临时目录可能经 /var 符号链接解析，使用实际 cwd 对照。
  const expected = execFileSync(process.execPath, ['-p', 'process.cwd()'], { cwd: root, encoding: 'utf8' }).trim()
  assert.deepEqual(result, { cwd: expected, args: ['all', '--logs'], pnpm, path })
  assert(!command.includes('never-forward-this-secret'))
})
