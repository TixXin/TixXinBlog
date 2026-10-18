#!/usr/bin/env node
/**
 * @file ci.mjs
 * @description Lighthouse 专用只读站点夹具与页面就绪检查，不访问数据库或创建管理员。
 * 用法：node scripts/lighthouse/ci.mjs serve-fixture | check-pages | --help
 * 服务及浏览器检查仅允许在 GitHub Actions 中运行；纯函数可独立验证。
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import config from '../../.lighthouserc.cjs'
import { SAFE_INITIAL_SITE_VALUES } from '../../src/backend/server-main/src/modules/site/initial-profile.ts'
import { defaultNavigation } from '../../src/frontend/web-blog/app/features/nav/routes.ts'
import { defaultFooterLinks, defaultQuotes } from '../../src/frontend/web-blog/app/features/site/footer.ts'

// 复用正式中性资料与导航契约，仅补充明确属于 CI 演示的自然内容；不修改应用默认值。
export const site = {
  ...SAFE_INITIAL_SITE_VALUES,
  name: '山间札记',
  description: '记录前端开发中的实践、阅读笔记与生活里的细小发现。',
  ownerName: '小林',
  ownerTitle: '记录技术与日常',
  presenceStatus: '',
  navigation: defaultNavigation(),
  footerLinks: defaultFooterLinks(),
  quotes: defaultQuotes(),
  icpNumber: '',
  icpUrl: '',
  copyright: '',
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/** 只接收两类匿名读取；未知接口和任何写入明确失败，防止吞掉新增 API 依赖。 */
export function fixtureResponse(method, url) {
  if (method !== 'GET') return { status: 405, body: { message: '夹具只允许 GET' } }
  const path = new URL(url, 'http://127.0.0.1:4174').pathname
  if (path === '/api/v1/site') return { status: 200, body: { code: 0, data: site } }
  if (path === '/api/v1/auth/session') return { status: 200, body: { code: 0, data: { authenticated: false } } }
  return { status: 404, body: { message: `未定义的夹具接口：${path}` } }
}

async function checkPages() {
  const origin = new URL(config.ci.collect.url[0]).origin
  // 等待真实同源转发就绪，不以进程输出或端口已监听代替 API 可读。
  let ready = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/v1/site`, { signal: AbortSignal.timeout(1000) })
      ready = response.ok && (await response.json()).data?.name === site.name
      if (ready) break
    } catch {
      // 启动中的连接拒绝只在有限次数内重试，最终失败保留 CI 日志。
    }
    await delay(1000)
  }
  assert.ok(ready, '生产前端的同源站点资料接口未就绪')

  const require = createRequire(new URL('../../src/frontend/web-blog/package.json', import.meta.url))
  const { chromium, expect } = require('@playwright/test')
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  const failures = []
  try {
    for (const url of config.ci.collect.url) {
      // 每页独立上下文，核验首次访问与闪念的客户端初始化，不给 Lighthouse 预填存储。
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      try {
        const page = await context.newPage()
        page.on('pageerror', (error) => failures.push(`${url}: ${error.message}`))
        page.on('response', (response) => {
          if (response.url().startsWith(`${origin}/api/v1/`) && response.status() >= 400) {
            failures.push(`${response.status()} ${response.url()}`)
          }
        })
        page.on('requestfailed', (request) => {
          if (request.url().startsWith(`${origin}/api/v1/`)) failures.push(`请求失败：${request.url()}`)
        })
        const response = await page.goto(url, { waitUntil: 'networkidle' })
        assert.equal(response?.status(), 200, `${url} 必须返回正常页面`)
        assert.equal(page.url(), url, `${url} 不得重定向成其他页面`)
        await expect(page.locator('html')).toHaveClass(/app-client-ready/)
        await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', site.name)
        const path = new URL(url).pathname
        if (path === '/') await expect(page.locator('.post-item').first()).toBeVisible()
        if (path.startsWith('/articles/')) {
          await expect(page.locator('.article-reading-content')).toBeVisible()
          await expect(page.locator('.article-reading-content')).toContainText('Vue')
        }
        if (path === '/flash') await expect(page.locator('article.fnc[id^="flash-note-"]').first()).toBeVisible()
        process.stdout.write(`页面就绪：${url}\n`)
      } finally {
        await context.close()
      }
    }
    assert.deepEqual(failures, [], '页面存在脚本错误或未满足的 API 依赖')
  } finally {
    await browser.close()
  }
}

if (import.meta.main) {
  const command = process.argv[2]
  if (command === '--help') {
    process.stdout.write('仅供 GitHub Actions：serve-fixture 启动只读夹具；check-pages 核验生产页面。\n')
  } else {
    assert.equal(process.env.GITHUB_ACTIONS, 'true', '只允许在 GitHub Actions 中启动 Lighthouse 夹具或页面检查')
    if (command === 'serve-fixture') {
      createServer((request, response) => {
        const result = fixtureResponse(request.method, request.url)
        if (result.status !== 200) process.stderr.write(`${request.method} ${request.url}: ${result.status}\n`)
        response.writeHead(result.status, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        response.end(JSON.stringify(result.body))
      }).listen(4174, '127.0.0.1', () => process.stdout.write('Lighthouse 只读夹具已就绪\n'))
    } else if (command === 'check-pages') {
      await checkPages()
    } else {
      throw new Error('未知命令；使用 --help 查看用法')
    }
  }
}
