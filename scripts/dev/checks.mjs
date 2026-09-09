/** @file checks.mjs @description 配置数据库只读检查、服务归属检查与显式 PostgreSQL 启动 */
import { createRequire } from 'node:module'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { connect } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)

export async function run(command, args, options = {}) {
  const { stdout } = await execute(command, args, {
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    ...options,
  })
  return stdout.trim()
}
export function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = connect({ port, host })
    const finish = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(1000)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}
export async function json(url, timeout = 2500) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: 'error' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const result = await response.json()
  return result.data ?? result
}
export async function inspectService(service) {
  if (!(await portOpen(service.port))) return { state: 'stopped' }
  let identity
  try {
    identity = await json(service.origin + service.identityPath)
  } catch {
    return { state: 'foreign', detail: '端口被占用，但无法确认服务归属；检查该端口的进程或更新旧开发服务后重试' }
  }
  if (
    identity.service !== service.service ||
    identity.workspace !== service.workspace ||
    (service.database && identity.database !== service.database)
  )
    return { state: 'foreign', identity, detail: '端口属于其他项目、服务或数据库配置' }
  try {
    const ready = await json(service.origin + service.readyPath)
    if (
      (service.service === 'server-main' && ready.status !== 'ok') ||
      (service.service === 'web-blog' && (!Array.isArray(ready.items) || typeof ready.total !== 'number'))
    )
      throw new Error('就绪响应不符合当前服务契约')
    return { state: 'ready', identity }
  } catch {
    return { state: 'unhealthy', identity, detail: '进程存在，但就绪探针或同源业务接口失败' }
  }
}
export async function checkDatabase(config) {
  const require = createRequire(join(config.api.directory, 'package.json'))
  const { MikroORM } = require('@mikro-orm/postgresql')
  let orm
  try {
    orm = await MikroORM.init({
      clientUrl: config.api.env.DATABASE_URL,
      entities: [],
      discovery: { warnWhenNoEntities: false },
      debug: false,
      ensureDatabase: false,
      pool: { min: 0, max: 1, acquireTimeoutMillis: 3000 },
      driverOptions: { connection: { connectionTimeoutMillis: 3000, statement_timeout: 3000 } },
    })
    const connection = orm.em.getConnection()
    await connection.execute('select 1')
    const [{ table }] = await connection.execute('select to_regclass(\'public.mikro_orm_migrations\') as "table"')
    const applied = table
      ? (await connection.execute('select name from mikro_orm_migrations')).map((row) => row.name)
      : []
    const expected = readdirSync(join(config.api.directory, 'src/migrations'))
      .filter((name) => /^\d+_.*\.ts$/.test(name))
      .map((name) => name.slice(0, -3))
    const pending = expected.filter((name) => !applied.includes(name))
    return { connected: true, pending }
  } catch {
    return { connected: false, pending: [], detail: '数据库连接或认证失败，请检查 PostgreSQL 与 DATABASE_URL' }
  } finally {
    if (orm) await orm.close(true)
  }
}
export async function startPostgres(config) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(config.database.hostname))
    throw new Error('数据库不可用：外部 PostgreSQL 需要自行恢复')
  if (await portOpen(Number(config.database.port || 5432), config.database.hostname.replace(/^\[|\]$/g, '')))
    throw new Error('数据库端口已在监听；请检查认证、数据库名称和日志，不会重启现有容器')
  const directory = config.api.directory
  const args = ['compose', '--project-directory', directory, '-f', join(directory, 'docker-compose.yml')]
  if (existsSync(join(directory, '.env.local'))) args.push('--env-file', join(directory, '.env.local'))
  let compose
  try {
    compose = JSON.parse(await run('docker', [...args, 'config', '--format', 'json'], { env: config.api.env }))
  } catch {
    throw new Error('数据库不可用，且无法读取项目 Docker Compose 配置；请启动 PostgreSQL 后重试')
  }
  const service = compose.services?.postgres
  const env = service?.environment
  const mapping = service?.ports?.find((port) => Number(port.target) === 5432)
  if (
    !env ||
    env.POSTGRES_DB !== decodeURIComponent(config.database.pathname.slice(1)) ||
    env.POSTGRES_USER !== decodeURIComponent(config.database.username) ||
    env.POSTGRES_PASSWORD !== decodeURIComponent(config.database.password) ||
    Number(mapping?.published) !== Number(config.database.port || 5432) ||
    mapping?.host_ip !== '127.0.0.1'
  )
    throw new Error('数据库不可用，且 Compose 的数据库或端口与当前配置不一致；未启动或修改任何容器')
  // Compose 保留已有卷，不执行 down、迁移或 seed。数据库作为持久依赖保留运行。
  await run('docker', [...args, 'up', '-d', 'postgres'], { env: config.api.env, timeout: 60000 })
}
