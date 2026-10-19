/** @file i18n.spec.ts @description 界面语言：切换就地生效并由 cookie 持久化，SSR 缓存不串语言，站点默认语言来自部署变量 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'

const LOCALE_COOKIE = 'blog-locale'
// 与 browser-runner 透传给生产预览的环境变量一致；未设置或无效时站点默认中文。
const siteDefaultLocale = process.env.NUXT_PUBLIC_DEFAULT_LOCALE === 'en' ? 'en' : 'zh-CN'

/** 收集水合不一致与运行时异常，生产构建下 Vue 仍会在控制台报告 hydration mismatch */
function watchIssues(page: Page) {
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (/hydration|mismatch|TypeError|ReferenceError|Unhandled/i.test(message.text())) issues.push(message.text())
  })
  return issues
}

/** 取服务端直出的 HTML（不执行脚本），用于核对 SSR 与缓存命中的语言 */
async function serverHtml(request: APIRequestContext, path = '/', headers: Record<string, string> = {}) {
  const response = await request.get(path, { headers })
  expect(response.status()).toBe(200)
  return response.text()
}

function htmlLang(html: string) {
  return /<html[^>]*\slang="([^"]+)"/.exec(html)?.[1]
}

function flashFeedTitle(html: string) {
  return /<link[^>]*href="\/flash\.xml"[^>]*>/.exec(html)?.[0].match(/title="([^"]+)"/)?.[1]
}

async function contextWithLocale(browser: Browser, baseURL: string, locale?: 'zh-CN' | 'en') {
  const context = await browser.newContext({ baseURL })
  if (locale) await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url: baseURL }])
  return context
}

