/**
 * @file container-smoke.mjs
 * @description 独立 Docker 网络/卷验收生产镜像，清理仅限本次创建的资源
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

const images = {
  web: process.env.WEB_IMAGE ?? 'tixxin-blog-web:remediation',
  api: process.env.API_IMAGE ?? 'tixxin-blog-api:remediation',
  migration: process.env.MIGRATION_IMAGE ?? 'tixxin-blog-migration:remediation',
}
for (const image of Object.values(images)) assert(/^[a-z0-9][a-z0-9./:_-]+$/.test(image))
const prefix = `tixxin-smoke-${process.pid}-${Date.now()}`
const names = {
  network: `${prefix}-net`,
  volume: `${prefix}-data`,
  mediaVolume: `${prefix}-media`,
  pg: `${prefix}-pg`,
  api: `${prefix}-api`,
  web: `${prefix}-web`,
}
const temporaryRoot = realpathSync(tmpdir())
const directory = mkdtempSync(join(temporaryRoot, 'tixxin-docker-smoke-'))
const createdContainers = []
let networkCreated = false
let volumeCreated = false
let mediaVolumeCreated = false
const docker = (args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
const envFile = (name, values) => {
  const path = join(directory, name)
  writeFileSync(
    path,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  )
  return path
}
const start = (name, args) => {
  createdContainers.push(name)
  docker(['run', '-d', '--name', name, '--network', names.network, ...args])
}
async function until(check, description) {
  const deadline = Date.now() + 60000
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch {
      /* 服务启动期间继续检查。 */
    }
    await delay(500)
  }
  throw new Error(`等待超时：${description}`)
}

