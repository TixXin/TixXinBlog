/**
 * @file ux-remediation.spec.ts
 * @description 隔离生产环境的 UI 整改验收：连续集合、草稿、焦点、小屏入口和阅读
 * @author TixXin
 * @since 2026-09-07
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

test('关闭JavaScript时首屏仍包含服务端文章列表', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  try {
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('.post-list a[href^="/articles/"]')).toHaveCount(15)
    await expect(page.getByRole('heading', { name: '分页样本 105', exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})

async function openAppearance(page: Page) {
  const entry = page.getByRole('button', { name: '界面设置', exact: true })
  if (!(await entry.isVisible())) await page.getByRole('button', { name: '更多导航', exact: true }).click()
  await entry.click()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toBeVisible()
}

test('画廊检索使用真实照片，空态可恢复且灯箱归还焦点', async ({ page, request }, testInfo) => {
  const response = await request.get('/api/v1/gallery?pageSize=12')
  expect(response.status()).toBe(200)
  const sample = (await response.json()).data.items[0]
  expect(sample).toBeTruthy()
  await page.goto('/gallery')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  const search = page.getByRole('textbox', { name: '搜索画廊照片', exact: true })
  await search.fill(sample.title)
  const photo = page.getByRole('button', { name: `查看照片：${sample.title}`, exact: true })
  await photo.press('Enter')
  const lightbox = page.getByRole('dialog', { name: sample.title, exact: true })
  await expect(lightbox.getByRole('button', { name: '关闭', exact: true })).toBeFocused()
  await lightbox.screenshot({ animations: 'disabled', path: testInfo.outputPath('gallery-lightbox.png') })
  await lightbox.getByRole('button', { name: '关闭', exact: true }).press('Escape')
  await expect(photo).toBeFocused()
  await search.fill('没有这张照片的关键词')
  await expect(page.getByRole('heading', { name: '没有找到照片', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(search).toHaveValue('')
  expect(await page.locator('.gallery-grid__cell').count()).toBeGreaterThan(1)
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).not.toContain('og-gallery.jpg')
})

test('收藏写入失败不假装成功，存储恢复后可收藏并刷新保留', async ({ page }) => {
  await page.goto('/articles/4')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreFavoriteStorage: () => void }).restoreFavoriteStorage = () => {
      Storage.prototype.setItem = original
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tixxin-blog-favorites') throw new DOMException('quota', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await expect(page.getByText('收藏未保存：浏览器存储不可用或空间不足，请重试')).toBeVisible()
  await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { restoreFavoriteStorage: () => void }).restoreFavoriteStorage())
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toBeVisible()
})

test('未上线动作前置说明，项目无占位链接，手机留言真实持久化', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByText('使用RSS阅读器订阅最新文章。邮件订阅尚未开放。')).toBeVisible()
  await page.goto('/projects')
  await expect(page.locator('.project-card').first()).toBeVisible()
  await expect(page.locator('.project-card a[href="#"]')).toHaveCount(0)
  await expect(page.locator('.project-card__example, .project-card__stars')).toHaveCount(0)
  await page.goto('/links')
  await expect(page.getByText(/在线申请尚未开放/)).toBeVisible()
  await expect(page.getByRole('button', { name: '提交申请', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '复制友链资料', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/guestbook')
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/guestbook')
      writes.push(request.url())
  })
  const input = page.getByRole('textbox', { name: '留言内容', exact: true })
  await expect(input).toBeVisible()
  const inputTop = (await input.boundingBox())!.y
  expect(inputTop).toBeLessThan(844)
  const content = '手机上留下的想法 ' + crypto.randomUUID()
  await input.fill(content)
  await page.getByRole('button', { name: '发送留言', exact: true }).click()
  await page.getByPlaceholder('你的昵称', { exact: true }).fill('小林')
  await page.getByRole('button', { name: '确认身份', exact: true }).click()
  await expect(page.getByText(content, { exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  await expect(input).toHaveValue('')
  await captureMotion(page, testInfo, 'guestbook-persistent.png')
  await page.reload()
  await expect(page.getByText(content, { exact: true })).toBeVisible()
})

async function theme(page: Page, id: string) {
  const labels: Record<string, string> = { nexus: 'Nexus 三栏', aurora: 'Aurora 双栏', dock: 'Dock 浮岛' }
  await openAppearance(page)
  await page.getByRole('button', { name: `${labels[id]} 布局主题`, exact: true }).click()
  await expect(page.locator(`.theme-${id}`)).toBeVisible()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toHaveCount(0)
  const more = page.getByRole('dialog', { name: '更多导航', exact: true })
  if (await more.isVisible()) await more.getByRole('button', { name: '关闭更多导航' }).click()
}

async function mainScrollTop(page: Page) {
  return page.evaluate(() =>
    Math.max(
      window.scrollY,
      ...[...document.querySelectorAll('.custom-scrollbar__viewport')].map((element) => element.scrollTop),
    ),
  )
}

for (const layout of ['nexus', 'aurora', 'dock']) {
  test(`${layout}的页码筛选刷新与返回保留位置，连续模式返回补齐前缀`, async ({ page }, testInfo) => {
    await page.goto('/')
    if (layout !== 'nexus') await theme(page, layout)
    await page.goto('/?page=3&tag=示例标签&category=示例专栏')
    const cards = page.locator('.post-list a[href^="/articles/"]')
    await expect(cards).toHaveCount(15)
    await expect(cards.first()).toHaveAttribute('href', '/articles/76')
    await cards.nth(10).scrollIntoViewIfNeeded()
    let originalTop = await mainScrollTop(page)
    expect(originalTop).toBeGreaterThan(100)
    await cards.nth(10).evaluate((element) => {
      element.addEventListener(
        'click',
        () => {
          ;(window as unknown as { articleClickScroll: number }).articleClickScroll = Math.max(
            window.scrollY,
            ...[...document.querySelectorAll('.custom-scrollbar__viewport')].map((node) => node.scrollTop),
          )
        },
        { once: true, capture: true },
      )
    })
    await cards.nth(10).click()
    await expect(page).toHaveURL(/\/articles\/66$/)
    originalTop = await page.evaluate(() => (window as unknown as { articleClickScroll: number }).articleClickScroll)
    await page.getByRole('button', { name: '返回上一页', exact: true }).click()
    await expect(cards.first()).toHaveAttribute('href', '/articles/76')
    await expect.poll(async () => Math.abs((await mainScrollTop(page)) - originalTop)).toBeLessThan(12)
    expect(new URL(page.url()).searchParams.get('page')).toBe('3')
    expect(new URL(page.url()).searchParams.get('tag')).toBe('示例标签')
    await page.reload()
    await expect(cards.first()).toHaveAttribute('href', '/articles/76')
    expect(new URL(page.url()).searchParams.get('category')).toBe('示例专栏')
    await page.getByRole('button', { name: '2', exact: true }).click()
    await expect(cards.first()).toHaveAttribute('href', '/articles/91')
    await page.goBack()
    await expect(cards.first()).toHaveAttribute('href', '/articles/76')
    await page.goForward()
    await expect(cards.first()).toHaveAttribute('href', '/articles/91')
    await page.getByRole('button', { name: '连续加载', exact: true }).click()
    await expect(cards).toHaveCount(15)
    await expect(cards.first()).toHaveAttribute('href', '/articles/106')
    await cards.last().scrollIntoViewIfNeeded()
    await expect(cards).toHaveCount(30)
    const collection = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    await cards.last().click()
    await expect(page).toHaveURL(/\/articles\/\d+$/)
    await page.getByRole('button', { name: '返回上一页', exact: true }).click()
    await expect(cards).toHaveCount(30)
    expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))).toEqual(collection)
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${layout}-history-restored.png`) })
  })
}

test('旧朋友圈锚点入口与独立列表使用同一搜索URL和数据', async ({ page }) => {
  await page.goto('/?q=摄影#moments')
  await expect(page).toHaveURL(/\/moments\?q=/)
  const search = page.getByRole('textbox', { name: '搜索动态内容 / 话题 / 地点...', exact: true })
  await expect(search).toHaveValue('摄影')
  const first = await page.locator('.moment-card').evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(first.length).toBeGreaterThan(0)
  await page.reload()
  await expect(search).toHaveValue('摄影')
  expect(await page.locator('.moment-card').evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual(first)
  await page.goto('/archive')
  await page.goto('/moments/m-1')
  await page.getByRole('link', { name: '返回朋友圈', exact: true }).first().click()
  await expect(page).toHaveURL(/\/moments$/)
})

test('三主题明暗色的正文辅助与强调文字对比、设置焦点和减动效', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const measurements: unknown[] = []
  for (const layout of ['nexus', 'aurora', 'dock']) {
    await theme(page, layout)
    for (const [mode, label] of [
      ['light', '浅色'],
      ['dark', '深色'],
    ]) {
      await openAppearance(page)
      await page
        .getByRole('dialog', { name: '界面设置', exact: true })
        .getByRole('button', { name: label, exact: true })
        .press('Enter')
      await expect(page.locator('html')).toHaveClass(new RegExp(mode!))
      await page.getByRole('button', { name: '关闭界面设置', exact: true }).press('Escape')
      await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '界面设置', exact: true })).toBeFocused()
      const result = await page.evaluate(() => {
        const root = document.querySelector('.page-root')!
        const css = getComputedStyle(root)
        const luminance = (hex: string) => {
          const raw = hex.trim().replace('#', '')
          const normalized = raw.length === 3 ? [...raw].map((character) => character + character).join('') : raw
          const channels = normalized.match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255)
          return channels
            .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
            .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0)
        }
        const samples = ['--text-main', '--text-muted', '--text-soft', '--text-faint', '--accent-text'].flatMap(
          (foreground) =>
            ['--surface-1', '--surface-2', '--surface-3'].map((background) => {
              const fg = css.getPropertyValue(foreground).trim()
              const bg = css.getPropertyValue(background).trim()
              const light = Math.max(luminance(fg), luminance(bg))
              const dark = Math.min(luminance(fg), luminance(bg))
              return { foreground, background, fg, bg, ratio: (light + 0.05) / (dark + 0.05) }
            }),
        )
        return {
          samples,
          htmlScroll: getComputedStyle(document.documentElement).scrollBehavior,
          sidebarMotion: document.getElementById('right-sidebar-target')?.className,
          dockBackground: css.getPropertyValue('--dock-bg').trim(),
          infiniteAnimations: document
            .getAnimations()
            .filter(
              (animation) => animation.effect?.getTiming().iterations === Infinity && animation.playState === 'running',
            ).length,
        }
      })
      for (const sample of result.samples)
        expect(sample.ratio, `${layout}/${mode} ${sample.foreground}/${sample.background}`).toBeGreaterThanOrEqual(4.5)
      expect(result.htmlScroll).toBe('auto')
      expect(result.infiniteAnimations).toBe(0)
      measurements.push({ layout, mode, ...result })
      await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${layout}-${mode}.png`) })
    }
  }
  await testInfo.attach('三主题明暗色计算样式', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  })
})

test('搜索可以循环焦点、Esc关闭、保留原生结果链接并恢复触发点', async ({ page }, testInfo) => {
  await page.goto('/')
  const entry = page.getByRole('button', { name: '搜索站内文章、标签...', exact: true })
  await entry.click()
  const dialog = page.getByRole('dialog', { name: '站内搜索' })
  const input = dialog.getByRole('textbox', { name: '搜索文章、项目和友链' })
  await expect(input).toBeFocused()
  await input.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: '关闭搜索' })).toBeFocused()
  await input.fill('分页样本')
  await expect(dialog.getByRole('link').first()).toHaveAttribute('href', /^\/articles\//)
  await dialog.screenshot({ animations: 'disabled', path: testInfo.outputPath('search-results.png') })
  await dialog.getByRole('button', { name: '关闭搜索' }).press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(entry).toBeFocused()
  await expect(page.locator('[inert]')).toHaveCount(0)
})

test('三主题的手机登录只打开一个表单并归还焦点', async ({ page }) => {
  for (const layout of ['nexus', 'aurora', 'dock']) {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/')
    await theme(page, layout)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/tabs')
    const entry = page.locator('.tabs-guest-toast').getByRole('button', { name: '登录', exact: true })
    await entry.click()
    const dialog = page.getByRole('dialog', { name: '博主登录', exact: true })
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByRole('textbox', { name: '用户名', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: '关闭', exact: true }).press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(entry).toBeFocused()
  }
})

test('网络请求失败时切换主题仍保留文章和未发送的评论', async ({ page }, testInfo) => {
  await page.goto('/articles/5')
  const draft = page.getByRole('textbox', { name: '评论内容', exact: true })
  await draft.fill('主题加载失败也不能丢失这段草稿')
  await page.waitForLoadState('networkidle')
  await page.route('**/api/v1/**', (route) => (route.request().method() === 'GET' ? route.abort() : route.continue()))
  await openAppearance(page)
  await page.getByRole('button', { name: 'Aurora 双栏 布局主题', exact: true }).click()
  await expect(page.locator('.theme-aurora')).toBeVisible()
  await expect(page.getByRole('heading', { name: '分页样本 004', exact: true })).toBeVisible()
  await expect(draft).toHaveValue('主题加载失败也不能丢失这段草稿')
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('theme-failure-preserves-draft.png') })
  await page.unroute('**/api/v1/**')
})

test('评论请求在途切换主题仍保持忙碌状态并只提交一次', async ({ page }) => {
  await page.goto('/articles/6')
  const draft = page.getByRole('textbox', { name: '评论内容', exact: true })
  await draft.fill('切换主题期间正在提交的评论')
  let resume!: () => Promise<void>
  let requests = 0
  await page.route('**/api/v1/posts/6/comments', (route) => {
    if (route.request().method() === 'POST') {
      requests++
      resume = () => route.continue()
    } else return route.continue()
  })
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await page.getByRole('textbox', { name: '昵称 *', exact: true }).fill('UX 在途访客')
  await page.getByRole('button', { name: '确认身份', exact: true }).click()
  await expect.poll(() => typeof resume).toBe('function')
  await expect(draft).toBeDisabled()
  await theme(page, 'aurora')
  await expect(draft).toBeDisabled()
  await expect(draft).toHaveValue('切换主题期间正在提交的评论')
  await resume()
  await expect(page.getByText('切换主题期间正在提交的评论', { exact: true })).toBeVisible()
  await expect(draft).toHaveValue('')
  expect(requests).toBe(1)
})

