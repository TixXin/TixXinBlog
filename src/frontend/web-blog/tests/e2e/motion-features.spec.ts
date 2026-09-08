/**
 * @file motion-features.spec.ts
 * @description 动效功能回归：长文滚动、书签键鼠排序、嵌套弹层及后台轮播
 * @author TixXin
 * @since 2026-09-08
 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

let fixtureApi: APIRequestContext
let fixtureToken = ''
let articleId: number | undefined
let flashId: string | undefined
test.beforeAll(async ({ playwright }) => {
  const origin = process.env.E2E_BASE_URL!
  expect(process.env.E2E_ISOLATED).toBe('true')
  fixtureApi = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })
  const auth = await fixtureApi.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(auth.ok()).toBe(true)
  fixtureToken = (await auth.json()).data.accessToken
  const headers = { Authorization: `Bearer ${fixtureToken}` }
  const article = await fixtureApi.post('/api/v1/admin/posts', {
    headers,
    data: {
      title: '动效整改长文验收',
      summary: '隔离回归样本',
      folder: '示例专栏',
      tags: ['示例标签'],
      status: 'published',
      category: 'tech',
      contentRaw: Array.from(
        { length: 18 },
        (_, i) => `## 动效章节 ${i + 1}\n\n` + '用于检验目录定位、阅读进度与滚动恢复。'.repeat(28),
      ).join('\n\n'),
    },
  })
  expect(article.ok()).toBe(true)
  articleId = (await article.json()).data.id
  const flash = await fixtureApi.post('/api/v1/admin/flashes', {
    headers,
    data: {
      content: '动效整改图片闪念',
      type: 'memo',
      tags: ['动效'],
      images: [origin + '/avatar-photo.webp', origin + '/avatar-photo.webp?second'],
    },
  })
  expect(flash.ok()).toBe(true)
  flashId = (await flash.json()).data.id
})
test.afterAll(async () => {
  if (!fixtureApi) return
  const headers = { Authorization: `Bearer ${fixtureToken}` }
  if (articleId) {
    const detail = await fixtureApi.get(`/api/v1/admin/posts/${articleId}`, { headers })
    const revision = (await detail.json()).data.revision
    expect((await fixtureApi.delete(`/api/v1/admin/posts/${articleId}?revision=${revision}`, { headers })).ok()).toBe(
      true,
    )
  }
  if (flashId) expect((await fixtureApi.delete(`/api/v1/admin/flashes/${flashId}`, { headers })).ok()).toBe(true)
  await fixtureApi.dispose()
})

async function ready(page: Page) {
  await expect(page.locator('html')).toHaveClass(/app-client-ready/)
  await expect(page.locator('.loading-screen:visible')).toHaveCount(0)
  await expect.poll(() => page.locator('html').evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
}
async function login(page: Page) {
  await page.goto('/admin/login')
  await ready(page)
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function readingPosition(page: Page) {
  return page.locator('.article-reading-content').evaluate((element) => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)
        return node.scrollTop
    }
    return window.scrollY
  })
}

for (const layout of ['nexus', 'aurora', 'dock']) {
  for (const width of [390, 1440]) {
    test(`长文 ${layout}/${width} 快捷键目录与历史`, async ({ page, context, baseURL }, testInfo) => {
      expect(articleId).toBeTruthy()
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const path = `/articles/${articleId}`
      await page.goto(path)
      await ready(page)
      await page.mouse.click(width / 2, 480)
      await page.keyboard.press('j')
      await expect.poll(() => readingPosition(page)).toBeGreaterThan(50)
      const down = await readingPosition(page)
      await page.keyboard.press('k')
      await expect.poll(() => readingPosition(page)).toBeLessThan(down)
      const contents = page.getByRole('button', { name: '文章目录', exact: true })
      if (await contents.isVisible()) await contents.click()
      await page.locator('a[href^="#"]:visible').filter({ hasText: '动效章节 12' }).click()
      await expect(page).toHaveURL(/#heading-12$/)
      await expect(page.getByRole('heading', { name: '动效章节 12', exact: true })).toBeVisible()
      await captureMotion(page, testInfo, `${layout}-${width}-toc.png`)
      const before = await readingPosition(page)
      const projectLink = page.getByRole('link', { name: '项目', exact: true })
      if (!(await projectLink.isVisible())) await page.getByRole('button', { name: '更多导航', exact: true }).click()
      await projectLink.click()
      await expect(page).toHaveURL(/\/projects$/)
      await page.goBack()
      await expect(page.getByRole('heading', { name: '动效整改长文验收', exact: true })).toBeAttached()
      await expect.poll(async () => Math.abs((await readingPosition(page)) - before)).toBeLessThan(3)
      await page.mouse.click(width / 2, 480)
      await page.keyboard.press('t')
      await expect.poll(() => readingPosition(page)).toBe(0)
    })
  }
}

for (const layout of ['nexus', 'aurora', 'dock']) {
  test(`阅读 ${layout} 回顶可被滚轮中断，运行中reduce完成滚动`, async ({ page, context, baseURL }, testInfo) => {
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: layout, url: baseURL! }])
    await page.goto(`/articles/${articleId}`)
    await ready(page)
    await page.mouse.move(720, 480)
    // 浏览器可能把一次大滚轮输入限制在一屏；用真实连续滚轮到达相同的长距离前置位置。
    for (let attempt = 0; attempt < 6 && (await readingPosition(page)) < 2400; attempt++) {
      await page.mouse.wheel(0, 1200)
      await page.waitForTimeout(250)
    }
    await expect.poll(() => readingPosition(page)).toBeGreaterThan(2000)
    const before = await readingPosition(page)
    const top = page.getByRole('button', { name: '返回顶部', exact: true }).filter({ visible: true }).first()
    await top.click()
    await expect.poll(() => readingPosition(page), { intervals: [10, 20] }).toBeLessThan(before - 5)
    const moving = await readingPosition(page)
    expect(moving).toBeGreaterThan(0)
    await page.mouse.move(720, 480)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(500)
    // 用户滚轮本身仍可有原生惯性，等其停止后再判断程序回顶是否被取消。
    let previousPosition = await readingPosition(page)
    await expect
      .poll(async () => {
        await page.waitForTimeout(150)
        const position = await readingPosition(page)
        const drift = Math.abs(position - previousPosition)
        previousPosition = position
        return drift
      })
      .toBeLessThan(1)
    const interrupted = await readingPosition(page)
    expect(interrupted).toBeGreaterThan(100)
    await page.waitForTimeout(300)
    expect(Math.abs((await readingPosition(page)) - interrupted)).toBeLessThan(3)
    await top.click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => readingPosition(page)).toBe(0)
    await testInfo.attach('scroll-samples', {
      body: JSON.stringify({ before, moving, interrupted, final: 0 }),
      contentType: 'application/json',
    })
  })
}

test('Aurora紧凑顶栏的前后导航项均可通过真实点击到达', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'aurora', url: baseURL! }])
  for (const width of [768, 769, 1023]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    await ready(page)
    const navigation = page.locator('.aurora-topbar__nav')
    await navigation.getByRole('link', { name: '关于', exact: true }).click()
    await expect(page.locator('main')).toContainText('技能示例')
    await navigation.getByRole('link', { name: '归档', exact: true }).click()
    await expect(page.locator('main')).toContainText('文章归档')
    await navigation.getByRole('link', { name: '主页', exact: true }).click()
    await expect(page.locator('.post-item')).toHaveCount(15)
  }
})

test('书签键盘和真实拖拽均能持久化顺序，导入逐层关闭', async ({ page }, testInfo) => {
  test.setTimeout(90000)
  await login(page)
  await page.goto('/tabs')
  await ready(page)
  for (const name of ['Motion A', 'Motion B', 'Motion C']) {
    await page.getByRole('button', { name: '添加', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: '添加书签' })
    await dialog.getByRole('textbox', { name: '名称', exact: true }).fill(name)
    await dialog
      .getByRole('textbox', { name: '网址', exact: true })
      .fill(`https://example.com/${name.replace(' ', '-')}`)
    await dialog.getByRole('button', { name: '添加', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ body: '隔离测试链接', contentType: 'text/plain' }),
  )
  const items = page.locator('.tab-grid__list > .tab-bm')
  const ids = () => items.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-bookmark-id')))
  const before = await ids()
  const chosen = items.filter({ hasText: 'Motion B' })
  const chosenId = await chosen.getAttribute('data-bookmark-id')
  await chosen.press('Alt+ArrowUp')
  await expect.poll(ids).not.toEqual(before)
  await expect(page.locator(`[data-bookmark-id="${chosenId}"]`)).toBeFocused()
  const keyboardOrder = await ids()
  await page.reload()
  await ready(page)
  await expect.poll(ids).toEqual(keyboardOrder)
  const dragSource = items.filter({ hasText: 'Motion A' })
  const dragTarget = items.filter({ hasText: 'Motion C' })
  await dragTarget.scrollIntoViewIfNeeded()
  const from = await dragSource.boundingBox()
  const to = await dragTarget.boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + from!.height / 2 + 12, { steps: 5 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.mouse.move(to!.x + to!.width * 0.8, to!.y + to!.height * 0.8, { steps: 20 })
  await page.waitForTimeout(250)
  await page.mouse.up()
  await expect.poll(ids).not.toEqual(keyboardOrder)
  const dragOrder = await ids()
  expect([...dragOrder].sort()).toEqual([...keyboardOrder].sort())
  await page.reload()
  await ready(page)
  await expect.poll(ids).toEqual(dragOrder)
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const settings = page.getByRole('dialog', { name: '标签页设置' })
  await settings.getByRole('button', { name: '数据', exact: true }).click()
  await page.getByRole('button', { name: /导入数据/ }).click()
  await expect(page.getByRole('dialog', { name: '导入书签' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settings).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
  await captureMotion(page, testInfo, 'bookmarks.png')
})

test('AI演示搜索关闭后迟到结果不覆盖新会话', async ({ page }) => {
  await login(page)
  await page.goto('/flash')
  await ready(page)
  const entry = page.getByRole('button', { name: /AI 搜索闪念/ })
  await entry.click()
  const dialog = page.getByRole('dialog', { name: '闪念演示搜索', exact: true })
  await dialog.locator('input').fill('动效')
  await dialog.locator('input').press('Enter')
  await expect(dialog).toContainText('AI 正在翻阅')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await entry.click()
  await page.waitForTimeout(1500)
  await expect(dialog).toContainText('输入关键词后回车开始')
  await page.keyboard.press('Escape')
  await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
})

test('Aurora减少模式和默认模式静止，手动播放可暂停', async ({ page, context, baseURL }, testInfo) => {
  test.setTimeout(60000)
  await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: 'aurora', url: baseURL! }])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await ready(page)
  const images = () =>
    page
      .locator('.aurora-hero__bg')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).style.backgroundImage))
  const first = await images()
  await page.waitForTimeout(10500)
  expect(await images()).toEqual(first)
  await expect(page.getByRole('button', { name: '静态背景', exact: true })).toBeDisabled()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: '播放背景', exact: true }).click()
  await expect.poll(images, { timeout: 15000 }).not.toEqual(first)
  await page.getByRole('button', { name: '暂停背景', exact: true }).click()
  await page.waitForTimeout(1000)
  const stopped = await images()
  await page.waitForTimeout(8500)
  expect(await images()).toEqual(stopped)
  await captureMotion(page, testInfo, 'aurora-paused.png')
})

test('图片灯箱切换后关闭释放背景，快捷键命令面板可退出', async ({ page }) => {
  expect(flashId).toBeTruthy()
  await page.goto(`/flash/${flashId}`)
  await ready(page)
  const preview = page.getByRole('button', { name: '预览图片：1', exact: true })
  await preview.click()
  await page.getByRole('button', { name: '下一张', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(preview).toBeFocused()
  await page.goto('/tabs')
  await ready(page)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: '书签命令面板' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
})

test('书签上下文编辑退出回到原书签，图标选择器与分组弹窗可关闭', async ({ page }) => {
  await login(page)
  await page.goto('/tabs')
  await ready(page)
  const bookmark = page.locator('.tab-bm').first()
  const id = await bookmark.getAttribute('data-bookmark-id')
  await bookmark.click({ button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menu').getByRole('button', { name: '编辑', exact: true }).click()
  const editor = page.getByRole('dialog').filter({ hasText: '编辑书签' })
  await expect(editor).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  await expect(page.locator(`[data-bookmark-id="${id}"]`)).toBeFocused()
  await page.getByRole('button', { name: '新建分类', exact: true }).click()
  await expect(page.getByRole('dialog').filter({ hasText: '新建分类' })).toBeVisible()
  await page.getByPlaceholder('搜索图标...', { exact: true }).fill('folder')
  await expect(page.locator('.icon-picker__grid button')).not.toHaveCount(0)
  await page.locator('.icon-picker__grid button').first().click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#__nuxt[inert]')).toHaveCount(0)
})
