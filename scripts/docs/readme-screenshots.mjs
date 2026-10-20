#!/usr/bin/env node
/**
 * @file readme-screenshots.mjs
 * @description 生成 README 截图：同一页面在 2560×1440 视口下分别截浅色与深色，再合成为左上浅色、右下深色的对角线分割图，
 *              写入 docs/assets/screenshots/nexus-{home,moments,article,mobile}.jpg。只生成图片，不改动 Git。
 *              默认在 .artifacts 下用当前 HEAD 单独构建生产前端，不受工作区未提交改动和开发调试按钮影响，并复用 dev:all 的 API 与演示数据。
 *              用法：corepack pnpm docs:screenshots [--base-url <站点地址>] [--api <API 地址>] [--out <目录>] [--keep]
 *                --base-url  直接截已在运行的站点，跳过构建
 *                --api       演示数据所在的 API，默认 http://127.0.0.1:3457/api/v1（dev:all 的后端）
 *                --out       输出目录，默认 docs/assets/screenshots（试跑或对比时可指向临时目录）
 *                --keep      保留构建工作树与原始截图，便于排查
 * @author TixXin
 * @since 2026-10-21
 */
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, openSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const work = join(root, '.artifacts/readme-screenshots')
const desktop = { width: 2560, height: 1440, dpr: 1 }
const phone = { width: 390, height: 844, dpr: 3, mobile: true }

const options = {
  baseUrl: '',
  api: 'http://127.0.0.1:3457/api/v1',
  out: join(root, 'docs/assets/screenshots'),
  keep: false,
}
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--keep') options.keep = true
  else if (arg === '--base-url') options.baseUrl = process.argv[++i] ?? ''
  else if (arg === '--api') options.api = process.argv[++i] ?? ''
  else if (arg === '--out') options.out = process.argv[++i] ?? ''
  else if (arg === '-h' || arg === '--help') {
    console.log(
      '用法：corepack pnpm docs:screenshots [--base-url <站点地址>] [--api <API 地址>] [--out <目录>] [--keep]',
    )
    process.exit(0)
  } else throw new Error(`未知参数 ${arg}`)
}

const { chromium } = createRequire(join(root, 'src/frontend/web-blog/package.json'))('@playwright/test')
const log = (message) => console.log(`[screenshots] ${message}`)
const cleanups = []

function run(command, args, cwd, logName) {
  const file = join(work, logName)
  const fd = openSync(file, 'w')
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', fd, fd] })
  } catch {
    throw new Error(`${command} ${args.join(' ')} 失败，日志见 ${file}`)
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* 服务尚未就绪 */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`${url} 在 ${timeoutMs / 1000} 秒内没有就绪`)
}

/** 演示数据来自 API：取第一篇文章作为文章页截图对象，避免写死编号 */
async function firstPostId() {
  try {
    const response = await fetch(`${options.api}/posts?page=1&pageSize=1`)
    const item = (await response.json()).data?.items?.[0]
    if (response.ok && item) return item.slug || item.id
  } catch {
    /* 下面统一报错 */
  }
  throw new Error(`无法从 ${options.api} 读取文章；请先运行 corepack pnpm dev:all 并准备演示数据`)
}

/** 在独立工作树中用当前 HEAD 构建生产前端并启动预览，退出时停止进程并删除工作树 */
async function startPreview() {
  const tree = join(work, 'worktree')
  if (existsSync(tree)) execFileSync('git', ['worktree', 'remove', '--force', tree], { cwd: root })
  execFileSync('git', ['worktree', 'add', '--detach', tree, 'HEAD'], { cwd: root, stdio: 'ignore' })
  if (!options.keep) cleanups.push(() => execFileSync('git', ['worktree', 'remove', '--force', tree], { cwd: root }))
  log(
    `构建 ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim()} 的生产前端（约 3 分钟）`,
  )
  run('corepack', ['pnpm', 'install', '--frozen-lockfile', '--prefer-offline'], tree, 'install.log')
  const env = join(root, 'src/frontend/web-blog/.env')
  if (existsSync(env)) copyFileSync(env, join(tree, 'src/frontend/web-blog/.env'))
  run('corepack', ['pnpm', 'build'], tree, 'build.log')
  const port = await freePort()
  const baseUrl = `http://localhost:${port}`
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: join(tree, 'src/frontend/web-blog'),
    stdio: ['ignore', openSync(join(work, 'preview.log'), 'w'), 'inherit'],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NUXT_API_BASE_URL: options.api,
      NUXT_PUBLIC_API_BASE_URL: '/api/v1',
      NUXT_PUBLIC_SITE_URL: baseUrl,
      NUXT_PUBLIC_USE_MOCK_REPO: 'false',
      NUXT_PUBLIC_POST_USE_MOCK_REPO: 'false',
    },
  })
  cleanups.unshift(() => server.kill())
  await waitFor(`${baseUrl}/`, 60_000)
  return baseUrl
}

