/**
 * @file blog.spec.ts
 * @description 隔离生产预览的浏览器验收：分页、发布链路、评论恢复、主题及导入失败
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

interface PreviewResponseLoss {
  matchedResponses: number
  lostResponses: number
  status: number | null
  ticket: string
}

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

test('旧正文标题样式、未知语言回退和同前缀高亮在生产浏览器中正确', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('nuxt-color-mode', 'dark'))
  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await page.goto('/articles/106')
  const h2 = page.getByRole('heading', { name: '旧格式二级标题', exact: true })
  const h3 = page.getByRole('heading', { name: '旧格式三级标题', exact: true })
  await expect(h2).toHaveCSS('font-size', '20px')
  await expect(h2).toHaveCSS('margin-bottom', '16px')
  await expect(h3).toHaveCSS('font-size', '18px')
  await expect(h3).toHaveCSS('margin-top', '24px')
  const blocks = page.locator('.article-content__code-wrap')
  await expect(blocks).toHaveCount(3)
  await expect(blocks.nth(0).locator('code')).toHaveText('<img src=x onerror="alert(1)">')
  await expect(blocks.nth(0).locator('img, script, .shiki')).toHaveCount(0)
  await expect(blocks.nth(1).locator('code')).toHaveText('const sharedPrefixValue = "first"')
  await expect(blocks.nth(2).locator('code')).toHaveText('const sharedPrefixValue = "second"')
  await expect(blocks.nth(1).locator('.shiki')).toHaveCount(1)
  await expect(page.locator('html')).toHaveClass(/dark/)
  // github-dark 的关键字颜色为 #f97583；不能保留浅色主题的深红色。
  await expect(blocks.nth(1).locator('code .line > span').first()).toHaveCSS('color', 'rgb(249, 117, 131)')
  expect(dialogs).toEqual([])
  await expect(page.locator('.loading-screen')).toHaveCount(0)
  await captureMotion(page, testInfo, 'legacy-content.png', { target: page.locator('.article-content') })
})

async function publishArticle(page: Page) {
  await page.getByRole('button', { name: '发布文章', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: '发布前检查', exact: true })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: '确认公开发布', exact: true }).click()
}

async function login(page: Page, username = process.env.E2E_USERNAME!, password = process.env.E2E_PASSWORD!) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(password)
  const loginResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const response = await loginResponse
  expect(response.ok()).toBe(true)
  const token = (await response.json()).data.accessToken as string
  const sessionId = (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sid: string }).sid
  expect(sessionId).toMatch(/^[a-f0-9-]{36}$/)
  await expect(page).toHaveURL(/\/admin$/)
  return { sessionId, agent: (await response.request().headerValue('user-agent')) ?? '' }
}

async function expectSessionDevice(row: Locator, agent: string) {
  // 各浏览器对自定义 UA 的支持不同，以实际登录请求验证设备说明，以真实 sid 定位撤销对象。
  const systems = [
    ['Windows', /Windows/i],
    ['Android', /Android/i],
    ['iOS', /iPhone|iPad|iPod/i],
    ['macOS', /Macintosh|Mac OS X/i],
    ['Linux', /Linux/i],
  ] as const
  const browsers = [
    ['Edge', /Edg\//i],
    ['Firefox', /Firefox\//i],
    ['Chrome', /Chrome\/|Chromium\//i],
    ['Safari', /Safari\//i],
  ] as const
  const system = systems.find(([, pattern]) => pattern.test(agent))?.[0] ?? '未知系统'
  const browser = browsers.find(([, pattern]) => pattern.test(agent))?.[0] ?? '未知客户端'
  await expect(row.getByRole('heading')).toHaveText(`${system} · ${browser}`)
}

test('106 篇文章可以通过真实后端翻到最后一页', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^分页样本 105/ })).toBeVisible()
  const response = page.waitForResponse(
    (item) => item.url().includes('/api/v1/posts?') && new URL(item.url()).searchParams.get('page') === '8',
  )
  await page.getByRole('button', { name: '8', exact: true }).click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('link', { name: /^分页样本 000/ })).toBeVisible()
  await expect(page.getByText('8 / 8', { exact: true })).toBeVisible()
})

test('真实登录、草稿发布、公开发现和撤回形成完整闭环', async ({ page, request }) => {
  await login(page)
  await page.getByRole('link', { name: '新建文章', exact: true }).click()
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 发布验收')
  await page.getByRole('textbox', { name: '摘要', exact: true }).fill('E2E 唯一摘要关键词')
  await page.getByLabel('专栏', { exact: true }).fill('验收专栏')
  await page.getByRole('textbox', { name: '标签（逗号分隔）', exact: true }).fill('验收标签')
  await page
    .getByRole('textbox', { name: 'Markdown 正文', exact: true })
    .fill('# 标题\n\n**正确的加粗**\n\n```text\n<img src=x onerror="alert(1)">\n```')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const id = page.url().split('/').pop()!
  expect((await request.get(`/api/v1/posts/${id}`)).status()).toBe(404)
  await publishArticle(page)
  await expect(page.getByText('当前状态：已发布')).toBeVisible()
  await page.getByRole('link', { name: '查看公开文章', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'E2E 发布验收', exact: true })).toBeVisible()
  await expect(page.locator('.article-markdown strong')).toHaveText('正确的加粗')
  await expect(page.locator('.article-markdown code')).toContainText('<img src=x')
  await expect(page.locator('.article-markdown img')).toHaveCount(0)
  await page.goto('/archive')
  await expect(page.getByRole('link', { name: /E2E 发布验收/ })).toBeVisible()
  expect(await (await request.get('/rss.xml')).text()).toContain(`/articles/${id}`)
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain(`/articles/${id}`)
  expect(sitemap).not.toContain('/admin')
  expect(sitemap).not.toContain('_theme-engine-devtools')
  expect((await request.get('/_theme-engine-devtools')).status()).toBe(404)
  expect((await (await request.get('/api/v1/posts?search=E2E')).json()).data.total).toBe(1)
  await page.goto(`/admin/posts/${id}`)
  await page.getByRole('button', { name: '撤回为草稿', exact: true }).click()
  await expect(page.getByText('当前状态：草稿')).toBeVisible()
  expect((await request.get(`/api/v1/posts/${id}`)).status()).toBe(404)
  expect(await (await request.get('/rss.xml')).text()).not.toContain(`/articles/${id}`)
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(`/articles/${id}`)
  expect((await (await request.get('/api/v1/posts?search=E2E')).json()).data.total).toBe(0)
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/admin/posts')
  await expect(page.getByRole('heading', { name: '博主登录' })).toBeVisible()
})

test('游客评论、回复、点赞刷新及网络失败重试不丢草稿', async ({ page, request }) => {
  await page.goto('/articles/1')
  await page.getByRole('textbox', { name: '评论内容', exact: true }).fill('E2E 根评论')
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await page.getByRole('textbox', { name: '昵称 *', exact: true }).fill('E2E 游客')
  await page.getByRole('button', { name: '确认身份', exact: true }).click()
  await expect(page.getByText('E2E 根评论', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '回复 E2E 游客的评论', exact: true }).click()
  await page.getByRole('textbox', { name: '回复内容', exact: true }).fill('E2E 回复')
  await page.getByRole('button', { name: '发表回复', exact: true }).click()
  await expect(page.getByText('E2E 回复', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '点赞 E2E 游客的评论', exact: true }).first().click()
  await page.reload()
  await expect(page.getByRole('button', { name: '取消点赞 E2E 游客的评论', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.route('**/api/v1/posts/1/comments', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  await page.getByRole('textbox', { name: '评论内容', exact: true }).fill('E2E 网络恢复')
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: '草稿已保留' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '评论内容', exact: true })).toHaveValue('E2E 网络恢复')
  await page.unroute('**/api/v1/posts/1/comments')
  await page.getByRole('button', { name: '发布评论', exact: true }).dblclick()
  await expect(page.getByText('E2E 网络恢复', { exact: true })).toBeVisible()
  const data = (await (await request.get('/api/v1/posts/1/comments')).json()).data
  expect(data.items.filter((item: { content: string }) => item.content === 'E2E 网络恢复')).toHaveLength(1)
})

