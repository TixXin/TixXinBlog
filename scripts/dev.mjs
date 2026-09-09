/** @file dev.mjs @description 根目录开发自检和完整启动入口 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { readConfig, redact } from './dev/config.mjs'
import { checkDatabase, inspectService, run, startPostgres } from './dev/checks.mjs'
import { createSupervisor } from './dev/supervisor.mjs'

const mode = process.argv[2]
const controller = new AbortController()
let supervisor
let manifestPath
let manifest
const report = (message) => process.stdout.write(message + '\n')
async function stop() {
  controller.abort()
  await supervisor?.close()
}
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
// 启动尚未就绪时也响应管道结束，避免取消操作后继续创建服务。
if (mode === 'all' && !process.stdin.isTTY) {
  process.stdin.resume()
  process.stdin.once('end', () => void stop())
  process.stdin.on('data', (value) => {
    if (String(value).trim() === 'stop') void stop()
  })
}
let config
try {
  if (!['check', 'all'].includes(mode)) throw new Error('用法：corepack pnpm dev:check 或 corepack pnpm dev:all')
  config = readConfig()
  const version = await run(...config.pnpm, { cwd: config.root })
  if (version !== '9.15.0') throw new Error('pnpm 版本必须为 9.15.0')
  report('配置：Node 24 / pnpm 9.15.0；环境变量校验通过')
  let database = await checkDatabase(config)
  if (!database.connected && mode === 'all' && !controller.signal.aborted) {
    report('PostgreSQL：尝试按已有 Compose 配置启动')
    await startPostgres(config)
    for (let attempt = 0; attempt < 15 && !controller.signal.aborted; attempt++) {
      database = await checkDatabase(config)
      if (database.connected) break
      await delay(500)
    }
  }
  if (!database.connected) throw new Error(database.detail)
  if (database.pending.length)
    throw new Error(
      `数据库有 ${database.pending.length} 项待执行迁移：${database.pending.join(', ')}。请先运行 corepack pnpm --filter server-main migration:up`,
    )
  report('PostgreSQL：连接正常，现有迁移已执行')
  if (mode === 'check') {
    for (const service of [config.api, config.web]) {
      const result = await inspectService(service)
      report(
        `${service.name}：${result.state === 'ready' ? '已就绪' : result.state === 'stopped' ? '未运行' : result.detail} ${service.origin}`,
      )
      if (result.state !== 'ready') process.exitCode = 1
    }
  } else if (!controller.signal.aborted) {
    const directory = join(config.root, '.artifacts/dev', `${Date.now()}-${process.pid}`)
    mkdirSync(directory, { recursive: true })
    supervisor = createSupervisor({ services: [config.api, config.web], directory, timeout: config.timeout, report })
    manifestPath = join(directory, 'session.json')
    manifest = { pid: process.pid, session: supervisor.session, status: 'starting', services: [] }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    const active = await supervisor.launch()
    manifest = {
      ...manifest,
      status: 'ready',
      services: active.map((entry) => ({
        service: entry.service.service,
        origin: entry.service.origin,
        reused: entry.reused,
      })),
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    report('开发链路已就绪；Ctrl+C 结束本次启动。')
    await supervisor.monitor(controller.signal)
    await stop()
  }
} catch (error) {
  report('开发链路未就绪：' + redact(error.message, config?.api.env ?? {}, config?.web.env ?? {}))
  process.exitCode = controller.signal.aborted ? 0 : 1
  await stop()
} finally {
  if (manifestPath)
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, status: 'stopped', exitCode: process.exitCode ?? 0 }, null, 2),
    )
  if (mode === 'all' && !process.stdin.isTTY) process.stdin.destroy()
}
