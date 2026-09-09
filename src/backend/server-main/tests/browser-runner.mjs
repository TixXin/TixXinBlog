/**
 * @file browser-runner.mjs
 * @description 启动隔离数据库、后端和生产前端执行浏览器测试，不操作日常开发数据库
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve, sep } from 'node:path'
import { readdirSync, existsSync, lstatSync } from 'node:fs'
import { createBrowserTestApp } from './test-app.mjs'
import { seedMomentBrowserFixture } from './moment-fixture.mjs'

const frontendDirectory = fileURLToPath(new URL('../../../frontend/web-blog/', import.meta.url))
// 每份完整测试文件使用自己的数据库，避免管理用例新增内容污染固定样本的展示验收。
if (process.argv.length === 2) {
  const files = readdirSync(join(frontendDirectory, 'tests/e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .sort()
  if (files.length > 1) {
    const outputRoot = resolve(frontendDirectory, '../../../.playwright-mcp/e2e-results')
    if (existsSync(outputRoot) && lstatSync(outputRoot).isSymbolicLink()) throw new Error('测试输出不能是符号链接')
    const run = `isolated-${Date.now()}-${process.pid}`
    let code = 0
    for (const file of files) {
      const name = file.replace(/[^a-zA-Z0-9_.-]/g, '_')
      const output = resolve(outputRoot, run, name)
      if (!output.startsWith(outputRoot + sep)) throw new Error('测试输出目录越界')
      const child = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), '--isolated-spec', file, '--output', output],
        { windowsHide: true, stdio: 'inherit', env: process.env },
      )
      const result = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', resolve)
      })
      if (result !== 0) code = Number(result ?? 1)
    }
    process.exit(code)
  }
}
if (process.argv[2] === '--isolated-spec') process.argv.splice(2, 1)
const listener = createServer()
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise((resolve) => listener.close(resolve))
const origin = `http://127.0.0.1:${port}`
const fixture = await createBrowserTestApp(origin)
let preview
let previewLog = ''
try {
  await seedMomentBrowserFixture(fixture)
  preview = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: frontendDirectory,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      NUXT_API_BASE_URL: `${fixture.origin}/api/v1`,
      NUXT_PUBLIC_API_BASE_URL: '/api/v1',
      NUXT_PUBLIC_USE_MOCK_REPO: 'false',
      NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
    },
  })
  const capture = (chunk) => {
    previewLog = (previewLog + chunk.toString()).slice(-12000)
  }
  preview.stdout.on('data', capture)
  preview.stderr.on('data', capture)
  let ready = false
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) break
    try {
      ready = (await fetch(`${origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(1000) })).ok
    } catch {
      /* 等待刚启动的预览服务。 */
    }
    if (ready) break
    await delay(500)
  }
  if (!ready) throw new Error(`生产预览未能启动：${previewLog}`)
  const forwarded = process.argv.slice(2)
  if (!forwarded.some((value) => value === '--output' || value.startsWith('--output='))) {
    const root = resolve(frontendDirectory, '../../../.playwright-mcp/e2e-results')
    if (existsSync(root) && lstatSync(root).isSymbolicLink()) throw new Error('测试输出不能是符号链接')
    const output = resolve(root, `selection-${Date.now()}-${process.pid}`)
    if (!output.startsWith(root + sep)) throw new Error('测试输出目录越界')
    forwarded.push('--output', output)
  }
  const tests = spawn(
    process.execPath,
    [
      join(frontendDirectory, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config=playwright.config.ts',
      ...forwarded,
    ],
    {
      cwd: frontendDirectory,
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_ISOLATED: 'true',
        E2E_BASE_URL: origin,
        E2E_USERNAME: fixture.username,
        E2E_PASSWORD: fixture.password,
        E2E_ACCOUNT_USERNAME: fixture.accountUsername,
        E2E_MEDIA_SAMPLE: fixture.mediaSample,
      },
    },
  )
  const exitCode = await new Promise((resolve, reject) => {
    tests.once('error', reject)
    tests.once('exit', resolve)
  })
  if (exitCode !== 0) process.exitCode = Number(exitCode ?? 1)
} finally {
  if (preview && preview.exitCode === null && preview.signalCode === null) {
    preview.kill()
    await new Promise((resolve) => preview.once('exit', resolve))
  }
  await fixture.close()
}