try {
  docker(['network', 'create', names.network])
  networkCreated = true
  docker(['volume', 'create', names.volume])
  volumeCreated = true
  docker(['volume', 'create', names.mediaVolume])
  mediaVolumeCreated = true
  const databasePassword = randomBytes(24).toString('hex')
  const databaseUrl = `postgres://tixxin:${databasePassword}@${names.pg}:5432/tixxin_blog`
  const adminPassword = randomBytes(24).toString('hex')
  const pgEnv = envFile('postgres.env', {
    POSTGRES_USER: 'tixxin',
    POSTGRES_PASSWORD: databasePassword,
    POSTGRES_DB: 'tixxin_blog',
  })
  start(names.pg, ['--env-file', pgEnv, '-v', `${names.volume}:/var/lib/postgresql/data`, 'postgres:16-alpine'])
  await until(
    () =>
      docker(['exec', names.pg, 'pg_isready', '-U', 'tixxin', '-d', 'tixxin_blog']).includes('accepting connections'),
    'PostgreSQL',
  )
  const migrationEnv = envFile('migration.env', { DATABASE_URL: databaseUrl })
  docker(['run', '--rm', '--network', names.network, '--env-file', migrationEnv, images.migration])

  const webEnv = envFile('web.env', {
    NUXT_API_BASE_URL: `http://${names.api}:3000/api/v1`,
    NUXT_PUBLIC_API_BASE_URL: '/api/v1',
    NUXT_PUBLIC_USE_MOCK_REPO: 'false',
    NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
    NUXT_PUBLIC_SITE_URL: 'https://smoke.invalid',
    NUXT_SITE_URL: 'https://smoke.invalid',
  })
  start(names.web, ['--env-file', webEnv, '-p', '127.0.0.1::3000', images.web])
  const origin = `http://${docker(['port', names.web, '3000/tcp'])}`
  const apiEnv = envFile('api.env', {
    DATABASE_URL: databaseUrl,
    JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
    CORS_ORIGIN: origin,
    LOG_LEVEL: 'silent',
    ADMIN_DEFAULT_PASSWORD: adminPassword,
  })
  start(names.api, ['--env-file', apiEnv, '-v', `${names.mediaVolume}:/app/var/media`, images.api])
  await until(
    async () => (await fetch(`${origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(2000) })).ok,
    '前端同源网关与后端',
  )

  for (const name of [names.api, names.web]) {
    const info = JSON.parse(
      docker([
        'exec',
        name,
        'node',
        '-e',
        'const fs=require("node:fs");console.log(JSON.stringify({uid:process.getuid(),env:fs.existsSync(".env.local"),mcp:fs.existsSync(".mcp.json")}))',
      ]),
    )
    assert.notEqual(info.uid, 0, '生产服务必须非 root 运行')
    assert.equal(info.env, false)
    assert.equal(info.mcp, false)
  }
  docker(['exec', '-e', 'ADMIN_DEFAULT_USERNAME=smoke-admin', names.api, 'node', 'dist/admin-bootstrap.js'])
  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ username: 'smoke-admin', password: adminPassword }),
  })
  assert.equal(login.status, 200)
  const cookie = login.headers.get('set-cookie') ?? ''
  assert(cookie.includes('HttpOnly') && cookie.includes('Secure'), '生产刷新 Cookie 必须 HttpOnly + Secure')
  const payload = await login.json()
  assert.equal(
    (await fetch(`${origin}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${payload.data.accessToken}` } }))
      .status,
    200,
  )
  const sample = docker([
    'exec',
    names.api,
    'node',
    '-e',
    "require('sharp')({create:{width:8,height:6,channels:3,background:'#3366cc'}}).png().toBuffer().then(data=>process.stdout.write(data.toString('base64')))",
  ])
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(sample, 'base64')], { type: 'image/png' }), 'container-sample.png')
  const uploaded = await fetch(`${origin}/api/v1/admin/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${payload.data.accessToken}`, Origin: origin },
    body: form,
  })
  assert.equal(uploaded.status, 201)
  const asset = (await uploaded.json()).data
  assert.equal((await fetch(`${origin}${asset.url}`)).headers.get('content-type'), 'image/webp')
  const fileOwner = docker([
    'exec',
    names.api,
    'node',
    '-e',
    `console.log(require('node:fs').statSync('/app/var/media/${asset.id}.webp').uid)`,
  ])
  assert.equal(fileOwner, '1000')
  docker(['rm', '-f', names.api])
  start(names.api, ['--env-file', apiEnv, '-v', `${names.mediaVolume}:/app/var/media`, images.api])
  await until(
    async () => (await fetch(`${origin}${asset.url}`, { signal: AbortSignal.timeout(2000) })).ok,
    '媒体卷在容器重建后保留',
  )
  const frontend = await fetch(origin)
  assert.equal(frontend.status, 200)
  assert((frontend.headers.get('content-security-policy') ?? '').includes("connect-src 'self'"))
  assert.equal((await fetch(`${origin}/_theme-engine-devtools`)).status, 404)
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text()
  assert(!sitemap.includes('/admin') && !sitemap.includes('_theme-engine-devtools'))
  assert((await (await fetch(`${origin}/rss.xml`)).text()).includes('https://smoke.invalid'))

  docker(['stop', '--time', '2', names.pg])
  const status = docker([
    'exec',
    names.api,
    'node',
    '-e',
    'fetch("http://127.0.0.1:3000/ready").then(r=>console.log(r.status)).catch(()=>process.exit(1))',
  ])
  assert.equal(status, '503')
  docker(['start', names.pg])
  await until(
    async () => (await fetch(`${origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(2000) })).ok,
    '数据库重启恢复',
  )
  docker(['restart', names.api])
  await until(
    async () => (await fetch(`${origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(2000) })).ok,
    '后端容器重启恢复',
  )
  let refusedMissingSecret = false
  try {
    docker(['run', '--rm', '--network', names.network, '--env-file', apiEnv, '-e', 'JWT_ACCESS_SECRET=', images.api])
  } catch (error) {
    refusedMissingSecret = String(error.stderr).includes('JWT_ACCESS_SECRET')
  }
  assert(refusedMissingSecret, '缺少签名密钥时必须拒绝启动')
  process.stdout.write(
    '容器验收通过：Linux 原生模块、非 root、秘密隔离、迁移、同源 API、生产 Cookie/CSP、调试页隔离、数据库故障与重启恢复\n',
  )
} finally {
  for (const name of createdContainers.reverse()) {
    assert(name.startsWith(prefix))
    try {
      docker(['rm', '-f', name])
    } catch {
      /* 仅清理本次测试创建的资源。 */
    }
  }
  if (volumeCreated) docker(['volume', 'rm', names.volume])
  if (mediaVolumeCreated) docker(['volume', 'rm', names.mediaVolume])
  if (networkCreated) docker(['network', 'rm', names.network])
  // directory 为本脚本 mkdtemp 的返回值，不使用外部传入的目录。
  const resolvedDirectory = realpathSync(directory)
  assert.equal(dirname(resolvedDirectory), temporaryRoot)
  assert(basename(resolvedDirectory).startsWith('tixxin-docker-smoke-'))
  rmSync(resolvedDirectory, { recursive: true, force: true })
}