async function openAppearanceDrawer(page: Page) {
  await page.getByRole('button', { name: '界面设置', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: '界面设置', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

test('切换到英文就地生效，cookie 持久化后刷新仍为英文', async ({ browser, baseURL }) => {
  const context = await contextWithLocale(browser, baseURL!, 'zh-CN')
  const page = await context.newPage()
  const issues = watchIssues(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  // 切换前打上页面标记：整页重载会清掉它。
  await page.evaluate(() => Object.assign(window, { __localeSwitchMarker: true }))

  const dialog = await openAppearanceDrawer(page)
  const group = dialog.getByRole('group', { name: '选择界面语言' })
  await expect(group.getByRole('button', { name: '简体中文' })).toHaveAttribute('aria-pressed', 'true')
  await group.getByRole('button', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(dialog.getByRole('group', { name: 'Choose interface language' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('link[href="/flash.xml"]')).toHaveAttribute('title', / Flash Notes RSS$/)
  expect(
    await page.evaluate(() => (window as unknown as { __localeSwitchMarker?: boolean }).__localeSwitchMarker),
  ).toBe(true)
  const cookie = (await context.cookies()).find((item) => item.name === LOCALE_COOKIE)
  expect(cookie?.value).toBe('en')
  expect(cookie?.path).toBe('/')
  expect(cookie?.sameSite).toBe('Lax')
  // 有效期约一年，不是会话 cookie。
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(300 * 24 * 3600 * 1000)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US')
  // 服务端直出即为英文，不是客户端水合后才切换。
  const html = await serverHtml(context.request)
  expect(htmlLang(html)).toBe('en')
  expect(flashFeedTitle(html)).toMatch(/ Flash Notes RSS$/)

  // 切回中文同样即时生效并覆盖 cookie。
  const reopened = await openAppearanceDrawer(page)
  await reopened.getByRole('button', { name: '简体中文' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(reopened.getByRole('group', { name: '选择界面语言' })).toBeVisible()
  expect((await context.cookies()).find((item) => item.name === LOCALE_COOKIE)?.value).toBe('zh-CN')
  expect(issues).toEqual([])
  await context.close()
})

test('中英文访客交替访问时 SSR 缓存各自一份，不串语言也不改变规范地址', async ({ browser, baseURL }) => {
  const zh = await contextWithLocale(browser, baseURL!, 'zh-CN')
  const en = await contextWithLocale(browser, baseURL!, 'en')
  const contexts: Array<[BrowserContext, 'zh-CN' | 'en']> = [
    [zh, 'zh-CN'],
    [en, 'en'],
  ]
  try {
    // 交替请求同一批缓存页面，后到者必须拿到自己语言的副本，而不是先到者缓存的 HTML。
    for (const path of ['/', '/about', '/flash']) {
      const canonicals = new Set<string>()
      for (let round = 0; round < 2; round += 1) {
        for (const [context, locale] of contexts) {
          // 浏览器语言与 cookie 相反也不影响结果：首屏只认 cookie。
          const html = await serverHtml(context.request, path, {
            'Accept-Language': locale === 'en' ? 'zh-CN,zh;q=0.9' : 'en-US,en;q=0.9',
          })
          expect(htmlLang(html), `${path} ${locale}`).toBe(locale)
          expect(flashFeedTitle(html)).toMatch(locale === 'en' ? / Flash Notes RSS$/ : / 闪念 RSS$/)
          const canonical = /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1]
          expect(canonical).toBe(new URL(path, baseURL).href)
          canonicals.add(canonical!)
        }
      }
      expect(canonicals.size).toBe(1)
    }

    // 页面与水合同样各自保持语言。
    for (const [context, locale] of contexts) {
      const page = await context.newPage()
      const issues = watchIssues(page)
      await page.goto('/')
      await expect(page.locator('html')).toHaveClass(/app-client-ready/)
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      expect(issues).toEqual([])
      await page.close()
    }

    // 不加语言前缀：站点地图与 robots 对两种语言完全一致，也不出现 /en 路径或 hreflang。
    const [zhSitemap, enSitemap] = await Promise.all([
      serverHtml(zh.request, '/sitemap.xml'),
      serverHtml(en.request, '/sitemap.xml'),
    ])
    // 生成时间注释每次请求都不同，比较前去掉。
    const withoutStamp = (xml: string) => xml.replace(/<!--[^>]*generated[^>]*-->/g, '')
    expect(withoutStamp(enSitemap)).toBe(withoutStamp(zhSitemap))
    expect(zhSitemap).not.toMatch(/hreflang|\/en\/|\/zh-CN\//)
    const [zhRobots, enRobots] = await Promise.all([
      serverHtml(zh.request, '/robots.txt'),
      serverHtml(en.request, '/robots.txt'),
    ])
    expect(enRobots).toBe(zhRobots)
    const prefixed = await en.request.get('/en', { maxRedirects: 0 })
    expect(prefixed.status()).toBe(404)
  } finally {
    await zh.close()
    await en.close()
  }
})

test('首次访问按站点默认语言渲染，不读浏览器语言', async ({ browser, baseURL }) => {
  const opposite = siteDefaultLocale === 'en' ? 'zh-CN' : 'en'
  const context = await browser.newContext({ baseURL, locale: opposite === 'en' ? 'en-US' : 'zh-CN' })
  try {
    const page = await context.newPage()
    const issues = watchIssues(page)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/app-client-ready/)
    await expect(page.locator('html')).toHaveAttribute('lang', siteDefaultLocale)
    // 默认语言不写 cookie：站长之后修改默认语言，未主动选择的访客跟随新默认。
    expect((await context.cookies()).some((item) => item.name === LOCALE_COOKIE)).toBe(false)
    const html = await serverHtml(context.request, '/', {
      'Accept-Language': opposite === 'en' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
    })
    expect(htmlLang(html)).toBe(siteDefaultLocale)
    expect(flashFeedTitle(html)).toMatch(siteDefaultLocale === 'en' ? / Flash Notes RSS$/ : / 闪念 RSS$/)
    // 访客主动选择的语言优先于站点默认。
    await context.addCookies([{ name: LOCALE_COOKIE, value: opposite, url: baseURL! }])
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', opposite)
    expect(issues).toEqual([])
  } finally {
    await context.close()
  }
})