test('书签设置与导入嵌套时只关闭顶层，命令面板无结果也可键盘退出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tabs')
  const entry = page.getByRole('button', { name: '书签设置', exact: true })
  await entry.click()
  const settings = page.getByRole('dialog', { name: '标签页设置', exact: true })
  await settings.getByRole('button', { name: '数据', exact: true }).click()
  const openImport = settings.getByRole('button', { name: /^导入数据/ })
  await openImport.click()
  const importing = page.getByRole('dialog', { name: '导入书签', exact: true })
  await expect(importing).toBeVisible()
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    expect(await importing.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(importing).toHaveCount(0)
  await expect(settings).toBeVisible()
  await expect(openImport).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)
  await expect(entry).toBeFocused()
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: '书签命令面板', exact: true })
  await expect(palette).toBeVisible()
  const query = palette.getByRole('textbox', { name: '搜索书签、分类和命令', exact: true })
  await expect(query).toBeFocused()
  await query.fill('没有这个书签zzzzzz')
  await expect(palette.getByText('无匹配结果')).toBeVisible()
  await query.press('Tab')
  await palette.getByRole('button', { name: '关闭命令面板', exact: true }).press('Escape')
  await expect(palette).toHaveCount(0)
  await expect(entry).toBeFocused()
})

for (const fromLastPage of [false, true]) {
  test(`${fromLastPage ? '末页' : '首页'}切连续，失败重试后全部文章唯一有序完整`, async ({
    page,
    request,
  }, testInfo) => {
    // 同一隔离库中的发布测试会新增文章，验证真实接口全集，避免固定106条的顺序依赖。
    const initialResponse = await request.get('/api/v1/posts?page=1&pageSize=15')
    expect(initialResponse.ok()).toBe(true)
    const { total } = (await initialResponse.json()).data as { total: number }
    expect(total).toBeGreaterThanOrEqual(106)
    const pageCount = Math.ceil(total / 15)
    await page.goto('/')
    const cards = page.locator('.post-list a[href^="/articles/"]')
    await expect(cards).toHaveCount(15)
    if (fromLastPage) {
      await page.getByRole('button', { name: String(pageCount), exact: true }).click()
      await expect(cards).toHaveCount(total - (pageCount - 1) * 15)
    }
    await page.getByRole('button', { name: '连续加载', exact: true }).click()
    await expect(cards).toHaveCount(15)
    const first = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    let failed = false
    await page.route('**/api/v1/posts?**', async (route) => {
      if (!failed && new URL(route.request().url()).searchParams.get('page') === '2') {
        failed = true
        await route.abort()
      } else await route.continue()
    })
    await cards.last().scrollIntoViewIfNeeded()
    await expect(page.getByRole('alert').filter({ hasText: '文章加载失败' })).toBeVisible()
    expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))).toEqual(first)
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await expect(cards).toHaveCount(30)
    for (let pageNumber = 3; pageNumber <= pageCount; pageNumber++) {
      await cards.last().scrollIntoViewIfNeeded()
      await expect(cards).toHaveCount(Math.min(pageNumber * 15, total))
    }
    const actual = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    const expected: string[] = []
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const response = await request.get(`/api/v1/posts?page=${pageNumber}&pageSize=15`)
      const data = (await response.json()).data
      expected.push(...data.items.map((post: { id: number; slug?: string }) => `/articles/${post.slug || post.id}`))
    }
    expect(actual).toEqual(expected)
    expect(new Set(actual).size).toBe(total)
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('continuous-complete.png') })
    await testInfo.attach('完整ID集合', { body: JSON.stringify({ expected, actual }), contentType: 'application/json' })
  })
}