test('三套主题在 390px 下可评论，Dock 导航保持可访问名称', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/articles/2')
  for (const [index, label] of ['Aurora 双栏 布局主题', 'Dock 浮岛 布局主题', 'Nexus 三栏 布局主题'].entries()) {
    await page.getByRole('button', { name: '界面设置', exact: true }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    const input = page.getByRole('textbox', { name: '评论内容', exact: true })
    await input.click()
    await input.fill(`E2E 移动主题 ${index}`)
    const bounds = await input.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: '发布评论', exact: true }).click()
    if (index === 0) {
      await page.getByRole('textbox', { name: '昵称 *', exact: true }).fill('E2E 主题游客')
      await page.getByRole('button', { name: '确认身份', exact: true }).click()
    }
    await expect(page.getByText(`E2E 移动主题 ${index}`, { exact: true })).toBeVisible()
    if (index === 1) {
      const links = page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link')
      expect(await links.count()).toBeGreaterThan(0)
      for (const link of await links.all()) expect(await link.getAttribute('aria-label')).toBeTruthy()
    }
  }
})

test('书签存储失败保留表单，非法导入不会覆盖已有数据', async ({ page }) => {
  await login(page)
  await page.goto('/tabs')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: '添加书签' })
  await dialog.getByRole('textbox', { name: '名称', exact: true }).fill('E2E 本地保存')
  await dialog.getByRole('textbox', { name: '网址', exact: true }).fill('https://example.com/e2e')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => {
      Storage.prototype.setItem = original
    }
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('tab:bookmarks:') && value.includes('E2E 本地保存'))
        throw new DOMException('quota', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await dialog.getByRole('button', { name: '添加', exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(page.getByText(/本地保存失败/)).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '名称', exact: true })).toHaveValue('E2E 本地保存')
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await dialog.getByRole('button', { name: '添加', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name: /E2E 本地保存/ })).toBeVisible()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('dialog', { name: '标签页设置' }).getByRole('button', { name: '数据', exact: true }).click()
  await page.getByRole('button', { name: /导入数据/ }).click()
  const importer = page.getByRole('dialog', { name: '导入书签' })
  await importer.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 99, categories: [], bookmarks: [] })),
  })
  await expect(importer.getByText('不支持此导出格式版本')).toBeVisible()
  await expect(importer.getByRole('button', { name: '确认导入' })).toBeDisabled()
  await importer.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('dialog', { name: '标签页设置' }).getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByRole('link', { name: /E2E 本地保存/ })).toBeVisible()
})

test('真实闪念发布失败保留输入，编辑与归档同步公开 feed', async ({ page, request }) => {
  await login(page)
  await page.goto('/flash')
  const editor = page.getByPlaceholder('此刻闪过的灵感是…')
  await editor.fill('E2E 闪念发布')
  let abortedSubmissions = 0
  await page.route('**/api/v1/admin/flashes', (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    abortedSubmissions++
    return route.abort()
  })
  await page.locator('.fed').getByRole('button', { name: /^发布/ }).click()
  await expect(editor).toHaveValue('E2E 闪念发布')
  await expect.poll(() => abortedSubmissions).toBe(1)
  await expect(page.getByText('闪念服务暂时不可用，请稍后重试', { exact: true })).toBeVisible()
  await page.unroute('**/api/v1/admin/flashes')
  const retried = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/admin/flashes' && response.request().method() === 'POST',
  )
  await page.locator('.fed').getByRole('button', { name: /^发布/ }).click()
  expect((await retried).ok()).toBe(true)
  const card = page.locator('.fnc').filter({ hasText: 'E2E 闪念发布' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: '编辑闪念' }).click()
  await editor.fill('E2E 闪念更新')
  await page.locator('.fed').getByRole('button', { name: /^发布/ }).click()
  const updated = page.locator('.fnc').filter({ hasText: 'E2E 闪念更新' })
  await expect(updated).toBeVisible()
  expect(await (await request.get('/flash.xml')).text()).toContain('E2E 闪念更新')
  await updated.getByRole('button', { name: '归档', exact: true }).click()
  await expect(updated).toBeHidden()
  expect(await (await request.get('/flash.xml')).text()).not.toContain('E2E 闪念更新')
  await page.getByRole('button', { name: '查看归档箱', exact: true }).click()
  const archived = page.locator('.fnc').filter({ hasText: 'E2E 闪念更新' })
  await expect(archived).toBeVisible()
  await archived.getByRole('button', { name: '恢复', exact: true }).click()
  await page.getByRole('button', { name: '返回主列表', exact: true }).click()
  await expect(page.locator('.fnc').filter({ hasText: 'E2E 闪念更新' })).toBeVisible()
})

test('后台闪念草稿、失败重试、发布评论与归档恢复闭环', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await login(page)
  await page.goto('/admin/flashes')
  await page.getByRole('button', { name: '新建闪念', exact: true }).click()
  const editor = page.getByRole('textbox', { name: '闪念正文', exact: true })
  await editor.fill('E2E 后台闪念完整流程')
  await page.route('**/api/v1/admin/flashes', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/失败|fetch/i)
  await expect(editor).toHaveValue('E2E 后台闪念完整流程')
  await page.unroute('**/api/v1/admin/flashes')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  const card = page.locator('.admin-flashes__list > li').filter({ hasText: 'E2E 后台闪念完整流程' })
  await expect(card).toContainText('草稿')
  expect(await (await request.get('/flash.xml')).text()).not.toContain('E2E 后台闪念完整流程')
  await card.getByRole('button', { name: '发布', exact: true }).click()
  await expect(card.getByRole('button', { name: '撤回为草稿', exact: true })).toBeVisible()
  expect(await (await request.get('/flash.xml')).text()).toContain('E2E 后台闪念完整流程')
  const list = await (await request.get('/api/v1/flashes')).json()
  const id = list.data.items.find((item: { content: string }) => item.content === 'E2E 后台闪念完整流程').id
  const comment = await request.post(`/api/v1/flashes/${id}/comments`, {
    headers: { 'X-Visitor-Id': 'e2e-admin-flash-comment' },
    data: { authorName: '后台测试访客', content: 'E2E 闪念评论管理' },
  })
  expect(comment.status()).toBe(201)
  await card.getByRole('button', { name: /管理评论/ }).click()
  const panel = page.getByRole('region', { name: '闪念评论管理' })
  await expect(panel).toContainText('E2E 闪念评论管理')
  await panel.getByRole('button', { name: '删除评论', exact: true }).click()
  await expect(panel).toContainText('暂无评论')
  await card.getByRole('button', { name: '置顶', exact: true }).click()
  await expect(card.getByRole('button', { name: '取消置顶', exact: true })).toBeVisible()
  await card.getByRole('button', { name: '归档', exact: true }).click()
  await expect(card.getByRole('button', { name: '恢复为草稿', exact: true })).toBeVisible()
  expect(await (await request.get('/flash.xml')).text()).not.toContain('E2E 后台闪念完整流程')
  await card.getByRole('button', { name: '恢复为草稿', exact: true }).click()
  await expect(card.getByRole('button', { name: '发布', exact: true })).toBeVisible()
  expect((await request.get(`/api/v1/flashes/${id}`)).status()).toBe(404)
  await page.reload()
  await expect(card).toContainText('草稿')
})

