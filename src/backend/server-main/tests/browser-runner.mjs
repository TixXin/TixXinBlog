/**
 * @file browser-runner.mjs
 * @description 启动隔离数据库、后端和生产前端执行浏览器测试，不操作日常开发数据库
 */
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { join, resolve, sep } from 'node:path'
import { readdirSync, existsSync, lstatSync, readFileSync } from 'node:fs'
import { createBrowserTestApp } from './test-app.mjs'
import { seedMomentBrowserFixture } from './moment-fixture.mjs'
import { seedGuestbookBrowserFixture } from './guestbook-fixture.mjs'
import { seedGalleryBrowserFixture } from './gallery-fixture.mjs'
import { seedProjectBrowserFixture } from './project-fixture.mjs'
import { seedLinkBrowserFixture } from './link-fixture.mjs'
import { seedPromptBrowserFixture } from './prompt-fixture.mjs'
import { seedSubscriptionBrowserFixture } from './subscription-fixture.mjs'
import { getHttpTestPort } from './http-test-port.mjs'

const frontendDirectory = fileURLToPath(new URL('../../../frontend/web-blog/', import.meta.url))

/** 列出全部端到端测试文件，按文件名排序保证各处顺序一致。 */
function listSpecFiles() {
  return readdirSync(join(frontendDirectory, 'tests/e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .sort()
}

/**
 * 按权重表把测试文件确定性地分成 total 片：权重从大到小依次放入当前合计最小的分片（最长处理时间优先）。
 * 权重表未收录的新文件取已收录权重的中位数，保证新增文件一定被分配。
 */
function planShards(files, total) {
  const table = JSON.parse(readFileSync(join(frontendDirectory, 'tests/e2e/shard-weights.json'), 'utf8')).seconds
  const known = Object.values(table)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
  const middle = Math.floor(known.length / 2)
  const median = known.length === 0 ? 1 : known.length % 2 ? known[middle] : (known[middle - 1] + known[middle]) / 2
  const weightOf = (file) => (Number.isFinite(table[file]) && table[file] > 0 ? table[file] : median)
  const shards = Array.from({ length: total }, (_, index) => ({ shard: index + 1, weight: 0, files: [] }))
  const ordered = [...files].sort((a, b) => weightOf(b) - weightOf(a) || (a < b ? -1 : a > b ? 1 : 0))
  for (const file of ordered) {
    // 合计相同时取编号最小的分片，结果只取决于文件清单和权重表。
    const target = shards.reduce((best, item) => (item.weight < best.weight ? item : best))
    target.files.push(file)
    target.weight += weightOf(file)
  }
  for (const item of shards) item.files.sort()
  return shards
}

/** 解析分片总数或 i/n 形式的分片编号，格式错误直接失败，避免静默跑全量或空跑。 */
function parseShardCount(value, source) {
  if (!/^[1-9]\d*$/.test(value ?? '')) throw new Error(`${source} 必须是正整数：${value ?? ''}`)
  return Number(value)
}

if (process.argv[2] === '--list-shards') {
  const total = parseShardCount(process.argv[3], '--list-shards')
  process.stdout.write(`${JSON.stringify(planShards(listSpecFiles(), total), null, 2)}\n`)
  process.exit(0)
}

// 每份完整测试文件使用自己的数据库，避免管理用例新增内容污染固定样本的展示验收。
if (process.argv.length === 2) {
  let files = listSpecFiles()
  let runSuffix = ''
  const shardSetting = process.env.E2E_SHARD
  if (shardSetting !== undefined && shardSetting !== '') {
    const match = /^(\d+)\/(\d+)$/.exec(shardSetting)
    if (!match) throw new Error(`E2E_SHARD 格式应为 i/n：${shardSetting}`)
    const total = parseShardCount(match[2], 'E2E_SHARD 分片总数')
    const index = parseShardCount(match[1], 'E2E_SHARD 分片编号')
    if (index > total) throw new Error(`E2E_SHARD 分片编号超出总数：${shardSetting}`)
    const shard = planShards(files, total)[index - 1]
    files = shard.files
    runSuffix = `-s${index}of${total}`
    console.log(`E2E 分片 ${index}/${total}：${files.length} 个文件，预计 ${Math.round(shard.weight)} 秒`)
    for (const file of files) console.log(`  ${file}`)
  }
  // 分片后即使只剩一个文件也走独立进程，产物目录同样带分片号。
  if (files.length > 1 || runSuffix) {
    const outputRoot = resolve(frontendDirectory, '../../../.playwright-mcp/e2e-results')
    if (existsSync(outputRoot) && lstatSync(outputRoot).isSymbolicLink()) throw new Error('测试输出不能是符号链接')
    const run = `isolated-${Date.now()}-${process.pid}${runSuffix}`
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
const port = await getHttpTestPort()
const origin = `http://127.0.0.1:${port}`
const fixture = await createBrowserTestApp(origin)
let preview
let previewLog = ''
try {
  await seedMomentBrowserFixture(fixture)
  await seedGuestbookBrowserFixture(fixture)
  await seedGalleryBrowserFixture(fixture)
  await seedProjectBrowserFixture(fixture)
  await seedLinkBrowserFixture(fixture)
  await seedPromptBrowserFixture(fixture)
  await seedSubscriptionBrowserFixture(fixture)
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
      // 每次独立预览覆盖构建默认域名，验证部署时 canonical、RSS 和 sitemap 同源。
      NUXT_PUBLIC_SITE_URL: origin,
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
