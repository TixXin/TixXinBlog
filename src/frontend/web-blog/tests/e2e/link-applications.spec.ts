/** @file link-applications.spec.ts @description 隔离库中验收公开友链申请：开关、访客提交、重复拦截、通知定位、后台通过建草稿与拒绝 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import type { LinkApplication, LinkSettings } from '../../app/features/link/types'
test.beforeEach(() => {
  expect(process.env.E2E_ISOLATED).toBe('true')
})
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
    const result = await request.fetch('/api/v1' + path, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(result.status(), `${method} ${path}`).toBeLessThan(300)
    return (await result.json()).data
  }
}
async function setEnabled(call: Awaited<ReturnType<typeof api>>, enabled: boolean) {
  const settings = (await call('/admin/links/settings')) as LinkSettings
  await call('/admin/links/settings', 'PATCH', {
    rules: settings.rules,
    revision: settings.revision,
    applicationsEnabled: enabled,
  })
}
async function apply(page: Page, name: string, url: string) {
  const form = page.getByRole('region', { name: '申请友链', exact: true })
  await form.getByLabel('站点名称', { exact: true }).fill(name)
  await form.getByLabel('站点地址', { exact: true }).fill(url)
  await form.getByLabel('联系方式（可选）', { exact: true }).fill('hi@pine.example.org')
  await form.getByLabel('想对博主说的话（可选）', { exact: true }).fill('常读贵站的部署笔记，希望能互换友链。')
  // 服务端要求表单至少打开一秒，模拟真实填写节奏。
  await page.waitForTimeout(1200)
  await form.getByRole('button', { name: '提交申请', exact: true }).click()
  return form
}

test('开关关闭时友链页只保留本机整理，公开提交被拒绝', async ({ page, request }) => {
  const call = await api(request)
  await setEnabled(call, false)
  expect((await (await request.get('/api/v1/links/applications/status')).json()).data).toEqual({
    applicationsEnabled: false,
  })
  const site = await request.get('/api/v1/site')
  const closed = await request.post('/api/v1/links/applications', {
    data: { name: '松下问童子', url: 'https://closed.example.org/' },
    headers: { 'X-Content-Context': site.headers()['x-content-context']! },
  })
  expect(closed.status()).toBe(404)
  await page.goto('/links')
  await expect(page.getByRole('heading', { name: '整理友链资料', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '申请友链', exact: true })).toHaveCount(0)
})

test('访客提交申请，博主经通知定位后通过建立草稿，另一条拒绝', async ({ page, request }) => {
  const call = await api(request)
  await setEnabled(call, true)
  const url = 'https://pine.example.org/blog'
  await page.goto('/links')
  const form = await apply(page, '松下问童子', url)
  const requestId = (await form.locator('code').textContent())!.trim()
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
  await expect(form).toContainText('申请已提交，等待博主审核。')

  // 同址待审申请返回冲突，输入保留并播报后端文案。
  await form.getByRole('button', { name: '再提交一个站点', exact: true }).click()
  await apply(page, '松下问童子', url)
  await expect(form.getByRole('alert')).toContainText('待审核的申请')
  await expect(form.getByLabel('站点地址', { exact: true })).toHaveValue(url)

  await page.reload()
  const second = await apply(page, '山间来信', 'https://mountain.example.org/')
  await expect(second.locator('code')).toBeVisible()

  const notification = (await call('/admin/notifications')).items.find(
    (item: { kind: string; url: string | null }) => item.kind === 'link-application' && item.url?.includes(requestId),
  )
  expect(notification).toMatchObject({ state: 'pending_review' })

  await login(page)
  await page.goto(notification.url)
  const row = page.locator(`[data-application-id="${requestId}"]`)
  await expect(row).toHaveAttribute('aria-current', 'true')
  await expect(row).toContainText('hi@pine.example.org')
  page.once('dialog', (dialog) => void dialog.accept())
  await row.getByRole('button', { name: '通过并建立草稿', exact: true }).click()
  await expect(page.getByText('已通过「松下问童子」，友链草稿已建立。')).toBeVisible()
  // 默认筛选为待审，通过后该条离开列表；在全部筛选中带编辑草稿入口。
  await expect(row).toHaveCount(0)

  const approved = ((await call('/admin/links/applications?status=approved')).items as LinkApplication[]).find(
    (item) => item.id === requestId,
  )!
  expect(approved.createdLinkId).toBeGreaterThan(0)
  const draft = await call(`/admin/links/${approved.createdLinkId}`)
  expect(draft).toMatchObject({ name: '松下问童子', url, status: 'draft' })
  expect((await call(`/admin/links/submissions/${requestId}`)).state).toBe('saved')

  const other = page.locator('[data-application-id]').filter({ hasText: '山间来信' })
  page.once('dialog', (dialog) => void dialog.accept())
  await other.getByRole('button', { name: '拒绝', exact: true }).click()
  await expect(page.getByText('已拒绝「山间来信」的申请。')).toBeVisible()

  await page
    .getByRole('navigation', { name: '申请状态筛选', exact: true })
    .getByRole('button', { name: '全部', exact: true })
    .click()
  await expect(
    page
      .locator(`[data-application-id="${requestId}"]`)
      .getByRole('link', { name: `编辑友链草稿 #${approved.createdLinkId}`, exact: true }),
  ).toHaveAttribute('href', `/admin/links/${approved.createdLinkId}`)
  await setEnabled(call, false)
})
