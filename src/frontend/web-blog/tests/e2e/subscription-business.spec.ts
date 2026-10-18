/** @file subscription-business.spec.ts @description 订阅真实公开/管理/本机闭环及三主题响应式验收，全部运行于隔离库 */
import { expect, test } from '@playwright/test'
import type { Page, APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function adminApi(request: APIRequestContext) {
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken
  let writes = 0
  return async (path: string, method = 'GET', data?: unknown) => {
    if (method !== 'GET' && ++writes % 5 === 0) await delay(1100)
    const response = await request.fetch('/api/v1' + path, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status(), `${method} ${path}`).toBeLessThan(300)
    return (await response.json()).data
  }
}
function currencyButton(page: Page, currency: string) {
  return page
    .getByRole('navigation', { name: '订阅币种', exact: true })
    .getByRole('button', { name: currency, exact: true })
}
async function openDetail(page: Page, name: string) {
  await page
    .getByRole('article', { name, exact: true })
    .getByRole('button', { name: `查看${name}的订阅详情`, exact: true })
    .click()
  const detail = page.getByRole('dialog', { name: `${name}订阅详情`, exact: true })
  await expect(detail).toBeVisible()
  return detail
}
async function closeDetail(page: Page, name: string) {
  const detail = page.getByRole('dialog', { name: `${name}订阅详情`, exact: true })
  await detail.getByRole('button', { name: '关闭订阅详情', exact: true }).click()
  await expect(detail).toHaveCount(0)
  await expect(page.getByRole('button', { name: `查看${name}的订阅详情`, exact: true })).toBeFocused()
}
async function expectFullMatchingCount(page: Page, count: number) {
  const stats = page.getByRole('region', { name: '订阅费用统计', exact: true })
  const explain = stats.getByRole('button', { name: '查看预算统计口径', exact: true })
  if ((await explain.getAttribute('aria-expanded')) !== 'true') await explain.click()
  await expect(stats.getByRole('region', { name: '预算统计口径', exact: true })).toContainText(`${count} 条`)
}
async function verifyForecast(page: Page, currency: string) {
  await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(1)
  await page.getByRole('button', { name: '查看续费预测', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '查看续费预测', exact: true })
  await expect(drawer.getByRole('region', { name: `${currency}续费预测`, exact: true })).toHaveAttribute(
    'data-currency',
    currency,
  )
  await expect(drawer.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(1)
  await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(2)
  await drawer.getByText('查看预计续费文字明细', { exact: true }).click()
  await expect(drawer.locator('.subscription-forecast__amounts > li')).toHaveCount(12)
  await drawer.getByRole('button', { name: '关闭查看续费预测', exact: true }).click()
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(1)
}
async function localForm(page: Page, name: string, amount = '20', currency = 'USD') {
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await page.getByRole('button', { name: '添加我的订阅', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toBeFocused()
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill(name)
  await page.getByRole('combobox', { name: '订阅币种', exact: true }).selectOption(currency)
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill(amount)
}

test('默认USD且所有七个币种都可分享，预算与列表只有一个币种来源', async ({ page }) => {
  await page.goto('/subscriptions')
  await expect(currencyButton(page, 'USD')).toHaveAttribute('aria-pressed', 'true')
  const controls = page.getByRole('navigation', { name: '订阅币种', exact: true })
  await expect(controls.getByRole('button')).toHaveCount(7)
  await expect(page.getByRole('combobox', { name: '图表币种', exact: true })).toHaveCount(0)
  for (const currency of ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD', 'TWD']) {
    await currencyButton(page, currency).click()
    await expect(page).toHaveURL(new RegExp(`currency=${currency}`))
    await expect(currencyButton(page, currency)).toHaveAttribute('aria-pressed', 'true')
    await expect(controls.locator('[aria-pressed="true"]')).toHaveCount(1)
    await expect(page.getByRole('region', { name: `${currency}订阅列表`, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: '订阅费用统计', exact: true })).toHaveAttribute(
      'data-currency',
      currency,
    )
  }
  await page.goto('/subscriptions?currency=JPY')
  await expect(currencyButton(page, 'JPY')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: '订阅费用统计' })).toContainText('JPY 12,000')
})

test('切换数据来源沿用同一币种，本机切换不改地址且本机编辑默认折叠', async ({ page }) => {
  // 币种是页面级语境：切换来源后继续查看同一币种；本机来源的切换只在本页生效，不写入博主视图地址。
  await page.goto('/subscriptions?currency=JPY')
  await expect(currencyButton(page, 'JPY')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await expect(currencyButton(page, 'JPY')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toHaveCount(0)
  await currencyButton(page, 'GBP').click()
  await expect(currencyButton(page, 'GBP')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/currency=JPY/)
  await page.getByRole('button', { name: '博主订阅', exact: true }).click()
  await expect(currencyButton(page, 'GBP')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/currency=GBP/)
  await expect(page.getByRole('region', { name: '订阅费用统计', exact: true })).toHaveAttribute('data-currency', 'GBP')
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await expect(currencyButton(page, 'GBP')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '添加我的订阅', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '订阅币种', exact: true })).toHaveValue('GBP')
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill('本机未保存的记录')
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('12.50')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '博主订阅', exact: true }).click()
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toHaveValue('本机未保存的记录')
  await expect(page.getByRole('textbox', { name: '订阅金额', exact: true })).toHaveValue('12.50')
  await expect(page.getByRole('combobox', { name: '订阅币种', exact: true })).toHaveValue('GBP')
  expect(await page.evaluate(() => localStorage.getItem('blog-my-subscriptions'))).toBeNull()
})