test('后台专栏标签创建、文章引用和重命名同步公开入口', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/taxonomy')
  const name = page.getByRole('textbox', { name: '名称', exact: true })
  await name.fill('E2E 专栏目录')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  const folders = page.getByRole('region', { name: '专栏', exact: true })
  await expect(folders.getByRole('row').filter({ hasText: 'E2E 专栏目录' })).toBeVisible()
  await page.getByRole('combobox', { name: '目录类型', exact: true }).selectOption('tags')
  await name.fill('E2E 标签目录')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  const tags = page.getByRole('region', { name: '标签', exact: true })
  await expect(tags.getByRole('row').filter({ hasText: 'E2E 标签目录' })).toBeVisible()
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 分类引用文章')
  await page.getByLabel('专栏', { exact: true }).fill('E2E 专栏目录')
  await page.getByRole('button', { name: 'E2E 标签目录', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('# 分类测试\n\n目录关联内容。')
  await publishArticle(page)
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const id = page.url().split('/').pop()!
  await page.goto('/admin/taxonomy')
  await expect(
    folders.getByRole('row').filter({ hasText: 'E2E 专栏目录' }).getByRole('button', { name: '删除', exact: true }),
  ).toBeDisabled()
  await folders
    .getByRole('row')
    .filter({ hasText: 'E2E 专栏目录' })
    .getByRole('button', { name: '修改', exact: true })
    .click()
  await name.fill('E2E 更名专栏')
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect(folders.getByRole('row').filter({ hasText: 'E2E 更名专栏' })).toBeVisible()
  await tags
    .getByRole('row')
    .filter({ hasText: 'E2E 标签目录' })
    .getByRole('button', { name: '修改', exact: true })
    .click()
  await name.fill('E2E 更名标签')
  await page.getByRole('combobox', { name: '标签颜色', exact: true }).selectOption('rose')
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await expect(
    tags.getByRole('row').filter({ hasText: 'E2E 更名标签' }).getByRole('button', { name: '删除', exact: true }),
  ).toBeDisabled()
  const metadata = await (await request.get('/api/v1/posts/metadata')).json()
  expect(metadata.data.tags.find((item: { label: string }) => item.label === 'E2E 更名标签').color).toBe('rose')
  expect(metadata.data.archive.find((item: { id: number }) => String(item.id) === id).folder).toBe('E2E 更名专栏')
  await page.reload()
  await expect(folders.getByRole('row').filter({ hasText: 'E2E 更名专栏' })).toBeVisible()
})

test('改密失败不退出，成功后当前与其他设备旧会话失效', async ({ page, browser }) => {
  const username = process.env.E2E_ACCOUNT_USERNAME!
  const oldPassword = process.env.E2E_PASSWORD!
  const newPassword = `${oldPassword}-changed`
  await login(page, username, oldPassword)
  const otherContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    const other = await otherContext.newPage()
    await login(other, username, oldPassword)
    await page.goto('/admin/account')
    await page.getByRole('textbox', { name: '当前密码', exact: true }).fill('incorrect-password')
    await page.getByRole('textbox', { name: '新密码', exact: true }).fill(newPassword)
    await page.getByRole('textbox', { name: '确认新密码', exact: true }).fill(newPassword)
    await page.getByRole('button', { name: '修改密码并退出所有会话', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('当前密码不正确')
    await expect(page).toHaveURL(/\/admin\/account$/)
    await page.getByRole('textbox', { name: '当前密码', exact: true }).fill(oldPassword)
    await page.getByRole('button', { name: '修改密码并退出所有会话', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/login\?changed=1$/)
    await other.getByRole('link', { name: '文章管理', exact: true }).click()
    await expect(other.getByRole('textbox', { name: '用户名', exact: true })).toBeVisible()
    await page.getByRole('textbox', { name: '用户名', exact: true }).fill(username)
    await page.getByRole('textbox', { name: '密码', exact: true }).fill(oldPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('用户名或密码错误')
    await page.getByRole('textbox', { name: '密码', exact: true }).fill(newPassword)
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page).toHaveURL(/\/admin$/)
  } finally {
    await otherContext.close()
  }
})

test('后台评论上下文、回复失败重试与级联删除形成闭环', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept())
  const headers = { 'X-Visitor-Id': 'e2e-admin-comment-flow' }
  const root = await (
    await request.post('/api/v1/posts/1/comments', {
      headers,
      data: { author: '后台评论流程', content: 'E2E 后台评论根节点' },
    })
  ).json()
  const child = await (
    await request.post('/api/v1/posts/1/comments', {
      headers,
      data: { author: '后台评论流程', content: 'E2E 后台子回复', parentId: root.data.id },
    })
  ).json()
  expect(
    (
      await request.post('/api/v1/posts/1/comments', {
        headers,
        data: { author: '后台评论流程', content: 'E2E 后台孙回复', parentId: child.data.id },
      })
    ).status(),
  ).toBe(201)
  await login(page)
  await page.goto(`/admin/comments?postId=1&search=${encodeURIComponent('E2E 后台评论根节点')}`)
  const row = page.locator('.admin-comments > ul > li').filter({ hasText: 'E2E 后台评论根节点' })
  await row.getByRole('button', { name: '查看上下文', exact: true }).click()
  const context = page.getByRole('region', { name: '评论上下文', exact: true })
  await expect(context).toContainText('影响 3 条评论')
  await expect(context).toContainText('E2E 后台子回复')
  await row.getByRole('button', { name: '回复', exact: true }).click()
  const input = page.getByRole('textbox', { name: '博主回复内容', exact: true })
  await input.fill('E2E 博主后台答复')
  await page.route('**/api/v1/admin/comments/*/reply', (route) => route.abort())
  await page.getByRole('button', { name: '发表博主回复', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/失败|fetch/i)
  await expect(input).toHaveValue('E2E 博主后台答复')
  await page.unroute('**/api/v1/admin/comments/*/reply')
  await page.getByRole('button', { name: '发表博主回复', exact: true }).click()
  await expect(input).toBeHidden()
  await expect(context).toContainText('E2E 博主后台答复')
  await expect(context).toContainText('影响 4 条评论')
  await row.getByRole('button', { name: '删除评论及回复', exact: true }).click()
  await expect(row).toBeHidden()
  await expect(page.getByText('暂无评论', { exact: true })).toBeVisible()
})

test('后台六个页面在 390px 下导航可见且无页面横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  const routes = [
    ['/admin', '管理概览'],
    ['/admin/posts', '文章管理'],
    ['/admin/comments', '评论管理'],
    ['/admin/flashes', '闪念管理'],
    ['/admin/taxonomy', '分类与标签'],
    ['/admin/account', '账号安全'],
  ]
  for (const [path, title] of routes) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible()
    const current = page.getByRole('navigation', { name: '管理导航' }).getByRole('link', { name: title, exact: true })
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toBeInViewport()
    await expect(page.locator('.loading-screen')).toHaveCount(0)
    expect(
      await page.locator('.admin-shell').evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true)
    await captureMotion(page, testInfo, `mobile-${path.split('/').pop() || 'overview'}.png`)
  }
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await captureMotion(page, testInfo, 'mobile-account-light.png')
})