test('三主题六个有向切换保留评论草稿与回复目标，且无空白或页面异常', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/articles/1')
  await page.getByRole('textbox', { name: '评论内容', exact: true }).fill('UX 主题回复目标')
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await page.getByRole('textbox', { name: '昵称 *', exact: true }).fill('UX 主题访客')
  await page.getByRole('button', { name: '确认身份', exact: true }).click()
  await page.getByRole('button', { name: '回复 UX 主题访客的评论', exact: true }).click()
  await page.getByRole('textbox', { name: '回复内容', exact: true }).fill('尚未发送的回复，切换后继续编辑')
  const directions: string[] = []
  let previous = 'nexus'
  for (const target of ['aurora', 'dock', 'nexus', 'dock', 'aurora', 'nexus']) {
    await theme(page, target)
    await expect(page.getByRole('textbox', { name: '回复内容', exact: true })).toHaveValue(
      '尚未发送的回复，切换后继续编辑',
    )
    await expect(page.getByText('UX 主题回复目标', { exact: true })).toBeVisible()
    expect(await page.locator('main').innerText()).toContain('分页样本 000')
    directions.push(`${previous}->${target}`)
    previous = target
  }
  expect(new Set(directions).size).toBe(6)
  expect(errors).toEqual([])
  await page
    .getByRole('textbox', { name: '回复内容', exact: true })
    .screenshot({ animations: 'disabled', path: testInfo.outputPath('preserved-reply.png') })
  await testInfo.attach('主题切换记录', {
    body: JSON.stringify({ directions, errors }),
    contentType: 'application/json',
  })
  await page.goto('/articles/2')
  await expect(page.getByRole('textbox', { name: '评论内容', exact: true })).toHaveValue('')
})

