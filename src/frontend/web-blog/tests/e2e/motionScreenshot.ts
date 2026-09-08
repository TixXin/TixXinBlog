/**
 * @file motionScreenshot.ts
 * @description 实际动效截图：Windows WebKit以真实字体请求和FontFace状态替代挂起的fonts.ready
 * @author TixXin
 * @since 2026-09-08
 */
import { expect } from '@playwright/test'
import type { Page, Request, TestInfo } from '@playwright/test'

const pendingFonts = new WeakMap<Page, Set<Request>>()
const nativeFontBarrierWorkaround = new WeakSet<Page>()

export function prepareMotionCapture(page: Page, browserName: string) {
  if (process.platform !== 'win32' || browserName !== 'webkit') return
  // 本机WebKit字体请求均完成且FontFace均非loading，聚合ready仍不兑现；仅调整截图器的等待条件。
  process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1'
  nativeFontBarrierWorkaround.add(page)
  const pending = new Set<Request>()
  pendingFonts.set(page, pending)
  page.on('request', (request) => {
    if (request.resourceType() === 'font') pending.add(request)
  })
  page.on('requestfinished', (request) => pending.delete(request))
  page.on('requestfailed', (request) => pending.delete(request))
}

export async function captureMotion(page: Page, testInfo: TestInfo, name: string) {
  if (nativeFontBarrierWorkaround.has(page)) {
    await expect.poll(() => pendingFonts.get(page)?.size ?? 0).toBe(0)
    await expect
      .poll(() => page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loading').length))
      .toBe(0)
  }
  await page.screenshot({ path: testInfo.outputPath(name), animations: 'allow' })
}
