/** @file config.mjs @description 开发启动配置：环境优先级、项目标识、依赖与地址检查 */
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { createHash } from 'node:crypto'

export const workspace = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
export const fingerprint = (value) => createHash('sha256').update(value).digest('hex')
export function workspaceFingerprint(root) {
  const value = realpathSync(root).replaceAll('\\', '/')
  return fingerprint(process.platform === 'win32' ? value.toLowerCase() : value)
}
export function databaseFingerprint(value) {
  const url = new URL(value)
  return fingerprint(`${url.protocol}//${url.username}@${url.host}${url.pathname}`)
}
export function readEnvironment(directory, names, inherited = process.env) {
  const values = { ...inherited }
  for (const name of names) {
    const file = join(directory, name)
    if (!existsSync(file)) continue
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) values[key] ??= value
  }
  return values
}
export function redact(text, ...environments) {
  let result = String(text)
  const secrets = environments.flatMap((env) =>
    Object.entries(env)
      .filter(([key, value]) => /PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL/i.test(key) && value?.length >= 4)
      .flatMap(([, value]) => [value, encodeURIComponent(value)]),
  )
  for (const secret of secrets.sort((a, b) => b.length - a.length)) result = result.replaceAll(secret, '[已隐藏]')
  return result.replace(/(postgres(?:ql)?:\/\/)[^\s/]*@/gi, '$1[已隐藏]@')
}
export function pnpmCommand(env = process.env) {
  const candidates = [
    env.npm_execpath,
    join(dirname(process.execPath), 'node_modules/corepack/dist/pnpm.js'),
    ...(env.PATH ?? env.Path ?? '').split(delimiter).map((dir) => join(dir, 'node_modules/corepack/dist/pnpm.js')),
  ]
  const entry = candidates.find((file) => file && /pnpm\.(?:c?js)$/.test(file) && existsSync(file))
  if (!entry) throw new Error('未找到 Corepack/pnpm，请使用 corepack pnpm dev:check 或安装项目要求的 Corepack')
  return [process.execPath, [entry, '--version']]
}
export function readConfig(root = workspace, inherited = process.env) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('开发链路要求 Node 24')
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (manifest.name !== 'tixxinblog' || manifest.packageManager !== 'pnpm@9.15.0')
    throw new Error('项目目录或 pnpm 固定版本不匹配')
  const apiDirectory = join(root, 'src/backend/server-main')
  const webDirectory = join(root, 'src/frontend/web-blog')
  const apiEnv = readEnvironment(apiDirectory, ['.env.local', '.env'], inherited)
  const webEnv = readEnvironment(webDirectory, ['.env'], inherited)
  if ((apiEnv.NODE_ENV ?? 'development') !== 'development') throw new Error('dev:all/dev:check 仅用于 development 配置')
  let database
  try {
    database = new URL(apiEnv.DATABASE_URL)
  } catch {
    throw new Error('后端 DATABASE_URL 缺失或格式错误')
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.pathname.length < 2)
    throw new Error('DATABASE_URL 必须指定 PostgreSQL 数据库')
  if (!apiEnv.JWT_ACCESS_SECRET || apiEnv.JWT_ACCESS_SECRET.length < 32)
    throw new Error('后端 JWT_ACCESS_SECRET 需至少 32 位')
  const apiPort = Number(apiEnv.PORT ?? 3000),
    webPort = Number(webEnv.NUXT_PORT ?? 3456)
  if (![apiPort, webPort].every((port) => Number.isInteger(port) && port > 0 && port <= 65535) || apiPort === webPort)
    throw new Error('前后端端口必须有效且互不相同')
  const apiOrigin = `http://127.0.0.1:${apiPort}`,
    webOrigin = `http://localhost:${webPort}`
  let target
  try {
    target = new URL(webEnv.NUXT_API_BASE_URL)
  } catch {
    throw new Error('前端 NUXT_API_BASE_URL 未配置')
  }
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    target.protocol !== 'http:' ||
    Number(target.port || 80) !== apiPort ||
    target.pathname.replace(/\/$/, '') !== '/api/v1' ||
    target.username ||
    target.password
  )
    throw new Error('NUXT_API_BASE_URL 需要指向本机后端端口下的 /api/v1')
  if ((webEnv.NUXT_PUBLIC_API_BASE_URL ?? '/api/v1') !== '/api/v1')
    throw new Error('前端公开 API 地址必须使用同源 /api/v1')
  if (webEnv.NUXT_PUBLIC_USE_MOCK_REPO === 'true' || webEnv.NUXT_PUBLIC_POST_USE_MOCK_REPO === 'true')
    throw new Error('完整开发链路要求真实 API；演示模式请单独使用 dev:blog')
  const id = workspaceFingerprint(root)
  const api = {
    name: 'API',
    service: 'server-main',
    directory: apiDirectory,
    origin: apiOrigin,
    port: apiPort,
    entry: join(apiDirectory, 'node_modules/@nestjs/cli/bin/nest.js'),
    args: ['start', '--watch', '--path', 'tsconfig.dev.json', '--preserveWatchOutput', '--no-shell'],
    identityPath: '/api/v1/dev/identity',
    readyPath: '/ready',
    workspace: id,
    database: databaseFingerprint(apiEnv.DATABASE_URL),
    env: { ...apiEnv, NODE_ENV: 'development' },
  }
  const web = {
    name: '前端',
    service: 'web-blog',
    directory: webDirectory,
    origin: webOrigin,
    port: webPort,
    entry: join(webDirectory, 'node_modules/nuxt/bin/nuxt.mjs'),
    args: ['dev', '--host', '127.0.0.1', '--port', String(webPort)],
    identityPath: '/__dev/identity',
    readyPath: '/api/v1/posts?pageSize=1',
    workspace: id,
    env: { ...webEnv, NODE_ENV: 'development' },
  }
  for (const service of [api, web])
    if (!existsSync(service.entry)) throw new Error(`${service.name}依赖未安装，请运行 corepack pnpm install`)
  return {
    root,
    api,
    web,
    database,
    pnpm: pnpmCommand(inherited),
    timeout: Number(inherited.TIXXIN_DEV_TIMEOUT_MS ?? 90000),
  }
}
