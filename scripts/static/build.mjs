/**
 * @file build.mjs
 * @description 静态发布构建（docs/static-publish.md）：从运行中的真实后端读取公开数据，预渲染全部公开页面，
 *   用浏览器录制页面取数所需的冻结接口与媒体，写入托管平台配置，再以不回源的方式完整校验一遍。
 *   任何读取、预渲染或校验失败都让整次构建失败，不产出缺页或空列表的站点。
 *   用法：corepack pnpm static:build --site-url https://blog.example.com [--api http://127.0.0.1:3457/api/v1]
 *        [--locale zh-CN] [--theme nexus] [--out <输出目录，构建时会被清空>]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frozenAllKey, frozenApiFile } from '../../src/frontend/web-blog/app/features/static/frozenApi.ts'
import { securityHeaders } from '../../src/frontend/web-blog/securityHeaders.ts'
import { crawl } from './crawl.mjs'
import { mediaReferences, outputReport, pruneOutput, writeHostingFiles } from './finalize.mjs'
import { createApiReader, staticRoutes } from './routes.mjs'
import { startServer } from './serve.mjs'
import { staticVariants } from './variants.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const web = join(root, 'src/frontend/web-blog')
/** 浏览器内文本查询与未枚举组合的回退来源，与 app/features/static/textQuery.ts 的列表接口一致 */
export const LIST_SOURCES = [
  '/posts',
  '/flashes',
  '/moments',
  '/links',
  '/projects',
  '/prompts',
  '/gallery',
  '/subscriptions',
  '/guestbook',
]
/** EdgeOne 单项目文件数与单文件大小上限（docs/backlog.md 外部事实，部署前复核） */
const LIMITS = { files: 20000, fileBytes: 25 * 1024 * 1024 }

function options(argv) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name)
    return index === -1 ? fallback : argv[index + 1]
  }
  const siteUrl = value('--site-url', process.env.NUXT_PUBLIC_SITE_URL)
  if (!siteUrl || !/^https:\/\//.test(siteUrl))
    throw new Error('需要 --site-url https://<正式域名>，用于 canonical、站点地图与订阅源')
  const locale = value('--locale', 'zh-CN')
  if (!['zh-CN', 'en'].includes(locale)) throw new Error('--locale 只接受 zh-CN 或 en')
  return {
    api: value('--api', 'http://127.0.0.1:3457/api/v1').replace(/\/$/, ''),
    siteUrl: siteUrl.replace(/\/$/, ''),
    locale,
    theme: value('--theme', 'nexus'),
    out: resolve(value('--out', join(web, '.output-static'))),
  }
}