test('编辑时会话失效可原地重新登录并保留文章草稿', async ({ page }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  const title = page.getByRole('textbox', { name: '标题', exact: true })
  const content = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await title.fill('E2E 过期会话保留草稿')
  await content.fill('重新登录前后都应保留的正文')
  await page.route('**/api/v1/admin/posts', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ code: 20, message: '登录已失效' }),
        })
      : route.continue(),
  )
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 22, message: '登录已过期' }),
    }),
  )
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('region', { name: '登录状态提示' })).toBeVisible()
  await expect(title).toHaveValue('E2E 过期会话保留草稿')
  await expect(content).toHaveValue('重新登录前后都应保留的正文')
  await page.unroute('**/api/v1/admin/posts')
  await page.unroute('**/api/v1/auth/refresh')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('region', { name: '登录状态提示' })).toBeHidden()
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
  await expect(content).toHaveValue('重新登录前后都应保留的正文')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
})

test('两个编辑标签页发生版本冲突时保留双方正文并显式合并', async ({ page, context }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 并发编辑保护')
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('初始正文')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const editorUrl = page.url()
  const other = await context.newPage()
  try {
    await other.goto(editorUrl)
    await other.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('标签页 B 已保存内容')
    const saved = other.waitForResponse(
      (response) => response.url().includes('/api/v1/admin/posts/') && response.request().method() === 'PATCH',
    )
    await other.getByRole('button', { name: '保存草稿', exact: true }).click()
    expect((await saved).status()).toBe(200)
    await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('标签页 A 未保存内容')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    const comparison = page.getByRole('region', { name: '文章版本冲突', exact: true })
    await expect(comparison).toBeVisible()
    await expect(comparison.getByRole('textbox', { name: '服务器正文', exact: true })).toHaveValue(
      '标签页 B 已保存内容',
    )
    await expect(comparison.getByRole('textbox', { name: '当前输入正文', exact: true })).toHaveValue(
      '标签页 A 未保存内容',
    )
    await page.getByRole('button', { name: '保留当前输入，基于最新版本继续合并', exact: true }).click()
    await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('标签页 A 与 B 合并后的内容')
    const merged = page.waitForResponse(
      (response) => response.url().includes('/api/v1/admin/posts/') && response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    expect((await merged).status()).toBe(200)
    await other.reload()
    await expect(other.getByRole('textbox', { name: 'Markdown 正文', exact: true })).toHaveValue(
      '标签页 A 与 B 合并后的内容',
    )
  } finally {
    await other.close()
  }
})

test('本机恢复先比较再载入，历史修订可恢复为新草稿', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true }).uncheck()
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 持久恢复副本')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await body.fill('刷新之前尚未保存服务器的正文')
  await expect(page.getByRole('region', { name: '文章保存状态' })).toContainText('本机恢复副本：已保存于')
  await page.reload()
  await expect(page.getByRole('region', { name: '本机恢复副本', exact: true })).toContainText('E2E 持久恢复副本')
  await expect(body).toHaveValue('')
  await page.getByRole('button', { name: '比较恢复副本', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '本机副本正文', exact: true })).toHaveValue(
    '刷新之前尚未保存服务器的正文',
  )
  await page.getByRole('button', { name: '载入本机副本继续编辑', exact: true }).click()
  await expect(body).toHaveValue('刷新之前尚未保存服务器的正文')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  await body.fill('第二次保存的正文')
  const saved = page.waitForResponse(
    (response) => response.url().includes('/api/v1/admin/posts/') && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await page.getByRole('button', { name: '查看修订历史', exact: true }).click()
  await page.getByRole('button', { name: '比较版本 1', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '历史修订正文', exact: true })).toHaveValue(
    '刷新之前尚未保存服务器的正文',
  )
  await page.getByRole('button', { name: '恢复版本 1 为服务器草稿', exact: true }).click()
  await expect(body).toHaveValue('刷新之前尚未保存服务器的正文')
  await expect(page.getByRole('region', { name: '文章保存状态' })).toContainText('版本 3')
  await page.reload()
  await expect(body).toHaveValue('刷新之前尚未保存服务器的正文')
})

test('草稿空闲后自动保存服务器，已发布内容只自动保存本机副本', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 自动保存策略')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await body.fill('服务器自动保存的草稿')
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/, { timeout: 25000 })
  const id = page.url().split('/').pop()!
  expect((await request.get(`/api/v1/posts/${id}`)).status()).toBe(404)
  await publishArticle(page)
  await expect(page.getByText('当前状态：已发布')).toBeVisible()
  await body.fill('尚未确认发布的新修改')
  await expect(page.getByRole('region', { name: '文章保存状态' })).toContainText('自动保存仅写本机副本')
  await page.waitForTimeout(16000)
  const published = await (await request.get(`/api/v1/posts/${id}`)).json()
  expect(published.data.contentRaw).toBe('服务器自动保存的草稿')
  await expect(body).toHaveValue('尚未确认发布的新修改')
})

