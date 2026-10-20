/** @file setup-sandbox.test.mjs @description 初始化沙盒纯逻辑回归：固定库名、参数解析、连接地址与服务命令构造；不连接数据库 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { databaseFingerprint } from './config.mjs'
import {
  SANDBOX_DATABASE,
  SANDBOX_PORTS,
  assertSandboxDatabase,
  assertSandboxEnvironment,
  createSandboxServices,
  parseSetupArgs,
  sandboxDatabaseUrls,
  setupLinks,
} from './setup-sandbox-config.mjs'

const developmentUrl = 'postgres://author:p%40ss@127.0.0.1:5433/tixxin_blog'
const sandboxUrl = `postgres://author:p%40ss@127.0.0.1:5433/${SANDBOX_DATABASE}`
const baseConfig = () => ({
  api: {
    name: 'API',
    service: 'server-main',
    directory: '/repo/src/backend/server-main',
    port: 3457,
    origin: 'http://127.0.0.1:3457',
    entry: '/repo/nest.js',
    args: ['start', '--watch', '--path', 'tsconfig.dev.json'],
    identityPath: '/api/v1/dev/identity',
    readyPath: '/ready',
    workspace: 'w',
    database: databaseFingerprint(developmentUrl),
    env: {
      RATE_LIMIT_DISABLED: 'true',
      DATABASE_URL: developmentUrl,
      SETUP_TOKEN: '',
      MEDIA_DIRECTORY: './var/media',
      NOTIFICATION_EMAIL_ENABLED: 'true',
      CORS_ORIGIN: 'http://localhost:3456',
    },
  },
  web: {
    name: '前端',
    service: 'web-blog',
    port: 3456,
    origin: 'http://localhost:3456',
    entry: '/repo/nuxt.mjs',
    args: ['dev', '--host', '127.0.0.1', '--port', '3456'],
    identityPath: '/__dev/identity',
    readyPath: '/api/v1/posts?pageSize=1',
    workspace: 'w',
    env: { NUXT_API_BASE_URL: 'http://127.0.0.1:3457/api/v1', NUXT_PUBLIC_SITE_URL: 'http://localhost:3456' },
  },
})
const sandboxOptions = {
  webPort: SANDBOX_PORTS.web,
  apiPort: SANDBOX_PORTS.api,
  databaseUrl: sandboxUrl,
  setupToken: 'a'.repeat(64),
  jwtSecret: 'b'.repeat(96),
  mediaDirectory: '/repo/.artifacts/setup-sandbox/media',
}

test('只接受完全等于固定沙盒库名的名称', () => {
  assert.equal(assertSandboxDatabase(SANDBOX_DATABASE), `"${SANDBOX_DATABASE}"`)
  for (const name of [
    'tixxin_blog',
    `${SANDBOX_DATABASE}_old`,
    `${SANDBOX_DATABASE.toUpperCase()}`,
    ` ${SANDBOX_DATABASE}`,
    `${SANDBOX_DATABASE}"; drop database tixxin_blog; --`,
    '',
    undefined,
  ])
    assert.throws(() => assertSandboxDatabase(name), /拒绝操作数据库/)
})

test('子进程环境的数据库地址必须指向沙盒库', () => {
  assert.doesNotThrow(() => assertSandboxEnvironment({ DATABASE_URL: sandboxUrl }))
  assert.throws(() => assertSandboxEnvironment({ DATABASE_URL: developmentUrl }), /拒绝操作数据库/)
})

test('参数解析：默认端口、自定义端口与 --logs 仅限 start', () => {
  assert.deepEqual(parseSetupArgs(['start']), { action: 'start', logs: false, webPort: 3466, apiPort: 3467 })
  assert.deepEqual(parseSetupArgs(['start', '--logs', '--web-port=4100', '--api-port=4101']), {
    action: 'start',
    logs: true,
    webPort: 4100,
    apiPort: 4101,
  })
  assert.equal(parseSetupArgs(['down', '--api-port=4200']).apiPort, 4200)
  assert.throws(() => parseSetupArgs([]), /用法/)
  assert.throws(() => parseSetupArgs(['drop']), /用法/)
  assert.throws(() => parseSetupArgs(['reset', '--logs']), /无法识别/)
  assert.throws(() => parseSetupArgs(['start', '--web-port=abc']), /无法识别/)
  assert.throws(() => parseSetupArgs(['start', '--web-port=70000']), /1–65535/)
  assert.throws(() => parseSetupArgs(['start', '--web-port=0']), /1–65535/)
  assert.throws(() => parseSetupArgs(['start', '--web-port=4000', '--api-port=4000']), /不能相同/)
})

test('沙盒与维护库地址沿用开发连接参数，只替换库名', () => {
  const urls = sandboxDatabaseUrls(developmentUrl)
  assert.equal(urls.development, 'tixxin_blog')
  assert.equal(urls.sandbox, sandboxUrl)
  assert.equal(urls.maintenance, 'postgres://author:p%40ss@127.0.0.1:5433/postgres')
  assert.equal(
    sandboxDatabaseUrls('postgresql://a:b@localhost:5432/blog?sslmode=disable').sandbox,
    `postgresql://a:b@localhost:5432/${SANDBOX_DATABASE}?sslmode=disable`,
  )
})

test('拒绝外部主机、系统库与已指向沙盒库的开发配置', () => {
  assert.throws(() => sandboxDatabaseUrls('postgres://a:b@db.example.com:5432/blog'), /本机/)
  assert.throws(() => sandboxDatabaseUrls(sandboxUrl), /指向了沙盒库/)
  assert.throws(() => sandboxDatabaseUrls('postgres://a:b@127.0.0.1:5432/postgres'), /系统库/)
  assert.throws(() => sandboxDatabaseUrls('mysql://a:b@127.0.0.1:3306/blog'), /PostgreSQL/)
})

test('沙盒服务使用独立端口、构建目录与子进程环境，不改动日常服务描述', () => {
  const config = baseConfig()
  const snapshot = structuredClone(config)
  const { api, web } = createSandboxServices(config, sandboxOptions)
  assert.deepEqual(config, snapshot)
  assert.equal(api.origin, 'http://127.0.0.1:3467')
  assert.equal(web.origin, 'http://localhost:3466')
  assert.deepEqual(api.args, [
    'start',
    '--watch',
    '--path',
    'tsconfig.setup-sandbox.json',
    '--preserveWatchOutput',
    '--no-shell',
  ])
  assert.deepEqual(web.args, ['dev', '--envName', 'setup-sandbox', '--host', '127.0.0.1', '--port', '3466'])
  assert.equal(api.database, databaseFingerprint(sandboxUrl))
  assert.notEqual(api.database, config.api.database)
  assert.equal(api.env.DATABASE_URL, sandboxUrl)
  assert.equal(api.env.SETUP_TOKEN, 'a'.repeat(64))
  assert.equal(api.env.PORT, '3467')
  assert.equal(api.env.NODE_ENV, 'development')
  assert.equal(api.env.CORS_ORIGIN, 'http://localhost:3466')
  assert.equal(api.env.MEDIA_DIRECTORY, '/repo/.artifacts/setup-sandbox/media')
  assert.equal(api.env.NOTIFICATION_EMAIL_ENABLED, 'false')
  assert.equal(api.env.RATE_LIMIT_DISABLED, 'true')
  assert.equal(web.env.NUXT_API_BASE_URL, 'http://127.0.0.1:3467/api/v1')
  assert.equal(web.env.NUXT_PUBLIC_API_BASE_URL, '/api/v1')
  assert.equal(web.env.NUXT_PUBLIC_SITE_URL, 'http://localhost:3466')
  assert.equal(web.identityPath, config.web.identityPath)
})

test('环境文件显式关闭限流开关时沙盒保留限流', () => {
  const config = baseConfig()
  config.api.env.RATE_LIMIT_DISABLED = 'false'
  assert.equal(createSandboxServices(config, sandboxOptions).api.env.RATE_LIMIT_DISABLED, 'false')
})

test('拒绝与日常服务端口重叠或非沙盒库地址', () => {
  const config = baseConfig()
  assert.throws(() => createSandboxServices(config, { ...sandboxOptions, webPort: 3456 }), /日常开发服务端口/)
  assert.throws(() => createSandboxServices(config, { ...sandboxOptions, apiPort: 3457 }), /日常开发服务端口/)
  assert.throws(
    () => createSandboxServices(config, { ...sandboxOptions, databaseUrl: developmentUrl }),
    /拒绝操作数据库/,
  )
})

test('初始化链接对令牌编码并指向前端源', () => {
  assert.deepEqual(setupLinks('http://localhost:3466', 'ab+c'), {
    setup: 'http://localhost:3466/setup?token=ab%2Bc',
    home: 'http://localhost:3466/',
  })
})