test('公开分页覆盖全量统计，图标来源优先级和浏览器返回一致', async ({ page, request }) => {
  const api = await adminApi(request),
    prefix = `阅读服务 ${randomUUID()}`,
    created: number[] = []
  try {
    // 单币种页面仍使用跨页代表数据；这些暂停的零金额条目不改变其它用例的持续预算。
    for (let index = 0; index < 13; index++) {
      const item = await api('/admin/subscriptions', 'POST', {
        requestId: randomUUID(),
        name: `${prefix} ${String(index + 1).padStart(2, '0')}`,
        currency: 'USD',
        amount: 0,
        billingCycle: 'monthly',
        subscriptionStatus: 'paused',
        status: 'published',
      })
      created.push(item.id)
    }
    await page.goto(`/subscriptions?currency=USD&q=${encodeURIComponent(prefix)}`)
    const cards = page.locator('article[aria-label]')
    await expect(cards).toHaveCount(12)
    await expectFullMatchingCount(page, 13)
    const firstPageNames = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
    await page.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(cards).toHaveCount(1)
    await expectFullMatchingCount(page, 13)
    const secondPageNames = await cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
    expect(new Set([...firstPageNames, ...secondPageNames]).size).toBe(13)
    await page.goBack()
    await expect(cards).toHaveCount(12)
    expect(await cards.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(
      firstPageNames,
    )
    await currencyButton(page, 'USD').focus()
    await expect(currencyButton(page, 'USD')).toBeFocused()
    await page.goto('/subscriptions?currency=EUR')
    const managed = page.getByRole('article', { name: 'Vue 开源支持', exact: true }).getByRole('img')
    await managed.scrollIntoViewIfNeeded()
    await expect(managed).toHaveAttribute('src', /^\/api\/v1\/media\//)
    await expect.poll(() => managed.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await page.goto('/subscriptions?currency=CNY')
    const automatic = page.getByRole('article', { name: 'Vue 生态赞助', exact: true }).getByRole('img')
    await automatic.scrollIntoViewIfNeeded()
    await expect(automatic).toHaveAttribute('src', /^\/api\/v1\/subscriptions\/favicons\//)
    await expect.poll(() => automatic.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  } finally {
    const cleanupErrors: unknown[] = []
    for (const id of created) {
      try {
        const latest = await api(`/admin/subscriptions/${id}`)
        await api(`/admin/subscriptions/${id}?revision=${latest.revision}`, 'DELETE')
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    expect(cleanupErrors).toEqual([])
  }
})

test('已加载的统计在真实布局切换、普通动效和返回导航中保持一致', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/subscriptions?currency=USD')
  const stats = page.getByRole('region', { name: '订阅费用统计' })
  await expect(stats).toContainText('USD 529.00')
  for (const [id, name] of [
    ['aurora', 'Aurora 双栏'],
    ['dock', 'Dock 浮岛'],
    ['nexus', 'Nexus 三栏'],
  ]) {
    await page.getByRole('button', { name: '界面设置', exact: true }).click()
    await page.getByRole('button', { name: `${name} 布局主题`, exact: true }).click()
    await expect(page.locator(`.theme-${id}`)).toBeVisible()
    await expect(stats).toContainText('USD 529.00')
    await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(1)
    await expect(page).toHaveURL(/currency=USD/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(errors).toEqual([])
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 1279, 1280, 1439, 1440]) {
    test(`订阅 ${theme}/${width} 明暗、图表和真实筛选`, async ({ page, context, baseURL, request }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await context.addCookies([{ name: 'blog-layout-theme', value: theme, url: baseURL! }])
      await page.setViewportSize({ width, height: 960 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(() => {
        if (!localStorage.getItem('nuxt-color-mode')) localStorage.setItem('nuxt-color-mode', 'light')
      })
      await page.goto('/subscriptions?currency=USD')
      await expect(page.locator(`.theme-${theme}`)).toBeVisible()
      await expect(page.getByRole('heading', { name: '平台订阅费', exact: true })).toBeVisible()
      const stats = page.getByRole('region', { name: '订阅费用统计' })
      await expect(stats).toContainText('USD 529.00')
      await expect(stats).toHaveAttribute('data-currency', 'USD')
      await expect(stats.getByRole('heading', { name: 'USD 月均预算', exact: true })).toHaveCount(1)
      await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]').first()).toBeVisible()
      await expect(page.getByRole('article', { name: 'ChatGPT Plus', exact: true })).toContainText('USD 20.00')
      await verifyForecast(page, 'USD')
      const live = await request.get('/api/v1/subscriptions/stats?currency=USD')
      expect((await live.json()).data.currencies[0].annualAmount).toBe(52900)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await currencyButton(page, 'JPY').click()
      await expect(page).toHaveURL(/currency=JPY/)
      await expect(stats).toContainText('JPY 12,000')
      await expect(page.getByRole('article', { name: 'Kindle Unlimited（日本）', exact: true })).toContainText(
        'JPY 1,000',
      )
      const yenDetail = await openDetail(page, 'Kindle Unlimited（日本）')
      await yenDetail.locator('summary').click()
      await expect(yenDetail.getByRole('heading', { name: /第 .* 段/ })).toHaveCount(2)
      await closeDetail(page, 'Kindle Unlimited（日本）')
      await currencyButton(page, 'USD').click()
      await expect(stats).toContainText('USD 529.00')
      await currencyButton(page, 'USD').scrollIntoViewIfNeeded()
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `subscription-${theme}-${width}-light.png`)
      await page.getByRole('button', { name: '切换主题（当前：浅色）', exact: true }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(stats).toContainText('USD 529.00')
      await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `subscription-${theme}-${width}-dark.png`)
      await page.getByRole('button', { name: /^筛选(?: · \d+)?$/ }).click()
      const filterDrawer = page.getByRole('dialog', { name: /^筛选(?: · \d+)?$/ })
      await filterDrawer.getByRole('combobox', { name: '筛选订阅状态', exact: true }).selectOption('trial')
      await filterDrawer.getByRole('button', { name: '查看结果', exact: true }).click()
      await expect(stats).toContainText('USD 0.00')
      await expect(stats).toContainText('当前币种没有非零持续费用')
      await page.getByRole('textbox', { name: '搜索当前币种订阅', exact: true }).fill('不存在的订阅名字')
      await page.getByRole('textbox', { name: '搜索当前币种订阅', exact: true }).press('Enter')
      await expect(page.getByText('没有匹配的订阅', { exact: true })).toBeVisible()
      expect(errors).toEqual([])
    })
  }
}

test('后台草稿、发布、价格历史、公开页内联编辑与软删除闭环', async ({ page, request }, testInfo) => {
  const api = await adminApi(request),
    name = `窗边写作 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/subscriptions/new')
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill(name)
  await page.getByRole('combobox', { name: '订阅币种', exact: true }).selectOption('USD')
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('12.34')
  await page.getByRole('textbox', { name: '订阅备注', exact: true }).fill('账户备注保持私有')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/subscriptions\/\d+$/)
  const id = Number(page.url().split('/').pop()),
    draft = await api(`/admin/subscriptions/${id}`)
  expect(draft.amount).toBe(1234)
  expect(draft.priceHistory).toHaveLength(1)
  expect((await request.get(`/api/v1/subscriptions/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: '发布订阅', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '订阅已保存' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: '订阅金额', exact: true })).toHaveValue('12.34')
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('15.00')
  await page.getByRole('textbox', { name: '变价原因', exact: true }).fill('更换套餐')
  await page.getByRole('button', { name: '保存订阅', exact: true }).click()
  await expect.poll(async () => (await api(`/admin/subscriptions/${id}`)).priceHistory.length).toBe(2)
  await page.goto(`/subscriptions?q=${encodeURIComponent(name)}`)
  const card = page.getByRole('article', { name, exact: true })
  await expect(card).toContainText('USD 15.00')
  const detail = await openDetail(page, name)
  await expect(detail).not.toContainText('账户备注保持私有')
  await detail.getByRole('button', { name: '编辑订阅', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toBeFocused()
  await expect(page.getByRole('textbox', { name: '订阅备注', exact: true })).toHaveValue('账户备注保持私有')
  await page.getByRole('textbox', { name: '订阅描述', exact: true }).fill('前台快捷整理用途')
  await page.getByRole('button', { name: '保存订阅', exact: true }).click()
  await expect(await openDetail(page, name)).toContainText('前台快捷整理用途')
  await closeDetail(page, name)
  expect((await api(`/admin/subscriptions/${id}`)).priceHistory).toHaveLength(2)
  await captureMotion(page, testInfo, 'subscription-inline-saved.png')
  await page.goto(`/admin/subscriptions?q=${encodeURIComponent(name)}`)
  const row = page.locator('.subscription-admin-list > li').filter({ hasText: name })
  await row.getByRole('button', { name: '提高排序', exact: true }).click()
  await expect(row).toContainText('排序 1')
  await row.getByRole('button', { name: '撤回订阅', exact: true }).click()
  await expect(row).toContainText('已撤回')
  expect((await request.get(`/api/v1/subscriptions/${id}`)).status()).toBe(404)
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: '删除订阅', exact: true }).click()
  await expect(row).toHaveCount(0)
})

test('访客本机新增、刷新、变价、跨标签冲突与删除不会上传', async ({ page, context }, testInfo) => {
  const mutations: string[] = [],
    name = `本机工作空间 ${randomUUID()}`
  context.on('request', (request) => {
    if (/\/api\/v1\/(admin\/)?subscriptions/.test(request.url()) && request.method() !== 'GET')
      mutations.push(request.url())
  })
  await page.goto('/subscriptions')
  await localForm(page, name)
  await page.getByRole('button', { name: '保存到当前浏览器', exact: true }).click()
  await expect(page.getByRole('article', { name, exact: true })).toContainText('USD 20.00')
  await page.reload()
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  const card = page.getByRole('article', { name, exact: true })
  await (await openDetail(page, name)).getByRole('button', { name: '编辑订阅', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toBeFocused()
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('25.00')
  const other = await context.newPage()
  try {
    await other.goto('/subscriptions')
    await other.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
    await (await openDetail(other, name)).getByRole('button', { name: '编辑订阅', exact: true }).click()
    await expect(other.getByRole('textbox', { name: '服务名称', exact: true })).toBeFocused()
    await other.getByRole('textbox', { name: '订阅描述', exact: true }).fill('另一个标签页的说明')
    await other.getByRole('button', { name: '保存到当前浏览器', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('另一个标签页')
    await expect(page.getByRole('textbox', { name: '订阅金额', exact: true })).toHaveValue('25.00')
    await page.getByRole('button', { name: '读取最新记录并保留输入', exact: true }).click()
    await page.getByRole('button', { name: '保存到当前浏览器', exact: true }).click()
    await expect(card).toContainText('USD 25.00')
    const detail = await openDetail(page, name)
    await expect(detail).toContainText('另一个标签页的说明')
    await expect(detail.locator('summary')).toContainText('2 条')
    await closeDetail(page, name)
    await expect(other.getByRole('article', { name, exact: true })).toContainText('USD 25.00')
    await captureMotion(page, testInfo, 'subscription-local-saved.png')
    page.once('dialog', (dialog) => dialog.accept())
    await (await openDetail(page, name)).getByRole('button', { name: '删除订阅', exact: true }).click()
    await expect(card).toHaveCount(0)
    await expect(other.getByRole('article', { name, exact: true })).toHaveCount(0)
    expect(mutations).toEqual([])
  } finally {
    await other.close()
  }
})

test('本地存储损坏与配额不足保留原文和未保存输入', async ({ page }) => {
  await page.goto('/subscriptions')
  await page.evaluate(() => localStorage.setItem('blog-my-subscriptions', '{broken'))
  await page.reload()
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('原始数据已保留')
  expect(await page.evaluate(() => localStorage.getItem('blog-my-subscriptions'))).toBe('{broken')
  await page.evaluate(() => localStorage.removeItem('blog-my-subscriptions'))
  await page.locator('.subscription-local-panel').getByRole('button', { name: '重试', exact: true }).click()
  await page.getByRole('button', { name: '添加我的订阅', exact: true }).click()
  await page.getByRole('textbox', { name: '服务名称', exact: true }).fill('留住未保存的输入')
  await page.getByRole('textbox', { name: '订阅金额', exact: true }).fill('8')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'blog-my-subscriptions') throw new DOMException('quota', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '保存到当前浏览器', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '服务名称', exact: true })).toHaveValue('留住未保存的输入')
  expect(await page.evaluate(() => localStorage.getItem('blog-my-subscriptions'))).toBeNull()
  await expect(page.getByRole('status').filter({ hasText: '已保存到当前浏览器' })).toHaveCount(0)
})

test('公开请求失败显示真实错误并允许恢复，不回退样本', async ({ page }) => {
  await page.goto('/subscriptions')
  const stats = page.getByRole('region', { name: '订阅费用统计' })
  await expect(stats).toBeVisible()
  await page.route('**/api/v1/subscriptions*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 503, message: '暂时不可用', data: null }),
    }),
  )
  await currencyButton(page, 'JPY').click()
  await expect(page.getByText('订阅服务暂时不可用，请稍后重试', { exact: true })).toBeVisible()
  await expect(stats).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Kindle Unlimited（日本）', exact: true })).toHaveCount(0)
  await page.unroute('**/api/v1/subscriptions*')
  await page.getByRole('button', { name: /重试/ }).click()
  await expect(stats).toContainText('JPY 12,000')
})

test('favicon 从失败降级到同地址获取成功后，保存刷新恢复现有卡片图标', async ({ page, request }) => {
  const api = await adminApi(request)
  const name = `开源支持记录 ${randomUUID()}`
  const item = await api('/admin/subscriptions', 'POST', {
    requestId: randomUUID(),
    name,
    amount: 1200,
    currency: 'USD',
    billingCycle: 'monthly',
    url: 'https://vuejs.org/',
    status: 'published',
  })
  let failedReads = 0
  try {
    await login(page)
    await page.route('**/api/v1/subscriptions/favicons/*.webp', (route) => {
      failedReads++
      return route.fulfill({ status: 404, headers: { 'Cache-Control': 'no-store' }, body: '图标缓存尚未生成' })
    })
    // 已登录页面水合后恢复会话会让公开读取失效并在客户端重读列表，后续须针对重读后的卡片。
    const reread = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/subscriptions' && response.request().method() === 'GET',
    )
    await page.goto(`/subscriptions?q=${encodeURIComponent(name)}`)
    expect((await reread).status()).toBe(200)
    const card = page.getByRole('article', { name, exact: true })
    await card.scrollIntoViewIfNeeded()
    await expect.poll(() => failedReads).toBeGreaterThan(0)
    await expect(card.locator('.subscription-list-icon')).toBeVisible()
    await expect(card.getByRole('img')).toHaveCount(0)
    // 写后失效会撤销旧代次并重读列表，卡片节点可能重建；这里验证不经整页重载即在卡片中恢复图标。
    await page.evaluate(() => ((window as unknown as { __sameDocument?: boolean }).__sameDocument = true))
    await page.unroute('**/api/v1/subscriptions/favicons/*.webp')
    await (await openDetail(page, name)).getByRole('button', { name: '编辑订阅', exact: true }).click()
    const fetched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/admin/subscriptions/fetch-favicon' &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: '获取官网图标', exact: true }).click()
    const iconResponse = await fetched
    expect(iconResponse.status()).toBe(201)
    expect((await iconResponse.json()).data.faviconUrl).toBe(item.faviconUrl)
    await expect(page.getByText('官网图标已获取。', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '保存订阅', exact: true }).click()
    await expect(page.getByRole('button', { name: '记录一个平台订阅', exact: true })).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true)
    const icon = card.getByRole('img')
    await expect(icon).toHaveAttribute('src', item.faviconUrl)
    await expect.poll(() => icon.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  } finally {
    const latest = await api(`/admin/subscriptions/${item.id}`)
    await api(`/admin/subscriptions/${item.id}?revision=${latest.revision}`, 'DELETE')
  }
})

test('金额上限和长名称在窄屏及动态缩放下保留精确预算与可读图表', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const name = '跨地区工具资料与阅读空间'.repeat(16).slice(0, 160)
  await page.setViewportSize({ width: 320, height: 960 })
  await page.goto('/subscriptions')
  await localForm(page, name, '21474836.47', 'USD')
  await page.getByLabel('开始日期', { exact: true }).fill('2024-01-28')
  await page.getByLabel('下次扣费日期', { exact: true }).fill(`${new Date().toISOString().slice(0, 7)}-28`)
  await page.getByRole('button', { name: '保存到当前浏览器', exact: true }).click()
  const card = page.getByRole('article', { name, exact: true })
  const stats = page.getByRole('region', { name: '订阅费用统计' })
  await expect(card).toContainText('USD 21,474,836.47')
  await expect(stats).toContainText('USD 257,698,037.64')
  await expect(page.locator('[data-subscription-chart][data-chart-ready="true"]')).toHaveCount(1)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    await expect
      .poll(() =>
        page.locator('[data-subscription-chart]').evaluateAll((elements) =>
          elements.every((element) => {
            const svg = element.querySelector('svg')
            return svg && Math.abs(svg.getBoundingClientRect().width - element.getBoundingClientRect().width) <= 1
          }),
        ),
      )
      .toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await stats.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    if (width === 320) await captureMotion(page, testInfo, 'subscription-maximum-amount-320.png', { target: card })
  }
  await verifyForecast(page, 'USD')
  await page.locator('a[href="/about"]:visible').first().click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.locator('[data-subscription-chart]')).toHaveCount(0)
  await page.goBack()
  await page.getByRole('button', { name: '我的订阅 · 本机', exact: true }).click()
  await expect(card).toContainText('USD 21,474,836.47')
  await expect(stats).toContainText('USD 257,698,037.64')
  expect(errors).toEqual([])
})
