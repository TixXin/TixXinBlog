/**
 * @file theme-persistence.spec.ts
 * @description 布局主题持久化回归：水合期不覆盖 SSR 决策、localStorage 偏好恢复后写入持久 cookie、
 *              ?theme= 只做首屏预览不落盘。需要隔离后端 + PostgreSQL + 生产构建（corepack pnpm test:e2e）。
 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

const THEME_COOKIE = 'blog-layout-theme'
const STORAGE_KEY = 'theme-engine:storage'

/** 收集水合不一致与运行时异常，生产构建下 Vue 仍会在控制台报告 hydration mismatch */
function watchIssues(page: Page) {
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (/hydration|mismatch|TypeError|ReferenceError|Unhandled/i.test(message.text())) issues.push(message.text())
  })
  return issues
}

/** 取服务端直出 HTML（不执行脚本），用于核对 SSR 决策与首屏根布局 */
async function serverHtml(request: APIRequestContext, path = '/') {
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  return response.text()
}

function ssrTheme(html: string) {
  return /<html[^>]*\sdata-theme="([^"]+)"/.exec(html)?.[1]
}

function rootTheme(html: string) {
  return /class="page-root theme-([a-z-]+)/.exec(html)?.[1]
}

/** 等待水合完成并稳定到目标主题，同时确认页面上只有一棵主题根节点 */
async function expectSettledTheme(page: Page, theme: string) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await expect(page.locator('.page-root')).toHaveCount(1)
  await expect(page.locator(`.page-root.theme-${theme}`)).toHaveCount(1)
}

test('无主题 cookie 时按 SSR 默认主题首屏，水合后恢复本地偏好并写入持久 cookie', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  const issues = watchIssues(page)
  // 只预置 localStorage 旧偏好，不写 cookie：模拟会话 cookie 丢失后的老访客
  await page.addInitScript(([key, theme]) => localStorage.setItem(key!, theme!), [STORAGE_KEY, 'aurora'])
  expect((await context.cookies()).find((cookie) => cookie.name === THEME_COOKIE)).toBeUndefined()

  // localStorage 对 SSR 不可见：无 cookie 的首屏 HTML 必须是默认主题 nexus 与对应根布局
  const initialHtml = await serverHtml(context.request)
  expect(ssrTheme(initialHtml)).toBe('nexus')
  expect(rootTheme(initialHtml)).toBe('nexus')

  await page.goto('/')
  // 水合期信任 SSR payload，水合后对账才切到本地偏好；整个过程不得出现水合 mismatch
  await expectSettledTheme(page, 'aurora')
  expect(issues).toEqual([])

  // 恢复后的偏好写入唯一事实源：持久 cookie（不是会话 cookie）
  await expect
    .poll(async () => (await context.cookies()).find((cookie) => cookie.name === THEME_COOKIE)?.value)
    .toBe('aurora')
  const cookie = (await context.cookies()).find((item) => item.name === THEME_COOKIE)
  expect(cookie?.path).toBe('/')
  expect(cookie?.sameSite).toBe('Lax')
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(300 * 24 * 3600 * 1000)
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('aurora')

  // 刷新后 cookie 进入 SSR 决策：服务端直出即 aurora，无需客户端再切一次
  await page.reload()
  await expectSettledTheme(page, 'aurora')
  const reloadedHtml = await serverHtml(context.request)
  expect(ssrTheme(reloadedHtml)).toBe('aurora')
  expect(rootTheme(reloadedHtml)).toBe('aurora')
  expect(issues).toEqual([])
  await context.close()
})

test('?theme= 只影响当前首屏预览，不写 cookie/localStorage，下次访问回到持久主题', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  await context.addCookies([
    {
      name: THEME_COOKIE,
      value: 'aurora',
      url: baseURL!,
      expires: Math.floor(Date.now() / 1000) + 300 * 24 * 3600,
    },
  ])
  const page = await context.newPage()
  const issues = watchIssues(page)
  await page.addInitScript(([key, theme]) => localStorage.setItem(key!, theme!), [STORAGE_KEY, 'aurora'])

  // 预览参数优先于持久 cookie，服务端直出 dock
  const previewHtml = await serverHtml(context.request, '/?theme=dock')
  expect(ssrTheme(previewHtml)).toBe('dock')
  expect(rootTheme(previewHtml)).toBe('dock')
  await page.goto('/?theme=dock')
  await expectSettledTheme(page, 'dock')
  expect(issues).toEqual([])

  // 分享链接带来的预览不持久化：cookie 与 localStorage 都还是访客自己的 aurora
  expect((await context.cookies()).find((cookie) => cookie.name === THEME_COOKIE)?.value).toBe('aurora')
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('aurora')

  // 重新访问不带 query：回到持久主题，SSR 直出 aurora
  const backHtml = await serverHtml(context.request)
  expect(ssrTheme(backHtml)).toBe('aurora')
  expect(rootTheme(backHtml)).toBe('aurora')
  await page.goto('/')
  await expectSettledTheme(page, 'aurora')
  expect(issues).toEqual([])
  await context.close()
})