test('发布检查、SEO 和自定义地址同步公开页面及订阅入口', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E SEO 发布检查')
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('# 内容标题\n\nSEO 与公开地址验收正文。')
  await page.getByRole('button', { name: '从正文生成摘要', exact: true }).click()
  await page.getByRole('textbox', { name: '文章地址标识', exact: true }).fill('e2e-custom-article')
  await page.getByRole('textbox', { name: 'SEO 标题', exact: true }).fill('E2E 搜索标题')
  await page.getByRole('textbox', { name: 'SEO 描述', exact: true }).fill('E2E 搜索结果描述')
  await page.getByRole('textbox', { name: '封面地址', exact: true }).fill('/avatar.svg')
  await page.getByRole('textbox', { name: '封面替代文本', exact: true }).fill('E2E 封面说明')
  await page.getByRole('checkbox', { name: '不让搜索引擎收录（文章仍公开可访问）', exact: true }).check()
  await page.getByRole('button', { name: '发布文章', exact: true }).click()
  const check = page.getByRole('dialog', { name: '发布前检查', exact: true })
  await expect(check).toContainText('e2e-custom-article')
  await expect(check).toContainText('不收录，但仍公开可访问')
  await check.getByRole('button', { name: '返回编辑', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('E2E SEO 发布检查')
  await publishArticle(page)
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const id = page.url().split('/').pop()!
  await page.getByRole('link', { name: '查看公开文章', exact: true }).click()
  await expect(page).toHaveURL(/\/articles\/e2e-custom-article$/)
  await expect(page).toHaveTitle(/E2E 搜索标题/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'E2E 搜索结果描述')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/articles\/e2e-custom-article$/)
  await expect(page.getByRole('img', { name: 'E2E 封面说明', exact: true })).toBeVisible()
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/articles/e2e-custom-article')
  expect(await (await request.get('/rss.xml')).text()).toContain('/articles/e2e-custom-article')
  await page.goto(`/admin/posts/${id}`)
  await page.getByRole('textbox', { name: '文章地址标识', exact: true }).fill('e2e-custom-updated')
  await page.getByRole('checkbox', { name: '不让搜索引擎收录（文章仍公开可访问）', exact: true }).uncheck()
  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.url().includes(`/admin/posts/${id}`),
  )
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await page
    .getByRole('dialog', { name: '发布前检查', exact: true })
    .getByRole('button', { name: '确认公开发布', exact: true })
    .click()
  expect((await saved).status()).toBe(200)
  const old = await request.get('/articles/e2e-custom-article', { maxRedirects: 0 })
  expect(old.status()).toBe(301)
  expect(old.headers().location).toContain('/articles/e2e-custom-updated')
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/articles/e2e-custom-updated')
})

test('媒体上传重试、替代文本、封面正文闪念选择与引用保护', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept())
  await login(page)
  await page.goto('/admin/media')
  const image = {
    name: 'e2e-media.png',
    mimeType: 'image/png',
    buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
  }
  await page.getByRole('textbox', { name: '新图片默认替代文本', exact: true }).fill('E2E 初始图片说明')
  await page.route('**/api/v1/admin/media', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  await page.locator('input[type="file"]').setInputFiles(image)
  await expect(page.getByRole('alert')).toContainText('网络上传失败')
  await page.unroute('**/api/v1/admin/media')
  await page.getByRole('button', { name: '重试上传', exact: true }).click()
  const asset = page.locator('.media-library__grid > li').filter({ hasText: 'e2e-media.png' })
  await expect(asset).toBeVisible()
  await expect(asset.locator('img')).toBeVisible()
  const url = (await asset.locator('img').getAttribute('src'))!
  expect((await request.get(url)).headers()['content-type']).toContain('image/webp')
  await asset.getByRole('textbox', { name: 'e2e-media.png 替代文本', exact: true }).fill('E2E 更新图片说明')
  await asset.getByRole('button', { name: '保存替代文本', exact: true }).click()
  await expect(asset.getByRole('button', { name: '保存替代文本', exact: true })).toBeDisabled()
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 媒体引用文章')
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('# 媒体内容')
  async function selectAsset() {
    const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
    await picker
      .locator('.media-library__grid > li')
      .filter({ hasText: 'e2e-media.png' })
      .getByRole('button', { name: '使用此图片', exact: true })
      .click()
    await expect(picker).toBeHidden()
  }
  await page.getByRole('button', { name: '从媒体库选择封面', exact: true }).click()
  await selectAsset()
  await expect(page.getByRole('textbox', { name: '封面地址', exact: true })).toHaveValue(url)
  await page.getByRole('button', { name: '向正文插入媒体图片', exact: true }).click()
  await selectAsset()
  expect(await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).inputValue()).toContain(url)
  await publishArticle(page)
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  await page.getByRole('link', { name: '查看公开文章', exact: true }).click()
  await expect(page.locator('img.article-page__cover')).toHaveAttribute('src', url)
  await expect(page.locator('.article-markdown img')).toHaveAttribute('src', url)
  await expect(page.locator('.article-markdown img')).toHaveAttribute('alt', 'E2E 更新图片说明')
  await page.goto('/admin/media')
  await asset.getByRole('button', { name: '移入回收', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('资源仍被引用')
  await expect(page.getByRole('region', { name: '媒体引用', exact: true })).toContainText('历史版本')
  await page.goto('/admin/flashes')
  await page.getByRole('button', { name: '新建闪念', exact: true }).click()
  await page.getByRole('textbox', { name: '闪念正文', exact: true }).fill('E2E 媒体引用闪念')
  await page.getByRole('button', { name: '从媒体库选择图片', exact: true }).click()
  await selectAsset()
  await page.locator('.fed').getByRole('button', { name: /^发布/ }).click()
  await expect(page.locator('.admin-flashes__list > li').filter({ hasText: 'E2E 媒体引用闪念' })).toBeVisible()
  await page.goto('/flash')
  const flash = page.locator('.fnc').filter({ hasText: 'E2E 媒体引用闪念' })
  await expect(flash.getByRole('img', { name: 'E2E 更新图片说明', exact: true })).toBeVisible()
  await page.goto('/admin/media')
  // setInputFiles 不等待 enabled，先确认身份恢复和媒体读取已开放输入。
  await expect(page.locator('input[type="file"]')).toBeEnabled()
  await page.locator('input[type="file"]').setInputFiles({ ...image, name: 'e2e-unused.png' })
  const unused = page.locator('.media-library__grid > li').filter({ hasText: 'e2e-unused.png' })
  await expect(unused).toBeVisible()
  await unused.getByRole('button', { name: '移入回收', exact: true }).click()
  await expect(unused).toBeHidden()
  await page.getByRole('combobox', { name: '资源状态', exact: true }).selectOption('true')
  await expect(unused).toContainText('已移入回收')
  await unused.getByRole('button', { name: '恢复资源', exact: true }).click()
  await page.getByRole('combobox', { name: '资源状态', exact: true }).selectOption('false')
  await expect(unused.locator('img')).toBeVisible()
})

