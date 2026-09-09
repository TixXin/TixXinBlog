/** @file supervisor.test.mjs @description 实际子进程与端口回归，覆盖复用、故障和孙进程清理 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, existsSync, realpathSync, rmSync, mkdirSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createSupervisor } from './supervisor.mjs'
import { inspectService } from './checks.mjs'
import { startOwned } from './process.mjs'

const here = dirname(fileURLToPath(import.meta.url))
async function freePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}
function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
async function until(check, timeout = 8000) {
  const end = Date.now() + timeout
  while (!check()) {
    if (Date.now() > end) throw new Error('等待进程状态超时')
    await delay(50)
  }
}
async function fixture(t, mode = 'ready') {
  const root = realpathSync(tmpdir())
  const directory = mkdtempSync(join(root, 'tixxin dev test '))
  const handles = []
  t.after(async () => {
    for (const handle of handles.reverse()) await handle.close()
    const output = join(here, '../../.artifacts/dev-tests')
    mkdirSync(output, { recursive: true })
    for (const file of ['fixture.log', 'existing.log'])
      if (existsSync(join(directory, file)))
        copyFileSync(join(directory, file), join(output, basename(directory) + '-' + file))
    assert(realpathSync(directory).startsWith(root + (process.platform === 'win32' ? '\\' : '/')))
    rmSync(directory, { recursive: true, force: true })
  })
  const port = await freePort()
  const pids = join(directory, 'pids.json')
  const service = {
    name: '测试服务',
    service: 'fixture',
    workspace: 'fixture-workspace',
    port,
    origin: `http://127.0.0.1:${port}`,
    identityPath: '/identity',
    readyPath: '/ready',
    directory,
    entry: join(here, 'fixtures/service.mjs'),
    args: ['空格 "引号" 和末尾\\'],
    env: {
      ...process.env,
      DEV_FIXTURE_MODE: mode,
      DEV_FIXTURE_PORT: String(port),
      DEV_FIXTURE_PIDS: pids,
      TEST_SECRET: 'secret-across-output-chunks',
    },
  }
  return { directory, service, pids, handles }
}
for (const mode of ['ready', 'exit', 'unhealthy', 'warming'])
  test(`实际服务 ${mode} 与孙进程清理`, async (t) => {
    const f = await fixture(t, mode)
    const supervisor = createSupervisor({
      services: [f.service],
      directory: f.directory,
      timeout: mode === 'unhealthy' ? 6000 : 15000,
    })
    f.handles.push(supervisor)
    if (mode === 'ready' || mode === 'warming') {
      const active = await supervisor.launch()
      assert.equal(active[0].reused, false)
      assert.equal((await inspectService(f.service)).state, 'ready')
    } else await assert.rejects(supervisor.launch(), mode === 'exit' ? /进程已退出/ : /就绪超时/)
    await until(() => existsSync(f.pids))
    const pids = JSON.parse(readFileSync(f.pids))
    assert.equal(pids.argument, f.service.args[0])
    await supervisor.close()
    await until(() => !alive(pids.parent) && !alive(pids.child))
    const log = readFileSync(join(f.directory, 'fixture.log'), 'utf8')
    assert(!log.includes(f.service.env.TEST_SECRET))
    assert(log.includes('[已隐藏]'))
  })
test('复用已有服务，退出不会停止该服务', async (t) => {
  const f = await fixture(t)
  const existing = startOwned(f.service, 'already-running', join(f.directory, 'existing.log'))
  f.handles.push(existing)
  for (let i = 0; i < 100; i++) {
    if ((await inspectService(f.service)).state === 'ready') break
    await delay(100)
  }
  assert.equal((await inspectService(f.service)).state, 'ready')
  const supervisor = createSupervisor({ services: [f.service], directory: f.directory })
  const active = await supervisor.launch()
  assert.equal(active[0].reused, true)
  await supervisor.close()
  assert.equal((await inspectService(f.service)).state, 'ready')
})
test('陌生端口占用时不创建或结束任何服务', async (t) => {
  const server = createServer((_req, res) => res.end('not this project'))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const port = server.address().port
  const service = { name: '冲突', origin: `http://127.0.0.1:${port}`, port, identityPath: '/identity' }
  let started = false
  const supervisor = createSupervisor({
    services: [service],
    directory: here,
    start: () => {
      started = true
    },
  })
  await assert.rejects(supervisor.launch(), /无法确认服务归属/)
  assert.equal(started, false)
  assert.equal((await fetch(service.origin)).status, 200)
})
test('已有前端等待新后端就绪后再完成链路', async () => {
  let apiReady = false,
    closed = 0
  const services = [
    { name: 'API', service: 'api' },
    { name: '前端', service: 'web' },
  ]
  const supervisor = createSupervisor({
    services,
    directory: here,
    inspect: async (service) => ({
      state: service.service === 'api' ? (apiReady ? 'ready' : 'stopped') : apiReady ? 'ready' : 'unhealthy',
      identity:
        service.service === 'api' && !apiReady
          ? undefined
          : { session: service.service === 'api' ? supervisor.session : 'existing' },
    }),
    start: () => {
      apiReady = true
      return {
        ended: false,
        close: async () => {
          closed++
        },
      }
    },
  })
  const result = await supervisor.launch()
  assert.deepEqual(
    result.map((item) => item.reused),
    [false, true],
  )
  await supervisor.close()
  assert.equal(closed, 1)
})

test('启动尚未就绪时取消，清理本次进程及孙进程', async (t) => {
  const f = await fixture(t)
  f.service.env.DEV_FIXTURE_DELAY = '10000'
  const supervisor = createSupervisor({ services: [f.service], directory: f.directory, timeout: 15000 })
  f.handles.push(supervisor)
  const pending = supervisor.launch()
  // 立即注册拒绝处理，防止取消时产生未处理 Promise。
  const cancelled = assert.rejects(pending, /启动已取消/)
  await until(() => existsSync(f.pids))
  const pids = JSON.parse(readFileSync(f.pids))
  await supervisor.close()
  await cancelled
  await until(() => !alive(pids.parent) && !alive(pids.child))
})
