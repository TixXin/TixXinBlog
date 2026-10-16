/**
 * @file navigation-performance.mjs
 * @description 隔离数据库、真实媒体及生产预览的三主题导航性能验收；可选短期 DevTools 对照，不构建共享产物
 * @example node src/backend/server-main/tests/navigation-performance.mjs --samples=28 --devtools-ab
 */
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { cpus, platform, release, loadavg } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { existsSync, lstatSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createBrowserTestApp } from './test-app.mjs'
import { seedGalleryBrowserFixture } from './gallery-fixture.mjs'
import { seedMomentBrowserFixture } from './moment-fixture.mjs'
import { seedGuestbookBrowserFixture } from './guestbook-fixture.mjs'
import { seedProjectBrowserFixture } from './project-fixture.mjs'
import { seedLinkBrowserFixture } from './link-fixture.mjs'
import { seedPromptBrowserFixture } from './prompt-fixture.mjs'
import { seedSubscriptionBrowserFixture } from './subscription-fixture.mjs'
import { getHttpTestPort } from './http-test-port.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const frontend = join(root, 'src/frontend/web-blog')
const require = createRequire(import.meta.url)
const frontendRequire = createRequire(join(frontend, 'package.json'))
const args = process.argv.slice(2)
assert(
  args.every((arg) => /^--samples=\d+$/.test(arg) || ['--devtools-ab', '--profile', '--help'].includes(arg)),
  '未知参数',
)
if (args.includes('--help')) {
  console.log(
    '使用已有生产构建：node src/backend/server-main/tests/navigation-performance.mjs [--samples=28] [--devtools-ab]\n独立归因：--profile 仅预热并录制Nexus首页↔朋友圈4轮，不运行DevTools对照；wrapper可设NAVIGATION_PERFORMANCE_PROFILE=true。归因耗时不与正式采样混算。',
  )
  process.exit(0)
}
const samples = Number(args.find((arg) => arg.startsWith('--samples='))?.split('=')[1] ?? 28)
const profileMode = args.includes('--profile') || process.env.NAVIGATION_PERFORMANCE_PROFILE === 'true'
assert(Number.isInteger(samples) && samples >= 20 && samples <= 200, '每个主题采样次数必须在 20–200 之间')
assert(existsSync(join(frontend, '.output/server/index.mjs')), '请先完成项目生产前端构建')
assert(existsSync(fileURLToPath(new URL('../dist/app.module.js', import.meta.url))), '请先完成后端构建')
const artifactRoot = join(root, '.artifacts/navigation-performance')
assert(!existsSync(artifactRoot) || !lstatSync(artifactRoot).isSymbolicLink(), '报告目录不能是符号链接')
await mkdir(artifactRoot, { recursive: true })
const output = await mkdtemp(join(artifactRoot, 'run-'))
// 开发生成模块需能向上解析frontend/node_modules；仍使用本次专属目录，不触及日常.nuxt。
const devRunRoot = join(frontend, '.artifacts/navigation-performance', basename(output))
const report = {
  completed: false,
  createdAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
  conditions: {
    node: process.version,
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    loadAverageAtStart: loadavg(),
    sourceNote: process.env.NAVIGATION_PERFORMANCE_SOURCE_NOTE ?? null,
    viewport: { width: 1440, height: 1000 },
    samplesPerTheme: profileMode ? 8 : samples,
    mode: profileMode ? '单独CPU/Timeline归因，存在采样开销，不与普通性能时间混算' : '完整路线性能采样',
    browser: 'Chromium headless；独立上下文；默认动效；不禁用浏览器缓存',
    timing: '原生 click 捕获至目标 Nuxt page:finish；其后继续观察450ms，包含完整入场和图片动画',
    requests: '请求窗口从准备真实点击开始，包含 hover 预取；transferSize 来自浏览器 Resource Timing，0可表示缓存',
    warmup: '每主题先走完固定路线一遍；不清 HTTP/OS 缓存；不宣称冷启动或线上收益',
    pointer: '真实点击完成后移开导航，避免持续悬停展开底栏覆盖下一次目标；不使用force点击',
    navigation: '通过三主题主导航NuxtLink与首页内容类型标签点击；站点页脚的原生文档链接不混入SPA采样',
    instrumentation: 'MutationObserver读取DOM数量，PerformanceObserver采集longtask；不保存凭据、响应正文或Cookie',
    thresholds: '只断言功能、隔离、样本与无快照；毫秒值仅报告，不设通用CI性能门槛',
    optionalResources:
      '仅订阅favicon缓存端点的404可按既有默认图标契约归类，保留全部URL/状态/数量并核对卡片回退；不代表零失败资源',
  },
  stages: [],
  cleanup: {
    children: [],
    databaseAbsent: false,
    mediaAbsent: false,
    backupAbsent: false,
    apiUnreachable: false,
    browserClosed: false,
  },
}
const children = []
let fixture
let browser
let interrupted = false
let verificationOptions
let mediaDirectory
let backupDirectory
let database
let restorePerformanceEnvironment
let restoreRateLimitProbe
const observedRateLimits = new Map()
function redactDiagnostic(value) {
  return String(value)
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/Bearer\s+[\w.+-]+/gi, 'Bearer [redacted]')
    .replace(/((?:DATABASE_URL|JWT_ACCESS_SECRET|PASSWORD|ACCESS_TOKEN)\s*[=:]\s*)[^\s,}]+/gi, '$1[redacted]')
}
const onSignal = () => {
  interrupted = true
  void browser?.close().catch(() => {})
  children.forEach(({ child }) => child.kill('SIGTERM'))
}
process.once('SIGINT', onSignal)
process.once('SIGTERM', onSignal)
function checkInterrupted() {
  if (interrupted) throw new Error('性能验收被中断，开始清理本次资源')
}
function spawnFrontend(mode, port, devtools) {
  const isDevelopment = mode.startsWith('development')
  const buildDir = join(devRunRoot, mode)
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(
    process.execPath,
    [
      isDevelopment
        ? fileURLToPath(new URL('./navigation-performance-dev.mjs', import.meta.url))
        : '.output/server/index.mjs',
    ],
    {
      cwd: frontend,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: isDevelopment ? 'development' : 'production',
        HOST: '127.0.0.1',
        PORT: String(port),
        NUXT_API_BASE_URL: `${fixture.origin}/api/v1`,
        NUXT_PUBLIC_API_BASE_URL: '/api/v1',
        NUXT_PUBLIC_SITE_URL: origin,
        NUXT_PUBLIC_USE_MOCK_REPO: 'false',
        NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
        NUXT_DEVTOOLS_ENABLED: String(devtools),
        NAVIGATION_PERFORMANCE_OUTPUT: output,
        NAVIGATION_PERFORMANCE_BUILD_DIR: buildDir,
        CI: 'true',
      },
    },
  )
  const item = { child, mode, origin, buildDir: isDevelopment ? buildDir : null, log: '', error: null, closed: false }
  child.once('error', (error) => {
    item.error = error.message
  })
  const capture = (chunk) => {
    item.log = (item.log + chunk.toString()).slice(-16000)
  }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  children.push(item)
  return item
}
async function stopFrontend(item) {
  if (item.closed) return
  const { child } = item
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((done) => child.once('exit', done))
    child.kill('SIGTERM')
    if (!(await Promise.race([exited.then(() => true), delay(5000).then(() => false)]))) {
      child.kill('SIGKILL')
      await exited
    }
  }
  let groupGone = true
  if (child.pid && process.platform !== 'win32') {
    const members = () => {
      const rows = execFileSync('ps', ['-axo', 'pid=,pgid=,uid='], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map((line) => line.trim().split(/\s+/).map(Number))
        .filter((row) => row[1] === child.pid)
      assert(
        rows.every((row) => row[2] === process.getuid()),
        '拒绝清理不属于当前用户的进程组成员',
      )
      return rows.map((row) => row[0])
    }
    // macOS可能在已结束进程组的负PID探测中返回EPERM；先只读确认所属成员，再清理明确的本次PID。
    for (const signal of ['SIGTERM', 'SIGKILL']) {
      const remaining = members()
      if (!remaining.length) break
      for (const pid of remaining) {
        try {
          process.kill(pid, signal)
        } catch (error) {
          if (error.code !== 'ESRCH') throw error
        }
      }
      for (let attempt = 0; attempt < 20 && members().length; attempt++) await delay(100)
    }
    groupGone = members().length === 0
  }
  assert(groupGone, '本次前端仍有未退出的进程组成员')
  let unreachable = false
  try {
    await fetch(`${item.origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(700) })
  } catch {
    unreachable = true
  }
  if (item.buildDir) {
    assert.equal(dirname(item.buildDir), devRunRoot)
    assert.equal(basename(devRunRoot), basename(output))
    await rm(item.buildDir, { recursive: true, force: true })
    await rmdir(devRunRoot).catch((error) => {
      if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error
    })
  }
  item.closed = true
  report.cleanup.children.push({
    mode: item.mode,
    pid: child.pid,
    exited: !child.pid || child.exitCode !== null || child.signalCode !== null,
    groupGone,
    unreachable,
    buildRemoved: !item.buildDir || !existsSync(item.buildDir),
    buildOwnerDirectoryRemoved: !item.buildDir || !existsSync(devRunRoot),
  })
  assert(unreachable, `本次${item.mode}端口清理后仍可访问`)
}
async function readyFrontend(item) {
  for (let attempt = 0; attempt < 180; attempt++) {
    checkInterrupted()
    if (item.error || item.child.exitCode !== null || item.child.signalCode !== null) break
    try {
      const response = await fetch(`${item.origin}/api/v1/posts?pageSize=1`, { signal: AbortSignal.timeout(1500) })
      if (response.ok && (await response.json()).data.total >= 2000) return
    } catch {
      /* 等待本次前端完成监听及同源代理。 */
    }
    await delay(500)
  }
  throw new Error(`${item.mode}前端未就绪：${item.error ?? item.log}`)
}

async function seedVolume() {
  const orm = fixture.testOrm
  database = orm.config.get('dbName')
  assert(/^tixxin_browser_\d+_\d+$/.test(database))
  assert.equal(new URL(process.env.DATABASE_URL).pathname.slice(1), database)
  mediaDirectory = process.env.MEDIA_DIRECTORY
  backupDirectory = fixture.backupOptions.backupRoot
  const { Post } = require('../dist/entities/post.entity.js')
  const { PostFolder } = require('../dist/entities/post-folder.entity.js')
  const { parsePostMarkdown } = require('../dist/modules/post/post-markdown.js')
  const em = orm.em.fork()
  const before = await em.count(Post, { status: 'published', deletedAt: null })
  em.create(PostFolder, { label: '四季札记' })
  for (let index = before; index < 2000; index++) {
    const contentRaw = `## 把日常留在文字里\n\n第 ${index + 1} 次整理走过的街巷和读过的书，也记下设计中的取舍。\n\n## 继续观察\n\n看清问题的来处，再决定下一步怎样走。`
    const publishedAt = new Date(Date.UTC(2017 + (index % 10), index % 12, (index % 27) + 1, 8, index % 60))
    em.create(Post, {
      title: `四季札记 ${String(index + 1).padStart(4, '0')}`,
      summary: '记录阅读、行走与软件设计中的细微发现。',
      folder: '四季札记',
      category: index % 2 ? 'life' : 'tech',
      readTimeMinutes: 2,
      contentRaw,
      contentSections: parsePostMarkdown(contentRaw),
      status: 'published',
      publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      views: index % 59,
      likes: index % 7,
      commentCount: 0,
      pinned: false,
    })
    if (index % 200 === 199) {
      await em.flush()
      em.clear()
    }
  }
  await em.flush()
  const gallery = await seedGalleryBrowserFixture(fixture)
  await seedMomentBrowserFixture(fixture)
  const { GalleryService } = require('../dist/modules/gallery/gallery.service.js')
  const service = new GalleryService(orm.em.fork())
  const media = await orm.em.fork().execute('select id from media_asset where deleted_at is null order by id')
  // 保留全部正式样本，再补齐第二个12张页面；媒体文件复用样本素材，不生成外链或占位图。
  for (let index = gallery.counts.published; index < 24; index++) {
    await service.save(null, {
      requestId: randomUUID(),
      mediaId: media[index % media.length].id,
      title: `光影拾记 ${index + 1}`,
      description: '重新观看熟悉的山色与街区，记录光线的变化。',
      category: '风景',
      status: 'published',
      sortOrder: 0,
    })
  }
  const [inventory] = await orm.em.fork().execute(`select
    (select count(*)::int from post where status='published' and deleted_at is null) posts,
    (select count(*)::int from gallery_photo where status='published' and deleted_at is null) photos,
    (select count(*)::int from gallery_photo where status='published' and deleted_at is null and (media_id is null or external_url is not null)) external_photos`)
  assert(inventory.posts >= 2000)
  assert.equal(inventory.photos, 24)
  assert.equal(inventory.external_photos, 0)
  report.inventory = {
    ...inventory,
    preservedFactoryPosts: before,
    database,
    mediaDirectory: basename(mediaDirectory),
    galleryPages: [],
  }
  for (const page of [1, 2]) {
    const response = await fetch(`${fixture.origin}/api/v1/gallery?page=${page}&pageSize=12`)
    assert.equal(response.status, 200)
    const payload = (await response.json()).data
    assert.equal(payload.items.length, 12)
    assert(payload.items.every((photo) => /^\/api\/v1\/media\//.test(photo.src)))
    report.inventory.galleryPages.push({
      page,
      ids: payload.items.map((photo) => photo.id),
      managedSources: [...new Set(payload.items.map((photo) => photo.src))],
    })
  }
  const sharp = require('sharp')
  report.inventory.media = []
  const sources = new Set(report.inventory.galleryPages.flatMap((page) => page.managedSources))
  for (const source of sources) {
    const response = await fetch(fixture.origin + source)
    assert.equal(response.status, 200)
    const buffer = Buffer.from(await response.arrayBuffer())
    const metadata = await sharp(buffer).metadata()
    assert(metadata.width > 0 && metadata.height > 0)
    report.inventory.media.push({
      source,
      status: 200,
      bytes: buffer.length,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    })
  }
  await seedGuestbookBrowserFixture(fixture)
  await seedProjectBrowserFixture(fixture)
  await seedLinkBrowserFixture(fixture)
  await seedPromptBrowserFixture(fixture)
  await seedSubscriptionBrowserFixture(fixture)
  // 闪念没有独立浏览器helper；沿用工厂实体写入模式补充真实记录，避免用空页代表正文渲染。
  const { FlashNote } = require('../dist/entities/flash-note.entity.js')
  const { SITE_OWNER_ID } = require('../dist/common/constants/site.js')
  const flashes = orm.em.fork()
  const notes = [
    '雨后的街道有一种安静的光，适合慢慢走。',
    '把今天读到的想法记下来，明天再看看是否仍然成立。',
    '给复杂的界面减去一个不必要的步骤，往往比再加一个按钮更有用。',
  ]
  for (let index = 0; index < 12; index++)
    flashes.create(FlashNote, {
      userId: SITE_OWNER_ID,
      content: `${notes[index % notes.length]}\n\n随手记 ${index + 1}`,
      type: 'memo',
      tags: ['随手记'],
      images: [],
      isPinned: index === 0,
      isDraft: false,
      isArchived: false,
      likes: 0,
      createdAt: new Date(Date.now() - index * 86400000),
      updatedAt: new Date(),
    })
  await flashes.flush()
  report.inventory.publicLists = []
  for (const domain of ['moments', 'flashes', 'guestbook', 'projects', 'links', 'prompts', 'subscriptions']) {
    const response = await fetch(`${fixture.origin}/api/v1/${domain}?pageSize=12`)
    assert.equal(response.status, 200)
    const data = (await response.json()).data
    assert(Array.isArray(data.items) && data.items.length > 0, `${domain}必须使用真实非空样本`)
    report.inventory.publicLists.push({ domain, visibleItems: data.items.length, total: data.total ?? null })
  }
  await orm.em.fork().execute('analyze post')
}

/** 在浏览器内安装只读观测；动画、请求、路由和页面数据均使用原实现。 */
async function installProbe(page) {
  await page.evaluate(() => {
    const app = document.getElementById('__nuxt').__vue_app__.$nuxt
    const router = app.$router
    const probe = {
      sample: null,
      sequence: 0,
      longtaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
    }
    window.navigationPerformance = probe
    const nodes = () => document.getElementsByTagName('*').length
    const cloneSelector = '[data-page-motion-clone],[data-page-motion-overlay],.sidebar-leaving-clone'
    document.addEventListener(
      'click',
      (event) => {
        const anchor = event.target.closest?.('a[href]')
        const sample = probe.sample
        if (!sample || sample.clickedAt || !anchor || new URL(anchor.href).pathname !== sample.target) return
        sample.clickedAt = performance.now()
        sample.initialDom = nodes()
        sample.peakDom = sample.initialDom
      },
      true,
    )
    new MutationObserver((records) => {
      const sample = probe.sample
      if (!sample?.clickedAt) return
      sample.peakDom = Math.max(sample.peakDom, nodes())
      for (const record of records)
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches(cloneSelector) || node.querySelector(cloneSelector)))
            sample.snapshots++
        }
    }).observe(document.body, { childList: true, subtree: true })
    if (probe.longtaskSupported)
      new PerformanceObserver((list) => {
        const sample = probe.sample
        if (!sample?.clickedAt) return
        for (const entry of list.getEntries())
          if (entry.startTime >= sample.clickedAt)
            sample.longtasks.push({ start: entry.startTime - sample.clickedAt, duration: entry.duration })
      }).observe({ entryTypes: ['longtask'] })
    const nativeAnimate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const sample = probe.sample
      if (sample?.clickedAt && this instanceof HTMLImageElement && this.closest(cloneSelector))
        sample.snapshotImageAnimations++
      return nativeAnimate.apply(this, args)
    }
    router.beforeEach(() => {
      if (probe.sample?.clickedAt) probe.sample.guardAt = performance.now()
    })
    router.afterEach(() => {
      if (probe.sample?.clickedAt) probe.sample.committedAt = performance.now()
    })
    app.hook('page:finish', () => {
      const sample = probe.sample
      if (sample?.clickedAt && router.currentRoute.value.path === sample.target && !sample.finishedAt) {
        sample.finishedAt = performance.now()
        sample.finishDom = nodes()
      }
    })
  })
}
function optionalFaviconMiss(request) {
  return (
    request.method === 'GET' &&
    request.resourceType === 'image' &&
    request.status === 404 &&
    !request.failure &&
    /^\/api\/v1\/subscriptions\/favicons\/[a-f0-9]{64}\.webp$/.test(request.url)
  )
}
async function navigate(page, target, network, records, phase = 'sample') {
  checkInterrupted()
  network.length = 0
  await page.evaluate((path) => {
    performance.clearResourceTimings()
    window.navigationPerformance.sample = {
      target: path,
      from: location.pathname,
      clickedAt: null,
      finishedAt: null,
      guardAt: null,
      committedAt: null,
      initialDom: 0,
      peakDom: 0,
      finishDom: 0,
      snapshots: 0,
      snapshotImageAnimations: 0,
      longtasks: [],
    }
  }, target)
  const navigation =
    target === '/moments'
      ? page.getByRole('navigation', { name: '内容类型', exact: true })
      : page.locator('.nexus-bar__nav,.aurora-topbar__nav,.dock-bar')
  await navigation.locator(`a[href="${target}"]:visible`).first().click()
  assert(await page.evaluate(() => Boolean(window.navigationPerformance)), '发生整页文档导航，不能混入SPA采样')
  await page.waitForFunction(() => window.navigationPerformance.sample?.finishedAt !== null, null, { timeout: 30000 })
  await page.mouse.move(1, 1)
  await page.waitForTimeout(450)
  const sample = await page.evaluate(() => {
    const probe = window.navigationPerformance
    const sample = probe.sample
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      url: new URL(entry.name).pathname + new URL(entry.name).search,
      initiator: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      duration: entry.duration,
      status: entry.responseStatus ?? null,
    }))
    const value = {
      from: sample.from,
      to: sample.target,
      clickToPageFinishMs: sample.finishedAt - sample.clickedAt,
      clickToGuardMs: sample.guardAt === null ? null : sample.guardAt - sample.clickedAt,
      guardToCommitMs: sample.committedAt === null ? null : sample.committedAt - sample.guardAt,
      commitToFinishMs: sample.committedAt === null ? null : sample.finishedAt - sample.committedAt,
      initialDom: sample.initialDom,
      peakDom: sample.peakDom,
      finishDom: sample.finishDom,
      archiveItems: sample.target === '/archive' ? document.querySelectorAll('.archive-item').length : null,
      snapshots: sample.snapshots,
      snapshotImageAnimations: sample.snapshotImageAnimations,
      longtasks: sample.longtasks,
      longtaskSupported: probe.longtaskSupported,
      resources,
      transferredBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
      defaultMotion: localStorage.getItem('tixxin-blog-appearance'),
    }
    probe.sample = null
    return value
  })
  // 保留请求记录引用，较晚到达的响应状态仍写回对应采样，不能把450ms内尚未完成的请求冻结成成功。
  sample.requests = [...network]
  sample.requestCount = sample.requests.length
  sample.phase = phase
  records?.push(sample)
  if (sample.to === '/archive') assert.equal(sample.archiveItems, 50, '大样本归档第一页必须实际渲染50条')
  sample.optionalResourceFailures = sample.requests.filter(optionalFaviconMiss)
  if (sample.optionalResourceFailures.length) {
    sample.subscriptionFallback = await page.evaluate(
      (missing) => {
        const app = document.getElementById('__nuxt').__vue_app__.$nuxt
        const value = app._asyncData['subscriptions-feed']?.data.value
        const cards = [...document.querySelectorAll('.subscription-list-item')]
        return {
          total: value?.page.total,
          stats: value?.stats,
          items: missing.map((url) => {
            const item = value?.page.items.find((entry) => (entry.iconUrl || entry.faviconUrl) === url)
            const card = cards.find((element) => element.getAttribute('aria-label') === item?.name)
            const icon = card?.querySelector('.subscription-list-icon')
            const bounds = icon?.firstElementChild?.getBoundingClientRect()
            return {
              url,
              name: item?.name,
              price: card?.querySelector('.subscription-list-price')?.textContent.trim(),
              defaultIcon: !!icon && !icon.querySelector('img') && !!bounds?.width && !!bounds?.height,
            }
          }),
        }
      },
      [...new Set(sample.optionalResourceFailures.map((entry) => entry.url))],
    )
    const fallback = sample.subscriptionFallback
    assert(
      fallback.items.every((item) => item.name && item.price && item.defaultIcon),
      '可选图标404必须已在对应真实卡片回退为默认图标',
    )
    assert(fallback.total > 0 && fallback.stats?.total === fallback.total, '订阅JSON与费用统计必须一致')
    assert(
      fallback.stats.currencies.some(
        (currency) => Number.isFinite(currency.monthlyAmount) && currency.monthlyAmount > 0,
      ),
      '真实订阅费用统计必须已显示',
    )
  }
  assert.equal(sample.snapshots, 0, '导航过程中出现正文或侧栏快照')
  assert.equal(sample.snapshotImageAnimations, 0, '导航快照重新播放图片入场')
  assert(
    sample.requests.every(
      (request) => optionalFaviconMiss(request) || (!request.failure && (!request.status || request.status < 400)),
    ),
    '导航存在失败请求',
  )
  return sample
}
const routes = [
  '/moments',
  '/',
  '/archive',
  '/projects',
  '/gallery',
  '/flash',
  '/links',
  '/guestbook',
  '/subscriptions',
  '/about',
  '/prompts',
  '/tabs',
  '/',
]
report.conditions.routeCycle = profileMode ? ['/', '/moments', '/'] : ['/', ...routes]
function aggregate(rows) {
  const values = rows.map((row) => row.clickToPageFinishMs).sort((a, b) => a - b)
  const percentile = (p) => values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)]
  return {
    samples: rows.length,
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    maximumMs: values.at(-1),
    longtasks: rows.reduce((sum, row) => sum + row.longtasks.length, 0),
    longtaskMs: rows.reduce((sum, row) => sum + row.longtasks.reduce((total, task) => total + task.duration, 0), 0),
    peakDom: Math.max(...rows.map((row) => row.peakDom)),
    requests: rows.reduce((sum, row) => sum + row.requestCount, 0),
    transferredBytes: rows.reduce((sum, row) => sum + row.transferredBytes, 0),
    optionalFavicon404: rows.reduce((sum, row) => sum + row.optionalResourceFailures.length, 0),
  }
}
async function recordProfile(page, context, result, network) {
  const session = await context.newCDPSession(page)
  const prefix = join(output, 'nexus-home-moments')
  const tracingComplete = new Promise((done) => session.once('Tracing.tracingComplete', done))
  await session.send('Profiler.enable')
  await session.send('Profiler.setSamplingInterval', { interval: 1000 })
  await session.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,v8',
    transferMode: 'ReturnAsStream',
    streamFormat: 'json',
  })
  await session.send('Profiler.start')
  try {
    for (let round = 0; round < 4; round++)
      for (const path of ['/moments', '/']) {
        await page.evaluate(({ round, path }) => performance.mark(`profile-navigation:${round}:${path}`), {
          round,
          path,
        })
        await navigate(page, path, network, result.samples, 'profile')
      }
  } finally {
    const { profile } = await session.send('Profiler.stop')
    await writeFile(`${prefix}.cpuprofile`, JSON.stringify(profile))
    result.cpuProfile = `${prefix}.cpuprofile`
    await session.send('Tracing.end')
    const trace = await Promise.race([tracingComplete, delay(10000).then(() => null)])
    assert(trace?.stream, 'Timeline必须完整结束并返回数据流')
    const chunks = []
    try {
      for (;;) {
        const chunk = await session.send('IO.read', { handle: trace.stream })
        chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8'))
        if (chunk.eof) break
      }
      await writeFile(`${prefix}.trace.json`, Buffer.concat(chunks))
      result.timelineTrace = `${prefix}.trace.json`
    } finally {
      await session.send('IO.close', { handle: trace.stream })
      await session.detach()
    }
  }
}
async function sampleStage(item) {
  const stage = { mode: item.mode, themes: [] }
  report.stages.push(stage)
  for (const theme of profileMode ? ['nexus'] : ['nexus', 'aurora', 'dock']) {
    const context = await browser.newContext({ viewport: report.conditions.viewport, reducedMotion: 'no-preference' })
    const network = []
    const httpErrors = []
    const result = {
      theme,
      runtime: null,
      warmups: [],
      samples: [],
      cacheProbes: [],
      cache: null,
      summary: null,
      byRoute: {},
      httpErrors,
    }
    stage.themes.push(result)
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: item.origin }])
      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const requests = new WeakMap()
      page.on('request', (request) => {
        const url = new URL(request.url())
        const record = {
          url: url.pathname + url.search,
          origin: url.origin,
          resourceType: request.resourceType(),
          method: request.method(),
          status: null,
          failure: null,
        }
        requests.set(request, record)
        network.push(record)
      })
      page.on('response', (response) => {
        const record = requests.get(response.request())
        if (record) record.status = response.status()
        if (response.status() >= 400) {
          const error = record ?? { url: new URL(response.url()).pathname, status: response.status() }
          httpErrors.push(error)
          void response.text().then(
            (body) => {
              error.responseBody = redactDiagnostic(body).slice(0, 4000)
            },
            () => {},
          )
        }
      })
      page.on('requestfailed', (request) => {
        const record = requests.get(request)
        if (record) record.failure = request.failure()?.errorText ?? 'failed'
      })
      await page.goto(item.origin)
      await page.locator('html.app-client-ready').waitFor()
      await page.locator('.articles-page .post-item').first().waitFor()
      if (item.mode === 'development-on') await page.waitForFunction(() => Boolean(window.__NUXT_DEVTOOLS_HOST__))
      const runtime = await page.evaluate(() => {
        const app = document.getElementById('__nuxt').__vue_app__.$nuxt
        return {
          mock: app.$config.public.useMockRepo,
          postMock: app.$config.public.postUseMockRepo,
          devtools: Boolean(window.__NUXT_DEVTOOLS_HOST__),
        }
      })
      assert.equal(runtime.mock, false)
      assert.equal(runtime.postMock, false)
      if (item.mode !== 'production') assert.equal(runtime.devtools, item.mode === 'development-on')
      result.runtime = runtime
      await installProbe(page)
      for (const path of profileMode ? ['/moments', '/'] : routes) {
        await navigate(page, path, network, result.warmups, 'warmup')
        if (path === '/archive')
          await page.screenshot({ path: join(output, `${item.mode}-${theme}-archive.png`), fullPage: true })
      }
      if (profileMode) {
        await recordProfile(page, context, result, network)
        result.summary = aggregate(result.samples)
        assert.deepEqual(errors, [], '归因采样不能忽略页面错误')
        assert(httpErrors.every(optionalFaviconMiss), '归因采样不能忽略核心HTTP错误')
        await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
        console.log(`独立CPU/Timeline已保存：${result.cpuProfile}`)
        continue
      }
      for (let index = 0; index < samples; index++)
        await navigate(page, routes[index % routes.length], network, result.samples)
      // 显式刷新必须绕过命中缓存；再次返回同一图库无需重复列表请求。
      if (new URL(page.url()).pathname !== '/gallery')
        await navigate(page, '/gallery', network, result.cacheProbes, 'cache')
      await page.waitForFunction(() => document.querySelectorAll('.gallery-grid .gallery-item').length === 12)
      const galleryImages = await page
        .locator('.gallery-grid img')
        .evaluateAll((images) => images.map((image) => image.getAttribute('src')))
      assert.equal(galleryImages.length, 12)
      assert(galleryImages.every((src) => src && src.includes('/api/v1/media/')))
      await navigate(page, '/flash', network, result.cacheProbes, 'cache')
      const cached = await navigate(page, '/gallery', network, result.cacheProbes, 'cache')
      const cachedLists = cached.requests.filter(
        (entry) => new URL(entry.url, item.origin).pathname === '/api/v1/gallery',
      )
      assert.equal(cachedLists.length, 0, '暖图库回访不应重复读取列表')
      network.length = 0
      await page.evaluate(async () => {
        const app = document.getElementById('__nuxt').__vue_app__.$nuxt
        await app._asyncData['gallery-feed'].execute({ cause: 'refresh:manual' })
      })
      const refreshRequests = network.filter((entry) => new URL(entry.url, item.origin).pathname === '/api/v1/gallery')
      assert(
        refreshRequests.some((entry) => entry.status === 200),
        '显式刷新必须请求真实图库 API',
      )
      result.cache = {
        cachedListRequests: cachedLists.length,
        refreshRequests,
        renderedPhotos: galleryImages.length,
        managedImagesOnly: true,
      }
      result.summary = aggregate(result.samples)
      for (const path of new Set(result.samples.map((sample) => sample.to)))
        result.byRoute[path] = aggregate(result.samples.filter((sample) => sample.to === path))
      assert.deepEqual(errors, [], '页面运行错误不能被性能结果掩盖')
      assert(httpErrors.every(optionalFaviconMiss), '核心API/受管媒体、其他HTTP错误（含429）必须失败')
      await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
      console.log(
        `${item.mode}/${theme}: ${samples} 次，median ${result.summary.medianMs.toFixed(1)}ms，p95 ${result.summary.p95Ms.toFixed(1)}ms，longtasks ${result.summary.longtasks}`,
      )
    } catch (error) {
      result.failedRequests = [...network]
      await context
        .pages()[0]
        ?.screenshot({ path: join(output, `${item.mode}-${theme}-failure.png`) })
        .catch(() => {})
      throw error
    } finally {
      await context.close()
    }
  }
}

