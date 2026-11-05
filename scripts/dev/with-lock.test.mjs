/** @file with-lock.test.mjs @description 本机互斥锁回归：排队互斥、过期锁接管、同名重入、退出码与锁释放 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'with-lock.mjs')

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'tixxin-lock-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  // CI=true 时脚本不加锁；这里显式清空，确保在 CI 上也验证真实加锁行为
  const env = { ...process.env, TIXXIN_LOCK_DIR: dir, CI: '', TIXXIN_LOCKS_HELD: '' }
  return { dir, env }
}

function run(args, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('exit', (code) => done({ code, stderr }))
  })
}

// 子命令：记录开始时间，停留一段时间，再记录结束时间
function recorder(log, tag, ms) {
  const body = `const fs=require('fs');fs.appendFileSync(${JSON.stringify(log)},'start ${tag} '+Date.now()+'\\n');setTimeout(()=>fs.appendFileSync(${JSON.stringify(log)},'end ${tag} '+Date.now()+'\\n'),${ms})`
  return [process.execPath, '-e', body]
}

test('同名锁串行执行，两段命令的运行区间不重叠', async (t) => {
  const { dir, env } = setup(t)
  const log = join(dir, 'events.log')
  const results = await Promise.all([
    run(['build', '--', ...recorder(log, 'a', 600)], env),
    run(['build', '--', ...recorder(log, 'b', 600)], env),
  ])
  assert.deepEqual(
    results.map((r) => r.code),
    [0, 0],
  )
  const events = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split(' ')[0])
  assert.deepEqual(events, ['start', 'end', 'start', 'end'])
  assert.match(results.map((r) => r.stderr).join(''), /锁被占用/)
  assert.equal(existsSync(join(dir, 'build.lock')), false)
})

test('不同名的锁互不阻塞', async (t) => {
  const { dir, env } = setup(t)
  const log = join(dir, 'events.log')
  await Promise.all([
    run(['build', '--', ...recorder(log, 'a', 800)], env),
    run(['push', '--', ...recorder(log, 'b', 800)], env),
  ])
  const events = readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split(' ')[0])
  assert.deepEqual(events.slice(0, 2), ['start', 'start'])
})

test('持有进程已退出的过期锁会被接管', async (t) => {
  const { dir, env } = setup(t)
  const dead = spawnSync(process.execPath, ['-e', '']).pid
  writeFileSync(join(dir, 'build.lock'), JSON.stringify({ name: 'build', pid: dead, command: 'old' }))
  const result = await run(['build', '--', process.execPath, '-e', ''], env)
  assert.equal(result.code, 0)
  assert.match(result.stderr, /接管过期锁/)
  assert.equal(existsSync(join(dir, 'build.lock')), false)
})

test('子命令再次申请同名锁时直接执行，不自锁', async (t) => {
  const { env } = setup(t)
  const inner = `node ${JSON.stringify(script)} build -- node -e "process.exit(3)"`
  const result = await run(['build', '--', inner], env)
  assert.equal(result.code, 3)
})

test('参数不完整时给出用法并返回 2', async (t) => {
  const { env } = setup(t)
  assert.equal((await run(['build'], env)).code, 2)
  assert.equal((await run(['build', 'x', '--', 'true'], env)).code, 2)
})
