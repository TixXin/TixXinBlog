/**
 * @file supplement.mjs
 * @description 字体延迟、实际后台标签与颜色降级的独立浏览器证据
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const work = 'D:/Projects/TixXinBlog/.codex/motion-fixes', state = JSON.parse(readFileSync(`${work}/state.json`))
if (state.status !== 'ready') throw Error('隔离环境未就绪')
process.kill(state.ownerPid, 0)
const require = createRequire(`${work}/frontend/package.json`), { chromium, expect } = require('@playwright/test')
const suite = process.argv[2], output = `${work}/evidence/${suite}`
const origin = process.argv.includes('--dev') ? state.dev : state.prod
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: suite !== 'visibility' })
const results = []
async function check(name, callback) {
  try { results.push({ name, status: 'passed', detail: await callback() }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`) }
  writeFileSync(`${output}/results.json`, JSON.stringify({ browser: browser.version(), suite, results }, null, 2))
}
async function ready(page) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('html')).toHaveCSS('opacity', '1')
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
}
try {
  if (suite === 'fonts') for (const layout of ['nexus', 'aurora', 'dock']) await check(`${layout} 字体延迟期间可交互，释放后保留搜索内容`, async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage(), blocked = []
    let release
    const gate = new Promise(resolve => { release = resolve })
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: origin }])
      await page.route('**/_fonts/**', async route => { blocked.push(route.request().url()); await gate; await route.continue().catch(() => {}) })
      await page.goto('/', { waitUntil: 'domcontentloaded' }); await ready(page)
      expect(blocked.length).toBeGreaterThan(0)
      await page.getByRole('button', { name: '界面设置', exact: true }).click()
      await expect(page.getByRole('dialog', { name: '界面设置' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.keyboard.press('Control+k')
      const search = page.getByRole('textbox', { name: '搜索文章、项目和友链', exact: true })
      await search.fill('分页样本 104')
      await expect(page.locator('.search-modal__item')).toHaveCount(1)
      const before = await search.boundingBox()
      const cdp = await context.newCDPSession(page)
      const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${output}/${layout}-pending-font.png`, Buffer.from(image.data, 'base64'))
      const pending = await page.evaluate(() => document.fonts.status)
      expect(pending).toBe('loading')
      release()
      await page.evaluate(() => document.fonts.ready)
      await expect(search).toHaveValue('分页样本 104')
      await expect(search).toBeFocused()
      const after = await search.boundingBox()
      await search.press('Enter')
      await expect(page.getByRole('heading', { name: '分页样本 104', exact: true })).toBeFocused()
      await page.screenshot({ path: `${output}/${layout}-loaded-font.png`, animations: 'allow' })
      return { blocked, pending, before, after, finalUrl: page.url() }
    } finally { release(); await context.close() }
  })
  if (suite === 'visibility') await check('真实后台标签暂停Aurora轮播，回到前台后恢复', async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1280, height: 900 } })
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'aurora', url: origin }])
      const page = await context.newPage()
      await page.goto('/'); await ready(page)
      const images = () => page.locator('.aurora-hero__bg').evaluateAll(nodes => nodes.map(node => node.style.backgroundImage))
      await page.getByRole('button', { name: '播放背景', exact: true }).click()
      const initial = await images()
      await expect.poll(images, { timeout: 16000 }).not.toEqual(initial)
      await page.waitForTimeout(1000)
      const visibleImage = await images()
      const cover = await context.newPage()
      await cover.goto('about:blank'); await cover.bringToFront()
      const cdp = await context.newCDPSession(page)
      const targetWindow = await cdp.send('Browser.getWindowForTarget')
      // 自动化浏览器可能为每个页面使用独立窗口；原生最小化同样产生真实可见性事件。
      let method = 'activate-other-tab'
      if (await page.evaluate(() => document.visibilityState) !== 'hidden') {
        method = 'minimize-native-window'
        await cdp.send('Browser.setWindowBounds', { windowId: targetWindow.windowId, bounds: { windowState: 'minimized' } })
      }
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden')
      const hiddenAt = Date.now()
      await cover.waitForTimeout(10500)
      expect(await images()).toEqual(visibleImage)
      const hiddenDuration = Date.now() - hiddenAt
      if (method === 'minimize-native-window') await cdp.send('Browser.setWindowBounds', { windowId: targetWindow.windowId, bounds: { windowState: 'normal' } })
      await page.bringToFront()
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible')
      await expect.poll(images, { timeout: 16000 }).not.toEqual(visibleImage)
      await page.screenshot({ path: `${output}/foreground-resumed.png`, animations: 'allow' })
      // 用真实滚轮令Hero离屏，继续验证观察器停止更新。
      await page.mouse.move(600, 600); await page.mouse.wheel(0, 1800); await page.waitForTimeout(1000)
      const hero = await page.locator('.aurora-hero').boundingBox()
      expect(hero.y + hero.height).toBeLessThanOrEqual(0)
      const offscreen = await images()
      await page.waitForTimeout(10500)
      expect(await images()).toEqual(offscreen)
      return { method, hiddenDuration, hiddenStateVerified: true, initial, visibleImage, offscreen }
    } finally { await context.close() }
  })
  if (suite === 'colors') for (const noApi of [false, true]) for (const path of ['/', '/tabs', '/moments', '/guestbook', '/flash', '/gallery', '/projects']) await check(`${path} 系统颜色实时变化、无动画无插值、快速切换清理${noApi ? '（无VT接口）' : ''}`, async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    try {
      if (noApi) await context.addInitScript(() => Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true }))
      await page.goto(path); await ready(page)
      await page.getByRole('button', { name: '界面设置', exact: true }).click()
      await page.getByRole('button', { name: '无动画', exact: true }).click()
      await page.waitForTimeout(250)
      await page.evaluate(() => {
        window.colorInterpolations = []
        document.addEventListener('transitionrun', event => {
          if (/color/.test(event.propertyName) && event.target !== document.activeElement) window.colorInterpolations.push({ property: event.propertyName, class: event.target.className })
        }, true)
      })
      for (const name of ['浅色', '深色']) { await page.getByRole('button', { name, exact: true }).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150) }
      const interpolations = await page.evaluate(() => window.colorInterpolations)
      expect(interpolations).toEqual([])
      await page.getByRole('button', { name: '跟随系统', exact: true }).click()
      await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveClass(/light/)
      await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveClass(/dark/)
      await page.getByRole('button', { name: '圆形展开', exact: true }).click()
      for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: i % 2 ? '深色' : '浅色', exact: true }).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(25) }
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page.locator('html[data-color-mode-anim]')).toHaveCount(0)
      await page.getByRole('button', { name: '浅色', exact: true }).focus(); await page.keyboard.press('Enter')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(page.locator('html')).toHaveClass(/light/)
      await expect(page.locator('html[data-color-mode-anim]')).toHaveCount(0)
      await page.keyboard.press('Escape'); await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
      return { noApi, interpolations, finalClass: await page.locator('html').getAttribute('class') }
    } finally { await context.close() }
  })
  if (suite === 'offscreen') await check('Aurora Hero离屏及离开主页时停止轮播工作', async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 } })
    try {
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'aurora', url: origin }])
      const page = await context.newPage()
      await page.goto('/'); await ready(page)
      const images = () => page.locator('.aurora-hero__bg').evaluateAll(nodes => nodes.map(node => node.style.backgroundImage))
      const initial = await images()
      await page.getByRole('button', { name: '播放背景', exact: true }).click()
      await expect.poll(images, { timeout: 16000 }).not.toEqual(initial)
      await page.mouse.move(720, 600)
      await page.mouse.wheel(0, 1800); await page.waitForTimeout(700)
      await page.mouse.wheel(0, 1000); await page.waitForTimeout(700)
      const hero = await page.locator('.aurora-hero').boundingBox()
      expect(hero.y + hero.height).toBeLessThan(0)
      const offscreen = await images()
      await page.waitForTimeout(10500)
      expect(await images()).toEqual(offscreen)
      await page.getByRole('link', { name: '归档', exact: true }).click()
      await expect(page.locator('main')).toContainText('文章归档')
      await expect(page.locator('.aurora-hero__bg')).toHaveCount(0)
      await page.waitForTimeout(8500)
      await expect(page.locator('.aurora-hero__bg')).toHaveCount(0)
      await page.screenshot({ path: `${output}/hero-unmounted.png`, animations: 'allow' })
      return { initial, hero, offscreen, offscreenObservationMs: 10500, awayObservationMs: 8500 }
    } finally { await context.close() }
  })
  if (suite === 'contexts') for (const motion of ['no-preference', 'reduce']) await check(`朋友圈灯箱/作者卡/点赞与留言回应弹层 ${motion}`, async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 }, reducedMotion: motion })
    const page = await context.newPage(), errors = [], writes = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/v1/')) writes.push(request.url()) })
    try {
      await page.goto('/');await ready(page)
      await page.getByRole('link', { name: '朋友圈', exact: true }).click()
      const photo = page.locator('.moment-card__image-wrap').first()
      await photo.click()
      const lightbox = page.getByRole('dialog', { name: '图片预览', exact: true })
      await expect(lightbox).toBeVisible()
      const next = lightbox.getByRole('button', { name: '下一张', exact: true })
      if (await next.isVisible()) { await page.keyboard.press('ArrowRight');await expect(lightbox.locator('.moment-lightbox__counter')).toContainText('2 /') }
      await page.keyboard.press('Escape');await expect(lightbox).toHaveCount(0)
      await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
      await photo.click();await expect(lightbox).toBeVisible();await page.goBack()
      await expect(page.locator('.post-item')).toHaveCount(15);await expect(lightbox).toHaveCount(0)
      await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
      await page.getByRole('link', { name: '朋友圈', exact: true }).click()
      const card = page.locator('.moment-card').first()
      await card.locator('.moment-card__avatar').hover()
      const profile = page.locator('.moment-user-popover__card')
      await expect(profile).toBeVisible();await profile.hover();await page.waitForTimeout(150);await expect(profile).toBeVisible()
      await page.mouse.move(700, 60);await expect(profile).toHaveCount(0)
      const like = card.getByRole('button', { name: '点赞', exact: true })
      if ((await like.getAttribute('class')).includes('is-liked')) await like.click()
      await like.click();await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(card.locator('.like-icon-wrap--burst')).toHaveCount(0)
      await page.goto('/guestbook');await ready(page)
      const message = page.locator('.message-bubble').first()
      await message.hover();await message.getByRole('button', { name: '添加回应', exact: true }).click()
      const picker = message.getByRole('group', { name: '选择回应', exact: true })
      await expect(picker).toBeVisible();await picker.getByRole('button').first().press('Escape');await expect(picker).toHaveCount(0)
      await message.locator('.message-bubble__avatar-wrap').hover()
      await expect(message.locator('.message-bubble__user-card')).toBeVisible()
      await page.mouse.move(700, 60);await expect(message.locator('.message-bubble__user-card')).toHaveCount(0)
      await page.screenshot({ path: `${output}/${motion}.png`, animations: 'allow' })
      expect(writes).toEqual([]);expect(errors).toEqual([])
      return { writes, errors, dialogs: await page.getByRole('dialog').count(), inert: await page.locator('#__nuxt[inert]').count() }
    } finally { await context.close() }
  })
  if (suite === 'slow-navigation') for (const layout of (process.argv.includes('--one') ? ['nexus'] : ['nexus','aurora','dock'])) for (const motion of (process.argv.includes('--one') ? ['no-preference'] : ['no-preference','reduce'])) await check(`${layout}/${motion} 慢文章请求中进入全宽页，迟到结果不覆盖末次导航`, async () => {
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 1000 }, reducedMotion: motion })
    const page = await context.newPage(), errors = []
    let release, blocked = 0, stage = 'start'
    const checkpoints = []
    const snapshot = async name => {
      stage = name
      checkpoints.push({ name, url: page.url(), state: await page.evaluate(() => {
        const root = document.querySelector('main')
        const element = root?.querySelector('.articles-page,.article-page,.tabs-page')
        const components = []
        for (let instance = element?.__vueParentComponent; instance; instance = instance.parent) components.push({ name: instance.type?.name ?? instance.type?.__name, uid: instance.uid, mounted: instance.isMounted, unmounted: instance.isUnmounted })
        return { title: document.title, classes: element?.className, text: root?.textContent?.slice(0, 120), components }
      }) })
    }
    const gate = new Promise(resolve => { release = resolve })
    page.on('pageerror', error => errors.push(error.message))
    try {
      await context.addCookies([{name:'tixxin-blog-layout-theme',value:layout,url:origin}])
      await page.goto('/');await ready(page)
      await page.route('**/api/v1/posts/105', async route => { blocked++;await gate;await route.continue().catch(()=>{}) })
      await page.locator('a.post-item[href="/articles/105"]').click()
      await expect.poll(()=>blocked).toBeGreaterThan(0)
      await snapshot('article-pending')
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(100)
      await page.getByRole('link',{name:'标签页',exact:true}).click()
      await snapshot('tabs-requested')
      await expect(page).toHaveURL(/\/tabs$/)
      await expect(page.locator('.tabs-page')).toBeVisible()
      release();await page.waitForTimeout(500)
      await snapshot('article-released')
      await expect(page).toHaveURL(/\/tabs$/);await expect(page.locator('.tabs-page')).toBeVisible()
      await expect(page.locator('[data-page-motion-clone],.sidebar-leaving-clone')).toHaveCount(0)
      await page.goBack();await snapshot('history-back');await expect(page.getByRole('heading',{name:'分页样本 104',exact:true})).toBeVisible()
      await page.goForward();await snapshot('history-forward');await expect(page.locator('.tabs-page')).toBeVisible()
      await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
      expect(errors).toEqual([])
      await page.screenshot({path:`${output}/${layout}-${motion}.png`,animations:'allow'})
      return {blocked,errors,url:page.url(),checkpoints}
    } catch (error) {
      await snapshot('failure-after-'+stage)
      writeFileSync(`${output}/${layout}-${motion}-checkpoints.json`,JSON.stringify(checkpoints,null,2))
      await page.screenshot({path:`${output}/${layout}-${motion}-failed.png`,animations:'allow'})
      error.message = stage+' '+error.message
      throw error
    } finally { release();await context.close() }
  })
} finally { await browser.close(); process.exitCode = results.some(item => item.status === 'failed') ? 1 : 0 }