try {
  const port = await getHttpTestPort()
  fixture = await createBrowserTestApp(`http://127.0.0.1:${port}`)
  // 工厂先在后端目录读取环境，并在切换隔离库之前缓存原连接配置；复用它做只读清理核验。
  verificationOptions = { ...require('../dist/config/mikro-orm.options.js').mikroOrmOptions, debug: false }
  await seedVolume()
  restorePerformanceEnvironment = fixture.useProductionEnvironmentForPerformance()
  const { RateLimitStore } = require('../dist/common/guards/rate-limit.guard.js')
  const originalConsume = RateLimitStore.prototype.consume
  RateLimitStore.prototype.consume = function (key, limit, windowMs, ...rest) {
    observedRateLimits.set(`${key.split(':')[0]}:${limit}:${windowMs}`, { scope: key.split(':')[0], limit, windowMs })
    return originalConsume.call(this, key, limit, windowMs, ...rest)
  }
  restoreRateLimitProbe = () => {
    RateLimitStore.prototype.consume = originalConsume
  }
  // 准备样本时使用工厂的1秒测试窗口；采样前让这些窗口自然结束，后续请求使用真实60秒配额。
  await delay(1100)
  report.conditions.rateLimit = { environment: 'production', windowMs: 60000, scopes: [] }
  const { chromium } = frontendRequire('@playwright/test')
  browser = await chromium.launch({ headless: true })
  report.conditions.browserVersion = browser.version()
  const variants = [{ mode: 'production', port, devtools: false }]
  if (args.includes('--devtools-ab') && !profileMode)
    variants.push(
      { mode: 'development-off', port: await getHttpTestPort(), devtools: false },
      { mode: 'development-on', port: await getHttpTestPort(), devtools: true },
    )
  for (const variant of variants) {
    checkInterrupted()
    const item = spawnFrontend(variant.mode, variant.port, variant.devtools)
    try {
      await readyFrontend(item)
      await sampleStage(item)
    } finally {
      await stopFrontend(item)
    }
  }
  report.conditions.rateLimit.scopes = [...observedRateLimits.values()]
  assert(report.conditions.rateLimit.scopes.length > 0)
  assert(
    report.conditions.rateLimit.scopes.every((scope) => scope.windowMs === 60000),
    '性能阶段必须使用真实60秒限流窗口',
  )
  report.completed = true
} catch (error) {
  report.error = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    actual: error.actual,
    expected: error.expected,
  }
  process.exitCode = 1
} finally {
  await browser?.close().catch(() => {})
  report.cleanup.browserClosed = !browser || !browser.isConnected()
  const cleanupErrors = []
  for (const item of children) {
    try {
      await stopFrontend(item)
    } catch (error) {
      cleanupErrors.push(error.message)
    }
    await writeFile(join(output, `${item.mode}.server.log`), redactDiagnostic(item.log))
  }
  if (report.conditions.rateLimit) report.conditions.rateLimit.scopes = [...observedRateLimits.values()]
  restoreRateLimitProbe?.()
  restorePerformanceEnvironment?.()
  try {
    await fixture?.close()
  } catch (error) {
    cleanupErrors.push(error.message)
  }
  report.cleanup.mediaAbsent = !mediaDirectory || !existsSync(mediaDirectory)
  report.cleanup.backupAbsent = !backupDirectory || !existsSync(backupDirectory)
  if (fixture) {
    try {
      await fetch(`${fixture.origin}/ready`, { signal: AbortSignal.timeout(700) })
    } catch {
      report.cleanup.apiUnreachable = true
    }
  }
  if (database && verificationOptions) {
    let audit
    try {
      const { MikroORM } = require('@mikro-orm/postgresql')
      audit = await MikroORM.init(verificationOptions)
      const rows = await audit.em
        .getConnection()
        .execute('select datname from pg_database where datname = ?', [database])
      report.cleanup.databaseAbsent = rows.length === 0
    } catch (error) {
      cleanupErrors.push(error.message)
    } finally {
      await audit?.close(true)
    }
  }
  report.cleanup.errors = cleanupErrors
  report.cleanup.completed =
    Boolean(fixture) &&
    report.cleanup.databaseAbsent &&
    report.cleanup.mediaAbsent &&
    report.cleanup.backupAbsent &&
    report.cleanup.apiUnreachable &&
    report.cleanup.browserClosed &&
    cleanupErrors.length === 0 &&
    report.cleanup.children.every(
      (child) =>
        child.exited && child.groupGone && child.unreachable && child.buildRemoved && child.buildOwnerDirectoryRemoved,
    )
  if (!report.cleanup.completed) {
    report.completed = false
    process.exitCode = 1
  }
  report.finishedAt = new Date().toISOString()
  report.conditions.loadAverageAtFinish = loadavg()
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
  process.off('SIGINT', onSignal)
  process.off('SIGTERM', onSignal)
  console.log(
    `导航验收报告：${join(output, 'report.json')}；资源清理：${report.cleanup.completed ? '已核验' : '未完成'}`,
  )
}
