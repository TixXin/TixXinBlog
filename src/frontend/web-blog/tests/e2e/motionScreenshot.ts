/**
 * @file motionScreenshot.ts
 * @description 实际动效截图：WebKit以真实字体请求和FontFace状态替代挂起的fonts.ready
 * @author TixXin
 * @since 2026-09-08
 */
import { expect } from '@playwright/test'
import type { Locator, Page, Request, TestInfo } from '@playwright/test'

const pendingFonts = new WeakMap<Page, Set<Request>>()
const failedFonts = new WeakMap<Page, Set<string>>()
const requestedFonts = new WeakMap<Page, Set<string>>()
const nativeFontBarrierWorkaround = new WeakSet<Page>()

export function prepareMotionCapture(page: Page, browserName: string) {
  if (browserName !== 'webkit' || nativeFontBarrierWorkaround.has(page)) return
  // Windows和macOS WebKit均出现字体请求完成但聚合ready不兑现；用真实网络及FontFace检查替代截图器等待。
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1'
  nativeFontBarrierWorkaround.add(page)
  const pending = new Set<Request>(),
    failures = new Set<string>(),
    requested = new Set<string>()
  pendingFonts.set(page, pending)
  failedFonts.set(page, failures)
  requestedFonts.set(page, requested)
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      // 仅新文档重置；同文档路由切换仍保留字体失败证据，不掩盖SPA此前的字体错误。
      pending.clear()
      failures.clear()
      requested.clear()
    }
    if (request.resourceType() === 'font') {
      pending.add(request)
      requested.add(request.url())
    }
  })
  page.on('response', (response) => {
    if (pending.has(response.request()) && !response.ok()) failures.add(`HTTP ${response.status()}: ${response.url()}`)
  })
  page.on('requestfinished', (request) => pending.delete(request))
  page.on('requestfailed', (request) => {
    if (pending.delete(request)) failures.add(`${request.failure()?.errorText ?? '字体请求失败'}: ${request.url()}`)
  })
}

export async function captureMotion(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { target?: Locator; animations?: 'allow' | 'disabled' } = {},
) {
  if (nativeFontBarrierWorkaround.has(page)) {
    // 先进入实际截图区域并完成布局，避免尚未进入视口的字体请求在屏障后才开始。
    await options.target?.scrollIntoViewIfNeeded()
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    )
    await expect.poll(() => pendingFonts.get(page)?.size ?? 0, { message: '截图前全部字体请求必须完成' }).toBe(0)
    await expect
      .poll(() => page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loading').length), {
        message: '截图前字体必须结束加载',
      })
      .toBe(0)
    expect([...(failedFonts.get(page) ?? [])], '字体网络失败不能用截图屏障绕过').toEqual([])
    // WebKit把未命中的local()回退和未使用子集标成error；逐个解码实际请求的字体，既不更换字体也不忽略坏文件。
    const decodeFailures = await page.evaluate(
      async (urls) => {
        const results = await Promise.all(
          urls.map(async (url, index) => {
            try {
              await new FontFace(`MotionCaptureProbe${index}`, `url(${JSON.stringify(url)})`).load()
              return null
            } catch {
              return url
            }
          }),
        )
        return results.filter((value) => value !== null)
      },
      [...(requestedFonts.get(page) ?? [])],
    )
    expect(decodeFailures, '实际使用字体必须能完成解码，不能以回退字体制造截图通过').toEqual([])
  }
  await (options.target ?? page).screenshot({
    path: testInfo.outputPath(name),
    animations: options.animations ?? 'allow',
  })
}
