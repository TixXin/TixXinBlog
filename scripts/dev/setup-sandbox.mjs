/** @file setup-sandbox.mjs @description 初始化沙盒入口：独立空库上托管 API 与热更新前端，或重建、删除沙盒库 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { readConfig, redact } from './config.mjs'
import { checkDatabase, portOpen, run } from './checks.mjs'
import { createSupervisor } from './supervisor.mjs'
import { startOwned } from './process.mjs'
import {
  SANDBOX_DATABASE,
  assertSandboxDatabase,
  assertSandboxEnvironment,
  createSandboxServices,
  parseSetupArgs,
  sandboxDatabaseUrls,
  sandboxPaths,
  setupLinks,
} from './setup-sandbox-config.mjs'

const report = (message) => process.stdout.write(message + '\n')
const controller = new AbortController()
let supervisor
let config
let services
let manifestPath
let manifest

async function stop() {
  controller.abort()
  await supervisor?.close()
}

/** 以单连接执行 SQL；维护操作连接 postgres 库，沙盒状态连接沙盒库，均不连接日常开发库 */
async function withConnection(url, task) {
  const require = createRequire(join(config.api.directory, 'package.json'))
  const { MikroORM } = require('@mikro-orm/postgresql')
  const orm = await MikroORM.init({
    clientUrl: url,
    entities: [],
    discovery: { warnWhenNoEntities: false },
    debug: false,
    ensureDatabase: false,
    pool: { min: 0, max: 1, acquireTimeoutMillis: 3000 },
    driverOptions: { connection: { connectionTimeoutMillis: 3000, statement_timeout: 10000 } },
  })
  try {
    return await task(orm.em.getConnection())
  } finally {
    await orm.close(true)
  }
}

async function sandboxExists(urls) {
  return withConnection(urls.maintenance, async (connection) => {
    const rows = await connection.execute('select 1 from pg_database where datname = ?', [SANDBOX_DATABASE])
    return rows.length > 0
  })
}

async function createSandbox(urls) {
  const identifier = assertSandboxDatabase(SANDBOX_DATABASE)
  await withConnection(urls.maintenance, (connection) => connection.execute(`create database ${identifier}`))
  report(`沙盒库：已创建 ${SANDBOX_DATABASE}`)
}

/** 删除前确认没有任何其他连接；不使用 FORCE，竞态下由 PostgreSQL 自身拒绝 */
async function dropSandbox(urls) {
  const identifier = assertSandboxDatabase(SANDBOX_DATABASE)
  await withConnection(urls.maintenance, async (connection) => {
    const [{ count }] = await connection.execute(
      'select count(*)::int as "count" from pg_stat_activity where datname = ? and pid <> pg_backend_pid()',
      [SANDBOX_DATABASE],
    )
    if (count > 0)
      throw new Error(
        `沙盒库仍有 ${count} 个其他连接（dev:setup 服务、数据库客户端或其他工具），先断开后重试；不会强制结束连接`,
      )
    try {
      await connection.execute(`drop database ${identifier}`)
    } catch {
      throw new Error('删除沙盒库失败：可能在检查后又有新连接接入，断开后重试')
    }
  })
  report(`沙盒库：已删除 ${SANDBOX_DATABASE}`)
}

/** 走正式迁移入口 migration:up；子进程只携带沙盒库地址，进程环境优先于后端环境文件 */
async function migrateSandbox(urls) {
  const sandboxConfig = { api: { ...config.api, env: { DATABASE_URL: urls.sandbox } } }
  const status = await checkDatabase(sandboxConfig)
  if (!status.connected) throw new Error('无法连接沙盒库：' + status.detail)
  if (!status.pending.length) return report('沙盒库：迁移已是最新')
  report(`沙盒库：执行 ${status.pending.length} 项正式迁移`)
  // NODE_ENV=test 只关闭迁移快照（mikro-orm.options），不向源码目录写入沙盒库快照；迁移内容不读取该变量。
  const env = assertSandboxEnvironment({ ...config.api.env, NODE_ENV: 'test', DATABASE_URL: urls.sandbox })
  const tsx = join(config.api.directory, 'node_modules/tsx/dist/cli.mjs')
  const output = await run(process.execPath, [tsx, 'scripts/migrate.ts', 'up'], {
    cwd: config.api.directory,
    env,
    timeout: 300000,
    maxBuffer: 8 * 1024 * 1024,
  })
  const executed = /executed (\d+) migration/.exec(output)?.[1]
  report(`沙盒库：迁移完成${executed ? `，已执行 ${executed} 项` : ''}`)
}

async function adminCount(urls) {
  return withConnection(urls.sandbox, async (connection) => {
    const [{ count }] = await connection.execute('select count(*)::int as "count" from admin_user')
    return count
  })
}