function run(command, args, env) {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: web, env: { ...process.env, ...env }, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} ${args.join(' ')} 退出码 ${code}`))))
  })
}

const step = (text) => process.stdout.write(`\n▶ ${text}\n`)
const progress = (label) => (done, total) => {
  if (done === total || done % 50 === 0) process.stdout.write(`  ${label} ${done}/${total}\n`)
}

/** 录制服务器上请求一个冻结键或静态文件，失败即中止构建 */
async function fetchThrough(base, path, key) {
  const response = await fetch(base + path, key ? { headers: { 'x-static-source': key } } : undefined)
  if (!response.ok) throw new Error(`录制 ${key ?? path} 失败：HTTP ${response.status}`)
}

async function record(publicDir, config, pages) {
  const misses = []
  const server = await startServer({
    root: publicDir,
    port: 0,
    record: config.api,
    locale: config.locale,
    onMiss: (miss) => misses.push(miss),
  })
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    step('录制列表全量（文本查询与未枚举组合的回退来源）')
    for (const source of LIST_SOURCES)
      await fetchThrough(base, frozenApiFile(frozenAllKey(source)), frozenAllKey(source))
    step(`浏览器录制页面取数（${pages.length} 个地址）`)
    await crawl(base, pages, { onProgress: progress('录制') })
    const media = mediaReferences(publicDir)
    step(`导出受管媒体与订阅图标（${media.length} 个文件）`)
    // 订阅图标是从平台抓取的缓存，上游失效时服务器部署同样返回 404，页面会改用 Lucide 图标；受管媒体缺失仍然失败。
    const upstreamMissing = []
    for (const path of media) {
      const response = await fetch(base + path)
      if (response.ok) continue
      if (response.status === 404 && path.startsWith('/api/v1/subscriptions/favicons/')) upstreamMissing.push(path)
      else throw new Error(`导出 ${path} 失败：HTTP ${response.status}`)
    }
    return { misses, upstreamMissing }
  } finally {
    await new Promise((done) => server.close(done))
  }
}

async function verify(publicDir, pages, ignore) {
  const misses = []
  const server = await startServer({ root: publicDir, port: 0, onMiss: (miss) => misses.push(miss) })
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    step(`不回源校验（${pages.length} 个地址）`)
    const problems = await crawl(base, pages, { ignore, onProgress: progress('校验') })
    return { problems, misses }
  } finally {
    await new Promise((done) => server.close(done))
  }
}

export async function buildStaticSite(config) {
  step(`读取公开数据：${config.api}`)
  // 站点导航、器材等数据中引用的 Lucide 图标需要在构建时打进客户端包
  const icons = new Set()
  const reader = createApiReader(config.api)
  const read = async (path) => {
    const data = await reader(path)
    for (const match of JSON.stringify(data).matchAll(/lucide:[a-z0-9-]+/g)) icons.add(match[0])
    return data
  }
  await read('/site')
  const routes = await staticRoutes(read)
  const variants = await staticVariants(read)
  const pages = [...routes.filter((route) => !/\.[a-z]+$/.test(route)), ...variants]
  // Nitro 构建开始时会清空输出目录，地址清单放在临时目录
  const routesFile = join(mkdtempSync(join(tmpdir(), 'static-publish-')), 'routes.json')
  writeFileSync(routesFile, JSON.stringify({ routes }, null, 2))

  step(`预渲染 ${routes.length} 个地址（主题 ${config.theme}，语言 ${config.locale}）`)
  for (const directory of [join(web, '.nuxt-static'), join(config.out, 'public')])
    rmSync(directory, { recursive: true, force: true })
  await run('corepack', ['pnpm', 'exec', 'nuxt', 'generate', '--envName', 'static-publish'], {
    STATIC_ROUTES_FILE: routesFile,
    STATIC_OUTPUT_DIR: config.out,
    STATIC_LAYOUT_THEME: config.theme,
    NUXT_API_BASE_URL: config.api,
    NUXT_PUBLIC_SITE_URL: config.siteUrl,
    NUXT_PUBLIC_DEFAULT_LOCALE: config.locale,
    STATIC_ICONS: [...icons].join(','),
  })
  mkdirSync(config.out, { recursive: true })
  const publicDir = join(config.out, 'public')
  const recorded = await record(publicDir, config, pages)

  step('写入托管配置')
  pruneOutput(publicDir)
  writeHostingFiles(publicDir, securityHeaders(true))
  // 录制清单只用于排查，不随站点发布
  const manifest = join(publicDir, '_api', 'manifest.json')
  if (existsSync(manifest)) renameSync(manifest, join(config.out, 'frozen-api-manifest.json'))

  const { problems, misses } = await verify(publicDir, pages, new Set(recorded.upstreamMissing))
  const report = {
    ...outputReport(publicDir),
    pages: pages.length,
    upstreamMissing: recorded.upstreamMissing,
    recordMisses: recorded.misses,
    problems,
    misses,
  }
  for (const path of recorded.upstreamMissing) process.stdout.write(`  ! 上游已失效、页面改用默认图标：${path}\n`)
  writeFileSync(join(config.out, 'static-report.json'), JSON.stringify(report, null, 2))
  step('产物')
  process.stdout.write(
    `  ${report.files} 个文件，${(report.bytes / 1048576).toFixed(1)}MB，最大 ${report.largest.path}（${(report.largest.bytes / 1024).toFixed(0)}KB）\n`,
  )
  const failures = []
  if (problems.length) failures.push(`${problems.length} 个页面校验未通过`)
  if (report.files > LIMITS.files) failures.push(`文件数 ${report.files} 超过 ${LIMITS.files}`)
  if (report.largest.bytes > LIMITS.fileBytes) failures.push(`单文件 ${report.largest.path} 超过 25MB`)
  if (failures.length) {
    for (const item of problems.slice(0, 20))
      process.stderr.write(`  ${item.url}\n    ${item.problems.join('\n    ')}\n`)
    throw new Error(`${failures.join('；')}，详见 ${join(config.out, 'static-report.json')}`)
  }
  process.stdout.write(`\n静态站点已生成：${publicDir}\n`)
  return report
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildStaticSite(options(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`\n✗ 静态发布构建失败：${error.message}\n`)
    process.exitCode = 1
  })
}
