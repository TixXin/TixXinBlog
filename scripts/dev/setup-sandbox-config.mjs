/** @file setup-sandbox-config.mjs @description 初始化沙盒的纯逻辑：固定库名校验、参数解析、连接地址与服务配置构造 */
import { join } from 'node:path'
import { databaseFingerprint } from './config.mjs'

/** 沙盒库名固定；创建、重建与删除只允许作用于完全相同的名称 */
export const SANDBOX_DATABASE = 'tixxin_blog_setup_sandbox'
export const SANDBOX_PORTS = Object.freeze({ web: 3466, api: 3467 })
export const SANDBOX_ACTIONS = ['start', 'reset', 'down']
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

export const usage =
  '用法：node scripts/dev/setup-sandbox.mjs start|reset|down [--web-port=<端口>] [--api-port=<端口>] [--logs]'

/** 解析子命令与参数；--logs 只用于 start */
export function parseSetupArgs(argv) {
  const [action, ...rest] = argv
  if (!SANDBOX_ACTIONS.includes(action)) throw new Error(usage)
  const options = { action, logs: false, webPort: SANDBOX_PORTS.web, apiPort: SANDBOX_PORTS.api }
  for (const arg of rest) {
    const match = /^--(web-port|api-port)=(\d+)$/.exec(arg)
    if (arg === '--logs' && action === 'start') options.logs = true
    else if (match) options[match[1] === 'web-port' ? 'webPort' : 'apiPort'] = Number(match[2])
    else throw new Error(`无法识别的参数 ${arg}；${usage}`)
  }
  for (const port of [options.webPort, options.apiPort])
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('沙盒端口必须为 1–65535 的整数')
  if (options.webPort === options.apiPort) throw new Error('沙盒前后端端口不能相同')
  return options
}

/** 名称不完全等于固定沙盒库名时拒绝，任何建库、删库语句执行前都必须经过这里 */
export function assertSandboxDatabase(name) {
  if (name !== SANDBOX_DATABASE) throw new Error(`拒绝操作数据库 ${JSON.stringify(name)}：仅允许 ${SANDBOX_DATABASE}`)
  return `"${SANDBOX_DATABASE}"`
}

export function databaseName(url) {
  return decodeURIComponent(new URL(url).pathname.slice(1))
}

/** 由开发库地址推出同一实例上的沙盒库与维护库地址；只接受本机 PostgreSQL，且开发库本身不能是沙盒库 */
export function sandboxDatabaseUrls(developmentUrl) {
  const source = new URL(developmentUrl)
  if (!['postgres:', 'postgresql:'].includes(source.protocol)) throw new Error('DATABASE_URL 必须是 PostgreSQL 地址')
  if (!LOCAL_HOSTS.includes(source.hostname)) throw new Error('初始化沙盒只允许使用本机 PostgreSQL')
  const development = databaseName(source)
  if (development === SANDBOX_DATABASE) throw new Error('开发配置的 DATABASE_URL 指向了沙盒库，请先恢复日常开发库配置')
  if (['postgres', 'template0', 'template1'].includes(development))
    throw new Error('开发配置的 DATABASE_URL 指向系统库，拒绝推导沙盒地址')
  const sandbox = new URL(source)
  sandbox.pathname = `/${SANDBOX_DATABASE}`
  // 建库与删库从维护库 postgres 发起，不连接日常开发库。
  const maintenance = new URL(source)
  maintenance.pathname = '/postgres'
  return { development, sandbox: sandbox.toString(), maintenance: maintenance.toString() }
}

/** 迁移等子进程环境只能携带沙盒库地址 */
export function assertSandboxEnvironment(env) {
  assertSandboxDatabase(databaseName(env.DATABASE_URL))
  return env
}

/**
 * 基于 readConfig() 的日常服务描述构造沙盒服务：沿用入口、目录与归属探针，替换端口、构建目录与业务环境。
 * 沙盒变量只进入子进程环境，不写入任何环境文件。
 */
export function createSandboxServices(
  config,
  { webPort, apiPort, databaseUrl, setupToken, jwtSecret, mediaDirectory },
) {
  if (
    webPort === config.web.port ||
    webPort === config.api.port ||
    apiPort === config.web.port ||
    apiPort === config.api.port
  )
    throw new Error('沙盒端口不能与日常开发服务端口相同')
  assertSandboxDatabase(databaseName(databaseUrl))
  const apiOrigin = `http://127.0.0.1:${apiPort}`
  const webOrigin = `http://localhost:${webPort}`
  const api = {
    ...config.api,
    name: '沙盒 API',
    origin: apiOrigin,
    port: apiPort,
    // 独立输出目录：nest 的 deleteOutDir 不会清掉日常 dev:all 正在使用的 .dev-dist。
    args: ['start', '--watch', '--path', 'tsconfig.setup-sandbox.json', '--preserveWatchOutput', '--no-shell'],
    database: databaseFingerprint(databaseUrl),
    env: assertSandboxEnvironment({
      // 与统一启动器一致默认关闭限流，便于反复提交初始化表单；环境文件显式 false 时保留限流。
      RATE_LIMIT_DISABLED: 'true',
      ...config.api.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      DATABASE_URL: databaseUrl,
      SETUP_TOKEN: setupToken,
      JWT_ACCESS_SECRET: jwtSecret,
      CORS_ORIGIN: webOrigin,
      MEDIA_DIRECTORY: mediaDirectory,
      // 沙盒不运行后台任务、邮件与周期备份，避免向外投递或写入日常备份目录。
      OPERATIONS_WORKER_ENABLED: 'false',
      NOTIFICATION_EMAIL_ENABLED: 'false',
      BACKUP_SCHEDULE_ENABLED: 'false',
    }),
  }
  const web = {
    ...config.web,
    name: '沙盒前端',
    origin: webOrigin,
    port: webPort,
    // setup-sandbox 环境使用独立 .nuxt-setup-sandbox 与 Vite 缓存，可与 dev:all 同时热更新。
    args: ['dev', '--envName', 'setup-sandbox', '--host', '127.0.0.1', '--port', String(webPort)],
    env: {
      ...config.web.env,
      NODE_ENV: 'development',
      NUXT_PORT: String(webPort),
      NUXT_API_BASE_URL: `${apiOrigin}/api/v1`,
      NUXT_PUBLIC_API_BASE_URL: '/api/v1',
      NUXT_PUBLIC_SITE_URL: webOrigin,
      NUXT_PUBLIC_USE_MOCK_REPO: 'false',
      NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
    },
  }
  return { api, web }
}

export function sandboxPaths(root) {
  const base = join(root, '.artifacts/setup-sandbox')
  return { base, media: join(base, 'media'), sessions: join(base, 'sessions') }
}

export function setupLinks(webOrigin, token) {
  return { setup: `${webOrigin}/setup?token=${encodeURIComponent(token)}`, home: `${webOrigin}/` }
}