test('320至1024px均能使用文章筛选、目录、书签分组和登录', async ({ page }, testInfo) => {
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await page.getByRole('button', { name: '筛选文章', exact: true }).click()
    const filters = page.getByRole('dialog', { name: '筛选文章', exact: true })
    const tag = filters.getByRole('group', { name: '按标签筛选' }).getByRole('button', { name: /示例标签/ })
    await tag.press('Space')
    await expect(tag).toHaveAttribute('aria-pressed', 'true')
    await filters.getByRole('button', { name: '关闭筛选文章' }).click()
    await expect(page.getByRole('button', { name: '筛选文章', exact: true })).toBeFocused()
    await page.goto('/articles/106')
    await page.getByRole('button', { name: '文章目录', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '文章目录', exact: true }).getByRole('link').first()).toBeVisible()
    await page.getByRole('button', { name: '关闭文章目录', exact: true }).click()
    await page.goto('/tabs')
    await expect(page.getByLabel('书签分组', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '书签设置', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '标签页设置' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.locator('.tabs-guest-toast').getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '博主登录', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '用户名', exact: true })).toBeFocused()
    await expect(page.locator('.auth-modal-overlay')).toHaveCSS('opacity', '1')
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`mobile-login-${width}.png`) })
    await page.keyboard.press('Escape')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    expect(overflow).toBe(false)
  }
})
