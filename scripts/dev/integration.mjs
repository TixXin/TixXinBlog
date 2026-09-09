/** @file integration.mjs @description 完整 Nuxt/Nest 开发启动验收；使用独立工作区、数据库与媒体 */
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { workspace, readEnvironment, redact } from './config.mjs'
import { run, json, portOpen } from './checks.mjs'

const work = join(workspace, '.artifacts/dev-integration', `${Date.now()}-${process.pid}`)
const target = join(work, 'workspace')
const sourceApi = join(workspace, 'src/backend/server-main')
const sourceWeb = join(workspace, 'src/frontend/web-blog')
const api = join(target, 'src/backend/server-main'),
  web = join(target, 'src/frontend/web-blog')
const baseEnv = readEnvironment(sourceApi, ['.env.local', '.env'])
const skip = new Set([
  'node_modules',
  '.nuxt',
  '.nuxt-production',
  '.output',
  'dist',
  '.dev-dist',
  '.cache',
  'coverage',
])
mkdirSync(target, { recursive: true })
for (const name of ['package.json', 'pnpm-workspace.yaml']) cpSync(join(workspace, name), join(target, name))
cpSync(join(workspace, 'scripts/dev.mjs'), join(target, 'scripts/dev.mjs'), { recursive: true })
cpSync(join(workspace, 'scripts/dev'), join(target, 'scripts/dev'), { recursive: true })
for (const [source, destination] of [
  [sourceApi, api],
  [sourceWeb, web],
]) {
  cpSync(source, destination, {
    recursive: true,
    filter: (path) =>
      !path.split(/[\\/]/).some((part) => skip.has(part) || part.startsWith('.env') || part.startsWith('.vite')),
  })
  symlinkSync(
    join(source, 'node_modules'),
    join(destination, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )
}
const nuxtPath = join(web, 'nuxt.config.ts')
const webPath = web.replaceAll('\\', '/')
writeFileSync(
  nuxtPath,
  readFileSync(nuxtPath, 'utf8')
    .replace(
      /buildDir:.*?,\n/,
      `workspaceDir: ${JSON.stringify(webPath)},\n  buildDir: ${JSON.stringify(webPath + '/.nuxt')},\n`,
    )
    .replace('vite: {', `vite: {\n    cacheDir: ${JSON.stringify(webPath + '/.vite-dev')},`),
)
async function freePort() {
  const listener = createServer()
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve))
  const port = listener.address().port
  await new Promise((resolve) => listener.close(resolve))
  return port
}
const apiPort = await freePort(),
  webPort = await freePort()
const apiOrigin = `http://127.0.0.1:${apiPort}`,
  webOrigin = `http://localhost:${webPort}`
const result = { coldStart: false, reuse: false, databaseFailure: false, migrationCheck: false, cleanExit: false }
let fixture
const launchers = []
let testEnv
async function command(args, env = testEnv) {
  try {
    return {
      code: 0,
      text: await run(process.execPath, [join(target, 'scripts/dev.mjs'), ...args], {
        cwd: target,
        env,
        timeout: 15000,
      }),
    }
  } catch (error) {
    return { code: error.code, text: String(error.stdout) }
  }
}
function launch(name) {
  const child = spawn(process.execPath, [join(target, 'scripts/dev.mjs'), 'all'], {
    cwd: target,
    env: testEnv,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let output = ''
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (value) => {
      output += String(value)
      writeFileSync(join(work, name + '.log'), redact(output, testEnv, baseEnv))
    })
  const completion = new Promise((resolve) => {
    child.once('close', resolve)
    child.once('error', () => resolve(1))
  })
  const entry = {
    child,
    completion,
    async stop() {
      if (child.exitCode === null) child.stdin.end('stop\n')
      await completion
    },
  }
  launchers.push(entry)
  return {
    ...entry,
    async ready() {
      for (let i = 0; i < 180; i++) {
        if (output.includes('开发链路已就绪')) return
        if (child.exitCode !== null) throw new Error('完整启动失败，见 ' + join(work, name + '.log'))
        await delay(500)
      }
      throw new Error('完整启动超时，见 ' + join(work, name + '.log'))
    },
  }
}
try {
  const backendRequire = createRequire(join(api, 'package.json'))
  // 仅编译隔离后端，不触碰当前服务的 .dev-dist。
  await run(process.execPath, [backendRequire.resolve('@nestjs/cli/bin/nest.js'), 'build'], {
    cwd: api,
    env: baseEnv,
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  })
  Object.assign(process.env, baseEnv)
  const { createBrowserTestApp } = await import(pathToFileURL(join(api, 'tests/test-app.mjs')))
  fixture = await createBrowserTestApp(webOrigin)
  testEnv = {
    ...baseEnv,
    NODE_ENV: 'development',
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    PORT: String(apiPort),
    NUXT_PORT: String(webPort),
    CORS_ORIGIN: webOrigin,
    MEDIA_DIRECTORY: process.env.MEDIA_DIRECTORY,
    NUXT_API_BASE_URL: apiOrigin + '/api/v1',
    NUXT_PUBLIC_API_BASE_URL: '/api/v1',
    NUXT_PUBLIC_USE_MOCK_REPO: 'false',
    NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
  }
  const before = await command(['check'])
  assert.notEqual(before.code, 0)
  assert.match(before.text, /未运行/)
  const wrongDatabase = new URL(testEnv.DATABASE_URL)
  wrongDatabase.port = String(await freePort())
  const unavailable = await command(['check'], { ...testEnv, DATABASE_URL: wrongDatabase.toString() })
  assert.notEqual(unavailable.code, 0)
  assert.match(unavailable.text, /数据库连接或认证失败/)
  assert(!unavailable.text.includes(wrongDatabase.password))
  result.databaseFailure = true
  const pendingFile = join(api, 'src/migrations/99999999999999_probe.ts')
  writeFileSync(pendingFile, '/** 隔离验证占位，仅检查待迁移提示，不执行。 */\n')
  try {
    const pending = await command(['check'])
    assert.notEqual(pending.code, 0)
    assert.match(pending.text, /待执行迁移/)
    result.migrationCheck = true
  } finally {
    unlinkSync(pendingFile)
  }
  const first = launch('cold')
  await first.ready()
  assert.equal((await command(['check'])).code, 0)
  const identities = await Promise.all([json(apiOrigin + '/api/v1/dev/identity'), json(webOrigin + '/__dev/identity')])
  assert.equal((await json(webOrigin + '/api/v1/posts?pageSize=1')).total, 106)
  result.coldStart = true
  const second = launch('reuse')
  await second.ready()
  await second.stop()
  const after = await Promise.all([json(apiOrigin + '/api/v1/dev/identity'), json(webOrigin + '/__dev/identity')])
  assert.deepEqual(
    after.map((value) => value.pid),
    identities.map((value) => value.pid),
  )
  result.reuse = true
  await first.stop()
  assert.equal(await portOpen(apiPort), false)
  assert.equal(await portOpen(webPort), false)
  result.cleanExit = true
} finally {
  for (const entry of launchers.reverse()) await entry.stop()
  await fixture?.close()
  writeFileSync(
    join(work, 'result.json'),
    JSON.stringify({ ...result, cleaned: true, at: new Date().toISOString() }, null, 2),
  )
  process.stdout.write(JSON.stringify({ ...result, output: work }) + '\n')
}