/** 端口有任何监听都拒绝：不复用、不结束占用进程 */
async function assertPortsFree(options, hint) {
  for (const [label, port] of [
    ['沙盒前端', options.webPort],
    ['沙盒 API', options.apiPort],
  ])
    if (await portOpen(port)) throw new Error(`${label}端口 ${port} 已被占用${hint}；不会结束占用进程`)
}

async function start(options, urls, paths) {
  await assertPortsFree(options, '（可能已有 dev:setup 在运行，或改用 --web-port/--api-port）')
  if (await sandboxExists(urls)) report(`沙盒库：复用已有 ${SANDBOX_DATABASE}（不重建）`)
  else await createSandbox(urls)
  await migrateSandbox(urls)
  const admins = await adminCount(urls)
  report(
    admins
      ? `沙盒状态：已初始化（${admins} 个管理员），初始化页会显示已完成；重新体验请先 Ctrl+C 再运行 corepack pnpm dev:setup:reset`
      : '沙盒状态：尚未初始化，可从首页提示或初始化链接开始',
  )
  const setupToken = randomBytes(32).toString('hex')
  mkdirSync(paths.media, { recursive: true })
  services = createSandboxServices(config, {
    ...options,
    databaseUrl: urls.sandbox,
    setupToken,
    jwtSecret: randomBytes(48).toString('hex'),
    mediaDirectory: paths.media,
  })
  if (controller.signal.aborted) return
  const directory = join(paths.sessions, `${Date.now()}-${process.pid}`)
  mkdirSync(directory, { recursive: true })
  supervisor = createSupervisor({
    services: [services.api, services.web],
    directory,
    timeout: config.timeout,
    report,
    start: (service, session, logPath) => startOwned(service, session, logPath, options.logs ? report : undefined),
  })
  manifestPath = join(directory, 'session.json')
  manifest = { pid: process.pid, session: supervisor.session, mode: 'setup-sandbox', status: 'starting', services: [] }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  const active = await supervisor.launch()
  manifest = {
    ...manifest,
    status: 'ready',
    services: active.map((entry) => ({ service: entry.service.service, origin: entry.service.origin })),
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  const links = setupLinks(services.web.origin, setupToken)
  report('初始化沙盒已就绪；令牌每次启动随机生成，只显示在本终端。')
  report(`  初始化页：${links.setup}`)
  report(`  首页：    ${links.home}`)
  report('Ctrl+C 仅结束本次启动的沙盒服务，沙盒库保留；reset 重建，down 删除。')
  await supervisor.monitor(controller.signal)
  await stop()
  report(`沙盒库 ${SANDBOX_DATABASE} 保留；重建用 corepack pnpm dev:setup:reset，删除用 corepack pnpm dev:setup:down`)
}

async function rebuild(options, urls, paths, recreate) {
  await assertPortsFree(options, '：先在运行 dev:setup 的终端按 Ctrl+C 停止沙盒服务')
  const existed = await sandboxExists(urls)
  if (existed) await dropSandbox(urls)
  else report(`沙盒库：${SANDBOX_DATABASE} 不存在，无需删除`)
  // 仅清理沙盒专属媒体目录，与日常 MEDIA_DIRECTORY 无关。
  rmSync(paths.media, { recursive: true, force: true })
  if (!recreate) return report(existed ? '沙盒已删除；日常开发库未受影响。' : '没有可删除的沙盒。')
  await createSandbox(urls)
  await migrateSandbox(urls)
  report('沙盒已重建为空库；运行 corepack pnpm dev:setup 重新体验初始化。')
}

process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
let options
try {
  options = parseSetupArgs(process.argv.slice(2))
  // 非交互调用（管道）时与 dev.mjs 一致：输入结束或收到 stop 即停止本次服务。
  if (options.action === 'start' && !process.stdin.isTTY) {
    process.stdin.resume()
    process.stdin.once('end', () => void stop())
    process.stdin.on('data', (value) => {
      if (String(value).trim() === 'stop') void stop()
    })
  }
  config = readConfig()
  const version = await run(...config.pnpm, { cwd: config.root })
  if (version !== '9.15.0') throw new Error('pnpm 版本必须为 9.15.0')
  const urls = sandboxDatabaseUrls(config.api.env.DATABASE_URL)
  report(`配置：沙盒库 ${SANDBOX_DATABASE}（日常开发库 ${urls.development} 不会被连接或修改）`)
  const paths = sandboxPaths(config.root)
  if (options.action === 'start') await start(options, urls, paths)
  else await rebuild(options, urls, paths, options.action === 'reset')
} catch (error) {
  report(
    '初始化沙盒未完成：' + redact(error.message, config?.api.env ?? {}, config?.web.env ?? {}, services?.api.env ?? {}),
  )
  process.exitCode = controller.signal.aborted ? 0 : 1
  await stop()
} finally {
  if (manifestPath)
    writeFileSync(
      manifestPath,
      JSON.stringify({ ...manifest, status: 'stopped', exitCode: process.exitCode ?? 0 }, null, 2),
    )
  if (options?.action === 'start' && !process.stdin.isTTY) process.stdin.destroy()
}
