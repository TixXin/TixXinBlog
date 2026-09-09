/** @file moment-business.spec.ts @description 隔离生产环境验证朋友圈持久化、编辑恢复、互动与故障处理 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { prepareMotionCapture, captureMotion } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))

async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function api(request: APIRequestContext) {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(response.status()).toBe(200)
  const token = (await response.json()).data.accessToken
  return async (path: string, method = 'GET', data?: unknown) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await request.fetch('/api/v1' + path, {
        method,
        data,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (result.status() === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1100))
        continue
      }
      expect(result.status(), `${method} ${path}`).toBeLessThan(300)
      return (await result.json()).data
    }
  }
}
test('发布编辑置顶撤回删除跨刷新与另一浏览器上下文一致', async ({ page, browser, request, baseURL }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const content = `真实动态验收 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/moments/new')
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill(content)
  await page.getByRole('textbox', { name: '动态话题', exact: true }).fill('业务验收，技术分享')
  await page.getByRole('textbox', { name: '动态话题', exact: true }).blur()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/moments\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!
  expect((await request.get(`/api/v1/moments/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: '发布动态', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('动态已发布')
  await page.reload()
  await expect(page.getByRole('textbox', { name: '动态正文', exact: true })).toHaveValue(content)
  const other = await browser.newContext({ baseURL })
  try {
    const reader = await other.newPage()
    await reader.goto(`/moments/${id}`)
    await expect(reader.locator('.moment-card__content')).toHaveText(content)
    await page.getByRole('textbox', { name: '动态正文', exact: true }).fill(content + ' 已编辑')
    await page.getByRole('button', { name: '保存动态', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('动态已发布')
    await reader.reload()
    await expect(reader.locator('.moment-card__content')).toHaveText(content + ' 已编辑')
    await page.goto(`/admin/moments?q=${encodeURIComponent(content)}`)
    const row = page.locator('.admin-moments__list > li').filter({ hasText: content })
    await row.getByRole('button', { name: '置顶', exact: true }).click()
    await expect(row).toContainText('已置顶')
    await reader.goto('/moments?topic=业务验收')
    await expect(reader.locator('.moment-card').filter({ hasText: content }).getByLabel('置顶')).toBeVisible()
    prepareMotionCapture(reader, testInfo.project.name)
    await reader.waitForTimeout(300)
    await captureMotion(reader, testInfo, 'moment-published.png')
    await row.getByRole('button', { name: '转为草稿', exact: true }).click()
    await expect(row.locator('p').first()).toContainText('草稿')
    expect((await request.get(`/api/v1/moments/${id}`)).status()).toBe(404)
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '删除动态', exact: true }).click()
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await login(page)
    await page.goto(`/admin/moments?q=${encodeURIComponent(content)}`)
    await expect(page.locator('.admin-moments__list > li')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await other.close()
  }
})

test('未知发布结果重试不重复写入，迟到成功保留新输入，刷新可恢复', async ({ page, request }) => {
  const content = `保存恢复验收 ${randomUUID()}`
  await login(page)
  await page.goto('/admin/moments/new')
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill(content)
  let writes = 0
  await page.route('**/api/v1/admin/moments', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    const response = await route.fetch()
    if (writes === 1) return route.abort('failed')
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '发布动态', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '动态正文', exact: true })).toHaveValue(content)
  await page.getByRole('button', { name: '发布动态', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/moments\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!
  expect((await (await request.get('/api/v1/moments?q=' + encodeURIComponent(content))).json()).data.total).toBe(1)
  await page.route(`**/api/v1/admin/moments/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const response = await route.fetch()
    await new Promise((resolve) => setTimeout(resolve, 700))
    await route.fulfill({ response })
  })
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill(content + ' 第一版')
  await page.getByRole('button', { name: '保存动态', exact: true }).click()
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill(content + ' 尚未提交的下一版')
  await expect(page.getByRole('status')).toContainText('动态已发布')
  await expect(page.getByRole('textbox', { name: '动态正文', exact: true })).toHaveValue(content + ' 尚未提交的下一版')
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('动态恢复副本')).toBeVisible()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '动态正文', exact: true })).toHaveValue(content + ' 尚未提交的下一版')
  expect((await (await request.get(`/api/v1/moments/${id}`)).json()).data.content).toBe(content + ' 第一版')
})

test('版本冲突保留编辑内容并展示服务器版本', async ({ page, request }) => {
  const call = await api(request)
  const note = await call('/admin/moments', 'POST', {
    content: `版本验收 ${randomUUID()}`,
    status: 'draft',
    requestId: randomUUID(),
  })
  await login(page)
  await page.goto(`/admin/moments/${note.id}`)
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill('尚未覆盖的本机输入')
  await call(`/admin/moments/${note.id}`, 'PATCH', { revision: note.revision, content: '另一个窗口已保存' })
  await page.getByRole('button', { name: '保存动态', exact: true }).click()
  await expect(page.getByLabel('动态服务器版本')).toContainText('另一个窗口已保存')
  await expect(page.getByRole('textbox', { name: '动态正文', exact: true })).toHaveValue('尚未覆盖的本机输入')
  expect((await call(`/admin/moments/${note.id}`)).content).toBe('另一个窗口已保存')
})

test('点赞与博主评论刷新持久化，管理隐藏删除同步公开计数', async ({ page, request }) => {
  const call = await api(request)
  const content = `互动验收 ${randomUUID()}`
  const note = await call('/admin/moments', 'POST', { content, status: 'published', requestId: randomUUID() })
  await login(page)
  await page.goto(`/moments/${note.id}`)
  await page.getByRole('button', { name: '点赞动态', exact: true }).click()
  await expect(page.getByRole('button', { name: '取消动态点赞', exact: true })).toHaveText('1')
  await page.reload()
  await expect(page.getByRole('button', { name: '取消动态点赞', exact: true })).toHaveText('1')
  await page.getByRole('button', { name: '查看动态评论', exact: true }).click()
  await page.getByRole('textbox', { name: '动态评论内容', exact: true }).fill('浏览器博主评论')
  await page.getByRole('button', { name: '发送评论', exact: true }).click()
  await expect(page.locator('.moment-comments__text')).toHaveText('浏览器博主评论')
  await page.reload()
  await expect(page.locator('.moment-comments__text')).toHaveText('浏览器博主评论')
  await page.goto(`/admin/moments?q=${encodeURIComponent(content)}`)
  await page.getByRole('button', { name: '管理评论', exact: true }).click()
  const panel = page.getByLabel('动态评论管理', { exact: true })
  await expect(panel).toBeFocused()
  await panel.getByRole('button', { name: '隐藏评论', exact: true }).click()
  await expect(panel).toContainText('已隐藏')
  expect((await (await request.get(`/api/v1/moments/${note.id}`)).json()).data.commentCount).toBe(0)
  await panel.getByRole('button', { name: '公开评论', exact: true }).click()
  await expect(panel).toContainText('已公开')
  expect((await (await request.get(`/api/v1/moments/${note.id}`)).json()).data.commentCount).toBe(1)
  page.once('dialog', (dialog) => dialog.accept())
  await panel.getByRole('button', { name: '删除评论', exact: true }).click()
  await expect(panel).toContainText('暂无评论')
})

test('媒体选择上传、文章引用、图片说明与编辑释放引用一致', async ({ page, request }) => {
  const call = await api(request)
  await login(page)
  await page.goto('/admin/moments/new')
  await page.getByRole('textbox', { name: '动态正文', exact: true }).fill('配图与引用验收 ' + randomUUID())
  await page.getByRole('button', { name: '选择或上传图片', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
  await picker.getByLabel('新图片默认替代文本', { exact: true }).fill('动态实测配图')
  const filename = `moment-${randomUUID()}.png`
  await picker
    .getByLabel('选择或拖入图片', { exact: true })
    .setInputFiles({
      name: filename,
      mimeType: 'image/png',
      buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
    })
  const assetRow = picker.locator('.media-library__grid > li').filter({ hasText: filename })
  await assetRow.getByRole('button', { name: '使用此图片', exact: true }).click()
  await expect(picker).not.toBeVisible()
  await page.getByRole('combobox', { name: '动态引用类型', exact: true }).selectOption('article')
  await page.getByRole('searchbox', { name: '搜索引用文章', exact: true }).fill('分页样本 105')
  const article = page.getByRole('combobox', { name: '引用文章', exact: true })
  await expect(article.locator('option')).toHaveCount(2)
  await article.selectOption({ label: '分页样本 105' })
  await page.getByRole('button', { name: '发布动态', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/moments\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!
  const note = await call(`/admin/moments/${id}`)
  const imageId = note.images[0].split('/').pop().replace('.webp', '')
  expect((await call(`/admin/media/${imageId}/references`)).total).toBe(1)
  await page.getByRole('link', { name: '查看公开动态', exact: true }).click()
  await expect(page.getByRole('img', { name: '动态实测配图', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /分页样本 105/ })).toBeVisible()
  await page.goto(`/admin/moments/${id}`)
  await page.getByRole('button', { name: '移除配图 1', exact: true }).click()
  await page.getByRole('button', { name: '保存动态', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('动态已发布')
  expect((await call(`/admin/media/${imageId}/references`)).total).toBe(0)
})

test('访客评论失败保留输入，同一提交重试只产生一条待审评论', async ({ page, request, browser, baseURL }) => {
  const call = await api(request)
  const policy = await call('/admin/comments/policy')
  await call('/admin/comments/policy', 'PATCH', { requireApproval: true, revision: policy.revision })
  const note = await call('/admin/moments', 'POST', {
    content: '访客互动验收 ' + randomUUID(),
    status: 'published',
    requestId: randomUUID(),
  })
  try {
    await page.goto(`/moments/${note.id}`)
    await page.getByRole('button', { name: '查看动态评论', exact: true }).click()
    const input = page.getByRole('textbox', { name: '动态评论内容', exact: true })
    await input.fill('断连后保留的访客评论')
    let attempts = 0
    await page.route(`**/api/v1/moments/${note.id}/comments`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const response = await route.fetch()
      if (++attempts === 1) return route.abort('failed')
      await route.fulfill({ response })
    })
    await page.getByRole('button', { name: '发送评论', exact: true }).click()
    const identity = page.getByRole('dialog', { name: '填写评论身份', exact: true })
    await identity.getByPlaceholder('你的昵称', { exact: true }).fill('隔离访客')
    await identity.getByRole('button', { name: '确认身份', exact: true }).click()
    await expect(page.locator('.moment-comments [role="alert"]')).toBeVisible()
    await expect(input).toHaveValue('断连后保留的访客评论')
    await page.getByRole('button', { name: '发送评论', exact: true }).click()
    await expect(input).toHaveValue('')
    await expect(page.locator('.moment-comments__item')).toHaveCount(1)
    await expect(page.locator('.moment-comments')).toContainText('待审核，仅自己可见')
    await page.reload()
    await page.getByRole('button', { name: '查看动态评论', exact: true }).click()
    await expect(page.locator('.moment-comments__item')).toHaveCount(1)
    const other = await browser.newContext({ baseURL })
    try {
      const response = await other.request.get(`/api/v1/moments/${note.id}/comments`)
      expect((await response.json()).data.total).toBe(0)
    } finally {
      await other.close()
    }
    expect((await call(`/admin/moments/${note.id}/comments`)).total).toBe(1)
  } finally {
    const current = await call('/admin/comments/policy')
    await call('/admin/comments/policy', 'PATCH', {
      requireApproval: policy.requireApproval,
      revision: current.revision,
    })
  }
})

test('分页与筛选共享URL，读取失败保留内容并可重试，迟到搜索不覆盖新查询', async ({ page }) => {
  await page.goto('/moments?date=2026-04-08')
  await expect(page.locator('.moment-list')).toHaveAttribute('aria-busy', 'false')
  const ids = await page.locator('.moment-card').evaluateAll((items) => items.map((item) => item.id))
  expect(ids).toHaveLength(15)
  await page.getByRole('button', { name: '加载更多动态', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.moment-card')).toHaveCount(30)
  expect(new Set(await page.locator('.moment-card').evaluateAll((items) => items.map((item) => item.id))).size).toBe(30)
  await page.reload()
  await expect(page.locator('.moment-card')).toHaveCount(30)
  const search = page.getByRole('textbox', { name: '搜索动态内容 / 话题 / 地点...', exact: true })
  let fail = true
  await page.route('**/api/v1/moments?**', async (route) => {
    if (fail) return route.fulfill({ status: 503, json: { code: 503, message: '隔离读取故障' } })
    if (new URL(route.request().url()).searchParams.get('q') === '样本 00')
      await new Promise((resolve) => setTimeout(resolve, 650))
    await route.continue()
  })
  await search.fill('样本 00')
  await expect(page.locator('.moment-list [role="alert"]')).toContainText('已保留原内容')
  expect(await page.locator('.moment-card').count()).toBe(30)
  fail = false
  await page.locator('.moment-list').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.moment-card')).toHaveCount(1)
  await search.fill('样本 01')
  await expect(page.locator('.moment-card__content')).toContainText('样本 01')
  await search.fill('样本 00')
  await page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/moments?') && new URL(request.url()).searchParams.get('q') === '样本 00',
  )
  await search.fill('样本 02')
  await expect(page.locator('.moment-card__content')).toContainText('样本 02')
  await page.waitForTimeout(750)
  await expect(page.locator('.moment-card__content')).toContainText('样本 02')
  await page.getByRole('link', { name: /^查看动态详情/ }).click()
  await page.goBack()
  await expect(search).toHaveValue('样本 02')
  await expect(page.locator('.moment-card__content')).toContainText('样本 02')
})
