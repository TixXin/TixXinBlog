/** @file admin-workspace.spec.ts @description 隔离后台滚动职责、移动抽屉、操作区、列表返回与三主题入口 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(async ({ page, browserName }) => {
  prepareMotionCapture(page, browserName)
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      body: document.documentElement.scrollWidth > innerWidth + 1,
      main: document.querySelector('.admin-main')!.scrollWidth > document.querySelector('.admin-main')!.clientWidth + 1,
    })),
  ).toEqual({ body: false, main: false })
}

for (const width of [320, 390]) {
  test(`后台${width}px代表页面长内容与操作区无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 })
    for (const path of [
      '/admin',
      '/admin/posts',
      '/admin/posts/new',
      '/admin/gallery',
      '/admin/gallery/new',
      '/admin/projects',
      '/admin/projects/new',
      '/admin/links',
      '/admin/links/new',
      '/admin/media',
      '/admin/site',
      '/admin/maintenance',
    ]) {
      await page.goto(path)
      await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
      await expect(page.getByRole('main').getByText(/^正在(?:读取|加载|确认)/)).toHaveCount(0)
      await noOverflow(page)
      if (await page.getByRole('button', { name: '表单操作', exact: true }).count()) {
        await page.getByRole('button', { name: '表单操作', exact: true }).click()
        await expect(page.locator('.admin-action-bar')).toBeInViewport()
      }
    }
    await captureMotion(page, testInfo, `admin-maintenance-${width}.png`)
  })
}

test('桌面长表单只滚动右侧，长导航独立滚动且所有入口可到达', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 720 })
  await page.goto('/admin/site')
  await expect(page.getByLabel('站点名称', { exact: true })).toBeEnabled()
  const sidebar = page.locator('.admin-sidebar')
  const before = await sidebar.boundingBox()
  await page.mouse.move(1000, 500)
  await page.mouse.wheel(0, 1200)
  await expect.poll(() => page.locator('.admin-main').evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  if ((await page.locator('.admin-main').evaluate((node) => node.scrollTop)) <= 500) await page.mouse.wheel(0, 1200)
  await expect.poll(() => page.locator('.admin-main').evaluate((node) => node.scrollTop)).toBeGreaterThan(500)
  expect(await sidebar.boundingBox()).toEqual(before)
  expect(await page.locator('.admin-shell').evaluate((node) => node.scrollTop)).toBe(0)
  expect(await page.evaluate(() => scrollY)).toBe(0)
  const contentTop = await page.locator('.admin-main').evaluate((node) => node.scrollTop)
  const navigation = sidebar.getByRole('navigation', { name: '管理导航' })
  expect(await navigation.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
  await navigation.getByRole('link', { name: '管理概览', exact: true }).focus()
  await expect(navigation.getByRole('link').first()).toBeFocused()
  for (let i = 1; i < 15; i++) {
    await page.keyboard.press('Tab')
    await expect(navigation.getByRole('link').nth(i)).toBeFocused()
  }
  await expect(navigation.getByRole('link', { name: '备份与维护', exact: true })).toBeFocused()
  expect(await page.locator('.admin-main').evaluate((node) => node.scrollTop)).toBe(contentTop)
  await page.getByRole('button', { name: '表单操作', exact: true }).click()
  await expect(page.locator('.admin-action-bar')).toBeFocused()
  await expect(page.getByRole('button', { name: '保存并生效', exact: true })).toBeInViewport()
  await captureMotion(page, testInfo, 'admin-site-independent-scroll.png')
  await noOverflow(page)
})

for (const width of [320, 390, 760, 761]) {
  test(`后台${width}px导航断点、键盘焦点和跨断点清理`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 })
    await page.goto('/admin/gallery/new')
    await expect(page.getByLabel('作品标题', { exact: true })).toBeEnabled()
    if (width <= 760) {
      const open = page.getByRole('button', { name: '管理导航', exact: true })
      await open.click()
      const drawer = page.getByRole('dialog', { name: '管理导航', exact: true })
      await expect(drawer).toBeVisible()
      await drawer.getByRole('link', { name: '返回博客', exact: true }).focus()
      await page.keyboard.press('Tab')
      await expect(drawer.getByRole('button', { name: '关闭管理导航' })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(drawer).not.toBeVisible()
      await expect(open).toBeFocused()
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
      await open.click()
      await drawer.getByRole('link', { name: '站点设置', exact: true }).click()
      await expect(page).toHaveURL(/\/admin\/site$/)
      await expect(drawer).not.toBeVisible()
      await open.click()
      await page.setViewportSize({ width: 900, height: 740 })
      await expect(drawer).not.toBeVisible()
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
      await page.setViewportSize({ width, height: 740 })
      await expect(drawer).not.toBeVisible()
      await page.getByRole('button', { name: '表单操作', exact: true }).click()
      await expect(page.getByRole('button', { name: '保存并生效', exact: true })).toBeInViewport()
    } else {
      await expect(page.locator('.admin-sidebar')).toBeVisible()
      await expect(page.getByRole('button', { name: '管理导航', exact: true })).not.toBeVisible()
    }
    await noOverflow(page)
    await captureMotion(page, testInfo, `admin-${width}.png`)
  })
}

test('图库列表保留筛选页码和返回位置，编辑页所属模块清晰', async ({ page }) => {
  await page.goto('/admin/gallery?page=2&status=published')
  await expect(page.getByRole('link', { name: '编辑作品', exact: true }).first()).toBeVisible()
  await page.mouse.move(1000, 600)
  await page.mouse.wheel(0, 500)
  const position = await page.locator('.admin-main').evaluate((node) => node.scrollTop)
  await page.getByRole('link', { name: '编辑作品', exact: true }).last().click()
  await expect(page.getByLabel('作品标题', { exact: true })).toBeEnabled()
  await expect(page.locator('.admin-sidebar nav [aria-current="page"]')).toHaveText('图库管理')
  await page.getByRole('link', { name: '返回图库管理', exact: true }).click()
  await expect(page).toHaveURL(/page=2&status=published/)
  await expect(page.getByLabel('筛选作品状态', { exact: true })).toHaveValue('published')
  await expect
    .poll(() => page.locator('.admin-main').evaluate((node) => node.scrollTop))
    .toBeGreaterThanOrEqual(position)
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  test(`${theme}后台入口巡检、减少动态效果及前后台往返`, async ({ page, context }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: process.env.E2E_BASE_URL! }])
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const [path, title] of [
      ['/admin', '管理概览'],
      ['/admin/posts', '文章管理'],
      ['/admin/gallery', '图库管理'],
      ['/admin/projects', '项目管理'],
      ['/admin/links', '友链管理'],
      ['/admin/media', '媒体资源'],
      ['/admin/site', '站点设置'],
      ['/admin/maintenance', '备份与维护'],
      ['/admin/comments', '评论管理'],
      ['/admin/flashes', '闪念管理'],
      ['/admin/moments', '朋友圈管理'],
      ['/admin/guestbook', '留言管理'],
      ['/admin/taxonomy', '分类与标签'],
      ['/admin/account', '账号安全'],
      ['/admin/audit', '操作审计'],
    ]) {
      await page.goto(path!)
      await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
      await expect(page.getByRole('main').getByText(/^正在(?:读取|加载|确认)/)).toHaveCount(0)
      await expect(page.locator('.admin-sidebar nav [aria-current="page"]')).toHaveText(title!)
      await expect(page.getByRole('main', { name: '管理内容' })).toBeVisible()
      await noOverflow(page)
    }
    await captureMotion(page, testInfo, `admin-${theme}-audit.png`)
    await page.locator('.admin-sidebar').getByRole('link', { name: '返回博客', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto('/admin')
    await expect(page.locator('.admin-sidebar nav [aria-current="page"]')).toHaveText('管理概览')
  })
}
