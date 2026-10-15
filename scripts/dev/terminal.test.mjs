/** @file terminal.test.mjs @description 可见终端命令在实际 shell 下的路径转义及配置边界回归 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  existsSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
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
  // macOS 临时目录可能经 /var 符号链接解析，使用实际 cwd 对照。
  const expected = execFileSync(process.execPath, ['-p', 'process.cwd()'], { cwd: root, encoding: 'utf8' }).trim()
  for (const service of ['api', 'web']) {
    const command = terminalCommand({ root, node: process.execPath, pnpm, path, service })
    const output = execFileSync('/bin/sh', ['-c', command], { encoding: 'utf8' })
    const result = JSON.parse(output.trim().split('\n').at(-1))
    assert.deepEqual(result, { cwd: expected, args: [service, '--logs'], pnpm, path })
  }
  assert.throws(() => terminalCommand({ root, service: 'all; exit' }), /服务必须为/)
})

function loggedFixture(t, source) {
  const directory = mkdtempSync(join(tmpdir(), 'tixxin-terminal-log-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const root = join(directory, '博客 \' " `false` $(false)')
  mkdirSync(join(root, 'scripts'), { recursive: true })
  writeFileSync(join(root, 'scripts/dev.mjs'), source)
  return { directory, root, node: process.execPath, pnpm: join(root, 'pnpm.js'), path: '/usr/bin:/bin', service: 'api' }
}

test(
  '日志包装保留特殊路径、参数以及启动前stdout/stderr，不覆盖已有日志',
  { skip: process.platform === 'win32' },
  (t) => {
    const fixture = loggedFixture(
      t,
      `console.log('启动检查'); console.error('配置检查失败'); console.log(JSON.stringify(process.argv.slice(2))); process.exitCode=7`,
    )
    const logPath = join(fixture.directory, '日志 \' " $(false) `false`.log')
    writeFileSync(logPath, '此前的启动记录\n')
    const output = execFileSync('/bin/sh', ['-c', terminalCommand({ ...fixture, logPath })], { encoding: 'utf8' })
    assert(output.includes('启动检查'))
    assert(output.includes('配置检查失败'))
    assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)), ['api', '--logs'])
    assert.equal(readFileSync(logPath, 'utf8'), '此前的启动记录\n' + output)
  },
)

test('cd失败也写入预先创建的日志，不需要正式开发会话', { skip: process.platform === 'win32' }, (t) => {
  const fixture = loggedFixture(t, `console.log('不应执行脚本')`)
  const logPath = join(fixture.directory, 'early-failure.log')
  const output = execFileSync(
    '/bin/sh',
    ['-c', terminalCommand({ ...fixture, root: join(fixture.root, 'missing'), logPath })],
    { encoding: 'utf8' },
  )
  assert(output.includes('missing'))
  assert(!output.includes('不应执行脚本'))
  assert.equal(readFileSync(logPath, 'utf8'), output)
})

test('dry-run只预览包装命令，不创建日志目录或启动服务', { skip: process.platform !== 'darwin' }, (t) => {
  const fixture = loggedFixture(t, '')
  const scripts = join(fixture.root, 'scripts/dev')
  mkdirSync(scripts)
  for (const file of ['terminal.mjs', 'config.mjs', 'checks.mjs'])
    copyFileSync(fileURLToPath(new URL(file, import.meta.url)), join(scripts, file))
  writeFileSync(fixture.pnpm, '')
  const output = execFileSync(
    process.execPath,
    [realpathSync(join(scripts, 'terminal.mjs')), '--dry-run', '--service=api'],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      env: { ...process.env, npm_execpath: fixture.pnpm },
    },
  )
  assert(output.includes('/usr/bin/tee -a -i'))
  assert(output.includes('dev-terminal/'))
  assert(!existsSync(join(fixture.root, '.artifacts')))
})

test(
  '同进程组SIGINT仍到达原命令，tee保留清理输出后退出',
  { skip: process.platform === 'win32', timeout: 5000 },
  async (t) => {
    const fixture = loggedFixture(
      t,
      `process.on('SIGINT',()=>{setTimeout(()=>{console.log('清理已完成');process.exit(0)},30)});console.log('信号测试已就绪');setInterval(()=>{},1000)`,
    )
    const logPath = join(fixture.directory, 'signal.log')
    const child = spawn('/bin/sh', ['-c', terminalCommand({ ...fixture, logPath })], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    t.after(() => {
      // 只清理由本测试spawn创建且尚未退出的独立进程组；不按端口或进程名查杀。
      if (child.exitCode !== null || child.signalCode !== null) return
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    })
    const closed = new Promise((resolve) => child.once('close', resolve))
    await new Promise((resolve, reject) => {
      let text = ''
      child.once('error', reject)
      child.stdout.on('data', (chunk) => {
        text += chunk
        if (text.includes('信号测试已就绪')) resolve()
      })
    })
    process.kill(-child.pid, 'SIGINT')
    await closed
    assert(readFileSync(logPath, 'utf8').includes('清理已完成'))
  },
)
