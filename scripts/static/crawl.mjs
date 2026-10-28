/**
 * @file crawl.mjs
 * @description 用真实浏览器访问静态发布的页面地址：录制阶段触发冻结接口取数，校验阶段确认没有缺失文件、
 *   失败请求、脚本错误或请求失败卡片。Playwright 取自前端子项目的依赖。
 */
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../src/frontend/web-blog/package.json', import.meta.url))

/** 并发访问页面，返回有问题的页面及其问题列表；ignore 为允许 404 的已知缺失地址 */
export async function crawl(base, urls, { concurrency = 4, timeout = 30000, ignore = new Set(), onProgress } = {}) {
  const { chromium } = require('@playwright/test')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  const origin = new URL(base).origin
  const problems = []
  let next = 0,
    done = 0
  async function visit(url) {
    const page = await context.newPage()
    const found = []
    page.on('response', (response) => {
      const path = response.url().startsWith(origin) ? new URL(response.url()).pathname : null
      // ignore 中是上游本身就缺失、页面已有降级展示的地址
      if (path && response.status() >= 400 && !ignore.has(path))
        found.push(`${response.status()} ${decodeURIComponent(path)}`)
    })
    page.on('requestfailed', (request) => {
      // 页面关闭或导航时组件卸载会主动中止在途请求，属预期；其余失败才算问题。
      const reason = request.failure()?.errorText ?? ''
      if (request.url().startsWith(origin) && reason !== 'net::ERR_ABORTED')
        found.push(`请求失败 ${request.url()}：${reason}`)
    })
    page.on('pageerror', (error) => found.push(`脚本错误 ${error.message}`))
    try {
      await page.goto(base + url, { waitUntil: 'networkidle', timeout })
      // 客户端取数失败不会抛错，只会显示请求失败卡片
      const alerts = await page
        .locator('.request-feedback [role="alert"]')
        .allInnerTexts()
        .catch(() => [])
      for (const text of alerts) found.push(`请求失败卡片：${text.trim().replace(/\s+/g, ' ')}`)
    } catch (error) {
      found.push(`打开失败：${error.message.split('\n')[0]}`)
    } finally {
      await page.close()
    }
    if (found.length) problems.push({ url, problems: [...new Set(found)] })
    onProgress?.(++done, urls.length)
  }
  async function worker() {
    while (next < urls.length) await visit(urls[next++])
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker))
  } finally {
    await browser.close()
  }
  return problems
}