async function capture(browser, baseUrl, name, path, size) {
  for (const mode of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.dpr,
      isMobile: Boolean(size.mobile),
      hasTouch: Boolean(size.mobile),
      locale: 'zh-CN',
      colorScheme: mode,
      reducedMotion: 'reduce',
    })
    await context.addInitScript((value) => {
      try {
        localStorage.setItem('nuxt-color-mode', value)
      } catch {
        /* 隐私模式下写入失败时沿用 colorScheme */
      }
    }, mode)
    const page = await context.newPage()
    await page.goto(baseUrl + path, { waitUntil: 'load', timeout: 90_000 })
    await page.waitForTimeout(4000)
    // 等可见区域内的图片加载完成，避免封面显示为占位图
    const missing = await page.evaluate(async () => {
      // 除视口外还要扣掉滚动容器的裁剪：列表容器之外的图片按懒加载不会请求，也不会出现在截图里
      const shown = (image) => {
        let { top, bottom, left, right } = image.getBoundingClientRect()
        if (right - left <= 0) return false
        for (let node = image.parentElement; node; node = node.parentElement) {
          if (getComputedStyle(node).overflow === 'visible') continue
          const clip = node.getBoundingClientRect()
          ;[top, bottom, left, right] = [
            Math.max(top, clip.top),
            Math.min(bottom, clip.bottom),
            Math.max(left, clip.left),
            Math.min(right, clip.right),
          ]
        }
        return bottom > Math.max(top, 0) && top < innerHeight && right > left
      }
      const visible = [...document.images].filter(shown)
      const loads = visible.map((image) =>
        image.complete ? null : new Promise((resolve) => (image.onload = image.onerror = resolve)),
      )
      await Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 15_000))])
      return visible
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || image.alt)
    })
    // 截已运行的开发站点时隐藏调试按钮与预览角标
    await page.addStyleTag({ content: '.dev-debug-fab,.dev-preview-badge{display:none!important}' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(work, `${name}-${mode}.png`) })
    if (missing.length) log(`警告：${name}（${mode}）有 ${missing.length} 张可见图片未加载：${missing.join('，')}`)
    await context.close()
  }
}

/** 浅色铺底、深色按对角线裁出右下部分，分界处加一条细白线 */
async function compose(browser, name, size) {
  const width = size.width * size.dpr
  const height = size.height * size.dpr
  const [top, bottom] = size.mobile ? [100, 0] : [62, 38]
  const html = join(work, `${name}-split.html`)
  writeFileSync(
    html,
    `<!doctype html><body style="margin:0"><div style="position:relative;width:${width}px;height:${height}px;overflow:hidden">
<img src="${name}-light.png" style="position:absolute;inset:0;width:100%;height:100%">
<img src="${name}-dark.png" style="position:absolute;inset:0;width:100%;height:100%;clip-path:polygon(${top}% 0,100% 0,100% 100%,${bottom}% 100%)">
<svg width="${width}" height="${height}" style="position:absolute;inset:0"><line x1="${(width * top) / 100}" y1="0" x2="${(width * bottom) / 100}" y2="${height}" stroke="rgba(255,255,255,0.85)" stroke-width="${size.mobile ? 4 : 2}"/></svg>
</div></body>`,
  )
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`file://${html}`)
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
  const target = join(options.out, `nexus-${name}.jpg`)
  await page.screenshot({ path: target, type: 'jpeg', quality: 90 })
  await page.close()
  log(
    `${target.startsWith(root) ? target.slice(root.length + 1) : target}  ${width}×${height}  ${Math.round(statSync(target).size / 1024)} KB`,
  )
}

async function main() {
  mkdirSync(work, { recursive: true })
  mkdirSync(options.out, { recursive: true })
  const article = await firstPostId()
  const baseUrl = options.baseUrl || (await startPreview())
  log(`截图站点 ${baseUrl}`)
  const browser = await chromium.launch()
  cleanups.unshift(() => browser.close())
  const pages = [
    ['home', '/', desktop],
    ['moments', '/moments', desktop],
    ['article', `/articles/${article}`, desktop],
    ['mobile', '/', phone],
  ]
  for (const [name, path, size] of pages) {
    await capture(browser, baseUrl, name, path, size)
    await compose(browser, name, size)
  }
  log('完成：检查 docs/assets/screenshots 下的图片后再提交')
}

async function cleanup() {
  for (const task of cleanups.splice(0)) {
    try {
      await task()
    } catch {
      /* 清理尽力而为 */
    }
  }
  if (!options.keep) rmSync(work, { recursive: true, force: true })
}

process.once('SIGINT', () => cleanup().then(() => process.exit(130)))
try {
  await main()
} catch (error) {
  console.error(`[screenshots] 失败：${error.message}`)
  process.exitCode = 1
} finally {
  await cleanup()
}