test('文章批量回收、断线结果查询、恢复与永久删除可在移动端完成', async ({ page, request }, testInfo) => {
  await login(page)
  const ids: string[] = []
  for (const title of ['E2E 批量验收甲', 'E2E 批量验收乙']) {
    await page.goto('/admin/posts/new')
    await page.getByRole('textbox', { name: '标题', exact: true }).fill(title)
    await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('批量回收与恢复的隔离浏览器正文')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
    ids.push(page.url().split('/').pop()!)
  }
  await page.goto('/admin/posts?search=E2E%20批量验收')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('checkbox', { name: '选择本页全部', exact: true }).check()
  await expect(page.getByText('已选 2 篇，仅限当前页；切换筛选或分页后清空。', { exact: true })).toBeVisible()
  await page.getByLabel('文章状态', { exact: true }).selectOption('draft')
  await expect(page).toHaveURL(/status=draft/)
  await expect(page.getByText('已选 0 篇，仅限当前页；切换筛选或分页后清空。', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: '选择本页全部', exact: true }).check()
  await page.getByLabel('批量操作', { exact: true }).selectOption('trash')
  const review = page.getByRole('button', { name: '预览批量操作', exact: true })
  await review.click()
  const confirmation = page.getByRole('dialog', { name: '批量操作确认', exact: true })
  await expect(confirmation).toContainText('本次明确选择 2 篇，可执行 2 篇')
  await confirmation.getByRole('button', { name: '取消并关闭', exact: true }).click()
  await expect(review).toBeFocused()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await review.click()
  // 服务器完成后丢失响应，必须能重新查询真实结果而不是显示假成功。
  await page.route(
    '**/api/v1/admin/posts/batch/execute',
    async (route) => {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await confirmation.getByRole('button', { name: '确认执行', exact: true }).click()
  await expect(confirmation.getByRole('alert')).toContainText('未收到完整执行结果')
  await confirmation.getByRole('button', { name: '查询执行结果', exact: true }).click()
  await expect(confirmation).toContainText('成功 2 篇，失败 0 篇，待处理 0 篇')
  await confirmation.getByRole('button', { name: '完成并关闭', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
  await page.reload()
  const history = page.getByRole('region', { name: '最近批量操作', exact: true })
  await history.getByRole('button', { name: /^移入回收站 · 2 篇/ }).click()
  await expect(confirmation).toContainText('成功 2 篇，失败 0 篇，待处理 0 篇')
  await confirmation.getByRole('button', { name: '完成并关闭', exact: true }).click()
  await page.goto(`/admin/posts/${ids[0]}`)
  await expect(page.getByRole('alert')).toContainText('文章已在回收站')
  await page.getByRole('link', { name: '前往文章回收站', exact: true }).click()
  const first = page.locator('tbody tr').filter({ hasText: 'E2E 批量验收甲' })
  page.once('dialog', async (dialog) => dialog.accept())
  await first.getByRole('button', { name: '恢复为草稿', exact: true }).click()
  await expect(first).toHaveCount(0)
  await page.goto('/admin/posts?search=E2E%20批量验收&status=draft')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  expect((await request.get(`/api/v1/posts/${ids[0]}`)).status()).toBe(404)
  await page.goto('/admin/posts?search=E2E%20批量验收&status=trash')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('checkbox', { name: '选择文章：E2E 批量验收乙', exact: true }).check()
  await page.getByLabel('批量操作', { exact: true }).selectOption('delete')
  await review.click()
  await expect(confirmation).toContainText('0 条评论')
  await expect(confirmation.getByRole('button', { name: '确认执行', exact: true })).toBeDisabled()
  await confirmation.getByLabel('输入“永久删除”确认', { exact: true }).fill('永久删除')
  await expect(confirmation.getByRole('button', { name: '确认执行', exact: true })).toBeEnabled()
  expect(await confirmation.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'post-trash-confirm-mobile.png', { target: confirmation })
  await confirmation.getByRole('button', { name: '确认执行', exact: true }).click()
  await expect(confirmation).toContainText('成功 1 篇，失败 0 篇，待处理 0 篇')
  await confirmation.getByRole('button', { name: '完成并关闭', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(0)
})

test('评论先审后发、审核失败重试、隐藏和恢复同步公开页面', async ({ page, request }, testInfo) => {
  await login(page)
  await page.goto('/admin/comments')
  const approval = page.getByRole('checkbox', { name: '新游客评论需要审核后公开', exact: true })
  await approval.check()
  await page.getByRole('button', { name: '保存审核设置', exact: true }).click()
  await expect(page.getByText(/服务器当前：先审核后公开/)).toBeVisible()
  await page.reload()
  await expect(approval).toBeChecked()
  await page.goto('/articles/5')
  await page.getByRole('textbox', { name: '评论内容', exact: true }).fill('E2E 审核后公开评论')
  await page.getByRole('button', { name: '发布评论', exact: true }).click()
  await page.getByRole('textbox', { name: '昵称 *', exact: true }).fill('E2E 审核访客')
  await page.getByRole('button', { name: '确认身份', exact: true }).click()
  await expect(page.locator('.comment-section').getByRole('status')).toContainText('等待博主审核')
  await expect(page.locator('.comment-section__list')).not.toContainText('E2E 审核后公开评论')
  await page.goto('/admin/comments?status=pending&search=E2E%20审核后公开评论')
  const row = page.locator('.admin-comments > ul > li').filter({ hasText: 'E2E 审核后公开评论' })
  await expect(row).toContainText('待审核')
  page.on('dialog', (dialog) => dialog.accept())
  await page.route('**/api/v1/admin/comments/*/moderation', (route) => route.abort(), { times: 1 })
  await row.getByRole('button', { name: '通过或恢复公开', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/失败|fetch/i)
  await expect(row).toContainText('待审核')
  await row.getByRole('button', { name: '通过或恢复公开', exact: true }).click()
  await expect(row).toHaveCount(0)
  let publicData = (await (await request.get('/api/v1/posts/5/comments')).json()).data
  expect(publicData.items.some((item: { content: string }) => item.content === 'E2E 审核后公开评论')).toBe(true)
  await page.goto('/admin/comments?search=E2E%20审核后公开评论')
  await row.getByRole('button', { name: '隐藏评论', exact: true }).click()
  await expect(row).toContainText('已隐藏')
  publicData = (await (await request.get('/api/v1/posts/5/comments')).json()).data
  expect(publicData.items.some((item: { content: string }) => item.content === 'E2E 审核后公开评论')).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await expect(page.getByText('通知渠道尚未接入，不会向评论者发送邮件或消息。', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'comment-moderation-mobile-light.png', { target: row })
  await row.getByRole('button', { name: '标记垃圾', exact: true }).click()
  await expect(row).toContainText('垃圾评论')
  await row.getByRole('button', { name: '通过或恢复公开', exact: true }).click()
  await expect(row).toContainText('当前公开可见')
  await approval.uncheck()
  await page.getByRole('button', { name: '保存审核设置', exact: true }).click()
  await expect(page.getByText(/服务器当前：直接公开/)).toBeVisible()
  await page.goto('/articles/5')
  await expect(page.getByText('E2E 审核后公开评论', { exact: true })).toBeVisible()
})

test('站点资料保存失败保留、前台与 feed 同步、配置冲突和历史恢复', async ({ page, request }, testInfo) => {
  async function saveSite(target: Page) {
    const response = target.waitForResponse(
      (item) => new URL(item.url()).pathname === '/api/v1/admin/site' && item.request().method() === 'PATCH',
    )
    await target.getByRole('button', { name: '保存并生效', exact: true }).click()
    expect((await response).status()).toBe(200)
    await expect(target.getByText('正在处理站点设置…', { exact: true })).toBeHidden()
    await expect(target.getByRole('button', { name: '保存并生效', exact: true })).toBeDisabled()
  }

  await login(page)
  await page.goto('/admin/site')
  await expect(page.getByRole('textbox', { name: '站点名称', exact: true })).toHaveValue('TixXin Blog')
  await page.getByRole('textbox', { name: '站点名称', exact: true }).fill('E2E 可维护站点')
  await page.getByRole('textbox', { name: '站点简介', exact: true }).fill('E2E 真实简介 & 内容')
  await page.getByRole('textbox', { name: '博主名称', exact: true }).fill('E2E 博主')
  await page.getByRole('textbox', { name: '站点公告', exact: true }).fill('E2E 配置公告')
  await page.getByRole('textbox', { name: '首页 SEO 标题', exact: true }).fill('E2E 搜索首页')
  await page.getByRole('textbox', { name: '默认 SEO 描述', exact: true }).fill('E2E 搜索站点描述')
  await page.getByRole('button', { name: '从媒体库选择头像', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
  await picker.getByRole('textbox', { name: '新图片默认替代文本', exact: true }).fill('E2E 站点头像说明')
  await picker.locator('input[type="file"]').setInputFiles({
    name: 'e2e-site-avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
  })
  const asset = picker.locator('.media-library__grid > li').filter({ hasText: 'e2e-site-avatar.png' })
  await asset.getByRole('button', { name: '使用此图片', exact: true }).click()
  await expect(picker).toBeHidden()
  const avatarUrl = await page.getByRole('textbox', { name: '头像地址', exact: true }).inputValue()
  expect(avatarUrl).toMatch(/^\/api\/v1\/media\/.*\.webp$/)
  await page.route(
    '**/api/v1/admin/site',
    (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()),
    { times: 1 },
  )
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/失败|fetch/i)
  await expect(page.getByRole('textbox', { name: '站点名称', exact: true })).toHaveValue('E2E 可维护站点')
  await saveSite(page)
  await page.goto('/')
  await expect(page).toHaveTitle('E2E 搜索首页 - E2E 可维护站点')
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'E2E 可维护站点')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'E2E 搜索站点描述')
  await expect(page.getByRole('complementary', { name: '站点公告', exact: true })).toContainText('E2E 配置公告')
  await expect(page.locator('img.owner-profile-card__avatar')).toHaveAttribute('src', avatarUrl)
  await expect(page.locator('img.owner-profile-card__avatar')).toHaveAttribute('alt', 'E2E 站点头像说明')
  const rss = await (await request.get('/rss.xml')).text()
  expect(rss).toContain('<title>E2E 可维护站点</title>')
  expect(rss).toContain('E2E 真实简介 &amp; 内容')
  await expect(page.locator('link[rel="alternate"][href="/rss.xml"]')).toHaveCount(1)
  await expect(page.locator('link[rel="alternate"][href="/rss.xml"]')).toHaveAttribute('title', 'E2E 可维护站点 RSS')
  await page.goto('/articles/1')
  const structured = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
  expect(structured.author.name).toBe('E2E 博主')
  expect(structured.publisher.name).toBe('E2E 可维护站点')
  await page.goto('/admin/site')
  const other = await page.context().newPage()
  await other.goto('/admin/site')
  await other.getByRole('textbox', { name: '博主简介', exact: true }).fill('另一个页面的新简介')
  await saveSite(other)
  await page.getByRole('textbox', { name: '站点名称', exact: true }).fill('E2E 冲突后合并站点')
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await expect(page.getByRole('region', { name: '站点配置冲突', exact: true })).toContainText('另一个页面的新简介')
  await expect(page.getByRole('textbox', { name: '站点名称', exact: true })).toHaveValue('E2E 冲突后合并站点')
  await page.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
  await page.getByRole('textbox', { name: '博主简介', exact: true }).fill('另一个页面的新简介')
  await saveSite(page)
  await other.close()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('link', { name: '站点设置', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'site-settings-mobile-preview.png', {
    target: page.getByRole('region', { name: '保存后的公开资料预览', exact: true }),
  })
  await page.getByRole('button', { name: /^查看版本 0 ·/ }).click()
  await expect(page.getByRole('region', { name: '历史版本 0 预览', exact: true })).toContainText('TixXin Blog')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '恢复此版本到服务器', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '站点名称', exact: true })).toHaveValue('TixXin Blog')
  await page.goto('/')
  await expect(page.getByRole('complementary', { name: '站点公告', exact: true })).toHaveCount(0)
  await expect(page).toHaveTitle('TixXin Blog')
})

test('跨标签页登录恢复、撤销其他设备和当前会话退出保持真实权限边界', async ({ page, browser, request }, testInfo) => {
  await login(page)
  await page.goto('/admin/account')
  const mirror = await page.context().newPage()
  await Promise.all([page.reload(), mirror.goto('/admin/account')])
  await expect(page.getByRole('heading', { name: '账号安全', exact: true })).toBeVisible()
  await expect(mirror.getByRole('heading', { name: '账号安全', exact: true })).toBeVisible()
  await expect(mirror.getByRole('region', { name: '活跃管理会话', exact: true })).toContainText('当前会话')
  await mirror.close()
  const anotherContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/140.0',
  })
  const another = await anotherContext.newPage()
  let thirdContext: Awaited<ReturnType<typeof browser.newContext>> | undefined
  try {
    const anotherLogin = await login(another)
    const original = (await (await request.get('/api/v1/posts/1')).json()).data.title
    await another.goto('/admin/posts/1')
    await another.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 会话失效后保留输入')
    await page.getByRole('button', { name: '刷新会话', exact: true }).click()
    const foreign = page.locator(`.active-sessions li[data-session-id="${anotherLogin.sessionId}"]`)
    await expect(foreign).toBeVisible()
    await expectSessionDevice(foreign, anotherLogin.agent)
    page.on('dialog', (dialog) => dialog.accept())
    await page.route(
      `**/api/v1/auth/sessions/${anotherLogin.sessionId}`,
      (route) => (route.request().method() === 'DELETE' ? route.abort() : route.continue()),
      { times: 1 },
    )
    await foreign.getByRole('button', { name: '撤销此会话', exact: true }).click()
    await expect(page.getByRole('region', { name: '活跃管理会话', exact: true }).getByRole('alert')).toContainText(
      '未能确认撤销结果',
    )
    await page.getByRole('button', { name: '刷新会话', exact: true }).click()
    await foreign.getByRole('button', { name: '撤销此会话', exact: true }).click()
    await expect(foreign).toHaveCount(0)
    await another.getByRole('button', { name: '撤回为草稿', exact: true }).click()
    await expect(another.getByRole('textbox', { name: '用户名', exact: true })).toBeVisible()
    await expect(another.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('E2E 会话失效后保留输入')
    expect((await (await request.get('/api/v1/posts/1')).json()).data.title).toBe(original)
    thirdContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15',
    })
    const third = await thirdContext.newPage()
    const thirdLogin = await login(third)
    await page.getByRole('button', { name: '刷新会话', exact: true }).click()
    const thirdSession = page.locator(`.active-sessions li[data-session-id="${thirdLogin.sessionId}"]`)
    await expect(thirdSession).toBeVisible()
    await expectSessionDevice(thirdSession, thirdLogin.agent)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await captureMotion(page, testInfo, 'admin-sessions-mobile.png', {
      target: page.getByRole('region', { name: '活跃管理会话', exact: true }),
    })
    await page.getByRole('button', { name: '撤销其他全部会话', exact: true }).click()
    await expect(page.locator('.active-sessions li')).toHaveCount(1)
    await third.goto('/admin/posts')
    await expect(third.getByRole('heading', { name: '博主登录', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '撤销当前会话并退出', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    expect((await (await request.get('/api/v1/auth/session')).json()).data.authenticated).toBe(false)
  } finally {
    await anotherContext.close()
    await thirdContext?.close()
  }
})

test('审计展示真实成功与冲突、筛选刷新和对象跳转且不暴露正文', async ({ page }, testInfo) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 审计浏览器对象')
  const privateBody = 'E2E 私有正文不应出现在审计列表'
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill(privateBody)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const id = page.url().split('/').pop()!
  const second = await page.context().newPage()
  await second.goto(`/admin/posts/${id}`)
  await second.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 审计服务器新版本')
  const saved = second.waitForResponse(
    (item) => item.url().endsWith(`/api/v1/admin/posts/${id}`) && item.request().method() === 'PATCH',
  )
  await second.getByRole('button', { name: '保存草稿', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(second.getByRole('region', { name: '文章保存状态', exact: true })).toContainText('版本 2')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 审计保留冲突输入')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByText(/已拒绝覆盖/).first()).toBeVisible()
  await second.close()
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto('/admin/audit?action=post.create')
  const targetLink = page.locator(`a[href="/admin/posts/${id}"]`)
  const entry = page.locator('.audit-log > li').filter({ has: targetLink })
  await expect(entry).toContainText('新建文章')
  await expect(entry).toContainText('成功')
  await expect(entry).toContainText(process.env.E2E_USERNAME!)
  await expect(entry).toContainText('正文')
  await expect(page.locator('.admin-audit')).not.toContainText(privateBody)
  await page.getByRole('combobox', { name: '管理操作', exact: true }).selectOption('post.update')
  await page.getByRole('combobox', { name: '处理结果', exact: true }).selectOption('failure')
  await page.getByRole('button', { name: '筛选审计记录', exact: true }).click()
  await expect(page).toHaveURL(/state=failure/)
  await expect(entry).toContainText('HTTP 409')
  await expect(entry).toContainText('提交版本 1')
  await page.reload()
  await expect(page.getByRole('combobox', { name: '管理操作', exact: true })).toHaveValue('post.update')
  await expect(page.getByRole('combobox', { name: '处理结果', exact: true })).toHaveValue('failure')
  await page.route('**/api/v1/admin/audit?*', (route) => route.abort(), { times: 1 })
  await page.getByRole('button', { name: '刷新记录', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('审计记录读取失败')
  await page.getByRole('button', { name: '刷新记录', exact: true }).click()
  await expect(entry).toContainText('保存文章')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'audit-entry-mobile.png', { target: entry })
  await entry.getByRole('link', { name: '前往相关管理', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/posts/${id}$`))
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('E2E 审计服务器新版本')
})

test('内容包下载、上传断线查询与导入结果重读不重复创建草稿', async ({ page, request }, testInfo) => {
  await login(page)
  await page.goto('/admin/posts/new')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('E2E 内容迁入浏览器验收')
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill('内容包迁入验证正文')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    const state: PreviewResponseLoss = { matchedResponses: 0, lostResponses: 0, status: null, ticket: '' }
    ;(window as unknown as { previewResponseLoss: PreviewResponseLoss }).previewResponseLoss = state
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const response = await nativeFetch(input, init)
      if (
        url.origin !== window.location.origin ||
        url.pathname !== '/api/v1/admin/backup/imports/preview' ||
        method !== 'POST' ||
        state.lostResponses > 0
      )
        return response
      state.matchedResponses++
      state.status = response.status
      const payload = (await response.clone().json()) as { data?: { ticket?: string } }
      state.ticket = payload.data?.ticket ?? ''
      // File 字节由浏览器直接上传；只在真实 201 且票据已建立后丢弃一次应用可见响应。
      if (response.status === 201 && /^[a-f0-9-]{36}$/.test(state.ticket)) {
        state.lostResponses++
        throw new TypeError('模拟服务器已处理后响应丢失')
      }
      return response
    }
  })
  await page.goto('/admin/maintenance')
  const context = (await request.get('/api/v1/site')).headers()['x-content-context']
  expect(context).toBeTruthy()
  const outgoing = page.waitForRequest((item) => item.url().endsWith('/api/v1/admin/backup/export'))
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载内容包', exact: true }).click()
  expect((await outgoing).headers()['x-content-context']).toBe(context)
  const download = await downloading
  const filePath = testInfo.outputPath('content-package.json')
  await download.saveAs(filePath)
  const data = JSON.parse(await readFile(filePath, 'utf8'))
  expect(data.format).toBe('tixxin-content')
  data.posts = data.posts.filter(
    (post: { values: { title: string } }) => post.values.title === 'E2E 内容迁入浏览器验收',
  )
  data.flashes = []
  data.media = []
  expect(data.posts).toHaveLength(1)
  await page.getByRole('combobox', { name: '重复内容策略', exact: true }).selectOption('copy')
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'migration.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await page.getByRole('button', { name: '生成导入预览', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('预览未能确认')
  const loss = await page.evaluate(
    () => (window as unknown as { previewResponseLoss: PreviewResponseLoss }).previewResponseLoss,
  )
  expect(loss).toMatchObject({ matchedResponses: 1, lostResponses: 1, status: 201 })
  expect(loss.ticket).toMatch(/^[a-f0-9-]{36}$/)
  await expect(page.getByText(/已选 migration.json/)).toBeVisible()
  await page.getByRole('button', { name: '查询本次上传票据', exact: true }).click()
  const preview = page.getByRole('region', { name: '内容导入预览', exact: true })
  await expect(preview).toContainText(loss.ticket)
  await expect(preview).toContainText('计划新建 1 篇文章草稿')
  await expect(preview.getByRole('button', { name: '确认导入预览内容', exact: true })).toBeDisabled()
  await preview.getByRole('textbox', { name: '输入“导入为新草稿”确认', exact: true }).fill('导入为新草稿')
  await page.route(
    '**/api/v1/admin/backup/imports/*/execute',
    async (route) => {
      const response = await route.fetch()
      expect(response.status()).toBe(201)
      await route.abort('failed')
    },
    { times: 1 },
  )
  await preview.getByRole('button', { name: '确认导入预览内容', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('导入结果未能确认')
  await preview.getByRole('button', { name: '查询导入结果', exact: true }).click()
  await expect(preview).toContainText('已创建 1 篇文章草稿')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'content-import-mobile.png', { target: preview })
  await preview.getByRole('button', { name: '查询导入结果', exact: true }).click()
  await expect(preview.getByRole('link', { name: /^检查新文章草稿/ })).toHaveCount(1)
  await preview.getByRole('link', { name: /^检查新文章草稿/ }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown 正文', exact: true })).toHaveValue('内容包迁入验证正文')
  await page.goto('/admin/posts?search=E2E%20内容迁入浏览器验收')
  await expect(page.locator('tbody tr')).toHaveCount(2)
})
