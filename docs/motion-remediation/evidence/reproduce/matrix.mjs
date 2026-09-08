/**
 * @file matrix.mjs
 * @description 三主题的响应式、配色与减少模式验收，记录实际截图和水合错误
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const work = 'D:/Projects/TixXinBlog/.codex/motion-fixes'
const state = JSON.parse(readFileSync(`${work}/state.json`))
if (state.status !== 'ready') throw Error('隔离环境未就绪')
process.kill(state.ownerPid, 0)
const require = createRequire(`${work}/frontend/package.json`)
const { chromium, expect } = require('@playwright/test')
const browser = await chromium.launch()
const filter = process.argv[2]
const origin = process.argv.includes('--dev') ? state.dev : state.prod
const output = `${work}/evidence/matrix${filter ? '-retry' : ''}`
mkdirSync(output, { recursive: true })
const results = []
const cases = []
for (const layout of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    const index = cases.length
    cases.push({ layout, width, color: index % 2 ? 'dark' : 'light', motion: index % 2 ? 'reduce' : 'no-preference', interaction: true })
  }
  for (const width of [390, 1440]) for (const color of ['light', 'dark']) for (const motion of ['reduce', 'no-preference']) {
    if (!cases.some(c => c.layout === layout && c.width === width && c.color === color && c.motion === motion)) cases.push({ layout, width, color, motion, interaction: true })
  }
  for (const width of [479, 480, 481, 639, 640, 641, 767, 769, 1023, 1025, 1279, 1280, 1281]) cases.push({ layout, width, color: 'dark', motion: 'reduce', interaction: false })
}
try {
  for (const item of cases) {
    const { layout, width, color, motion, interaction } = item
    const name = `${layout}-${width}-${color}-${motion}`
    if (filter && !name.includes(filter)) continue
    const context = await browser.newContext({ baseURL: origin, viewport: { width, height: 1000 }, colorScheme: color, reducedMotion: motion, hasTouch: width < 768, isMobile: width < 768 })
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (/Hydration|\[Vue warn\]/.test(message.text())) errors.push(message.text()) })
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: origin }])
      await context.addInitScript(value => localStorage.setItem('nuxt-color-mode', value), color)
      await page.goto('/')
      await expect(page.locator('html')).toHaveClass(/app-client-ready/)
      await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
      await expect(page.locator(`.theme-${layout}`)).toBeVisible()
      await expect(page.locator('.post-item')).toHaveCount(15)
      await expect(page.locator('html')).toHaveClass(new RegExp(color))
      await page.waitForTimeout(300)
      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, opacity: getComputedStyle(document.documentElement).opacity, text: document.querySelector('main')?.textContent?.length ?? 0 }))
      expect(geometry.opacity).toBe('1')
      expect(geometry.text).toBeGreaterThan(100)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1)
      await page.screenshot({ path: `${output}/${name}.png`, animations: 'allow' })
      if (interaction) {
        const entry = page.getByRole('button', { name: '界面设置', exact: true })
        if (!await entry.isVisible()) await page.getByRole('button', { name: '更多导航', exact: true }).click()
        await entry.click()
        const dialog = page.getByRole('dialog', { name: '界面设置', exact: true })
        await expect(dialog).toBeVisible()
        await page.waitForTimeout(280)
        const box = await dialog.boundingBox()
        expect(box.x).toBeGreaterThanOrEqual(-1)
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
        if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/${name}-settings.png`, animations: 'allow' })
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        if (await page.getByRole('dialog', { name: '更多导航', exact: true }).isVisible()) await page.keyboard.press('Escape')
        await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
        await page.getByRole('link', { name: '归档', exact: true }).filter({ visible: true }).first().click()
        await expect(page.locator('main')).toContainText('文章归档')
        await expect(page.locator('[data-page-motion-clone]')).toHaveCount(0)
      }
      expect(errors).toEqual([])
      results.push({ ...item, status: 'passed', geometry, errors, image: `${name}.png` })
      console.log(`PASS ${name}`)
    } catch (error) {
      await page.screenshot({ path: `${output}/${name}-failure.png`, animations: 'allow' }).catch(() => {})
      results.push({ ...item, status: 'failed', error: error.message, errors })
      console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`)
    } finally { await context.close(); writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2)) }
  }
} finally { await browser.close(); process.exitCode = results.some(item => item.status === 'failed') ? 1 : 0 }
