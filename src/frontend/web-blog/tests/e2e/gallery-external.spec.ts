/** @file gallery-external.spec.ts @description 隔离图库外链真实保存、故障恢复、两来源输入及未知尺寸灯箱 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => prepareMotionCapture(page, browserName))
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
const url = 'https://gallery-images.example/Photo?Signature=Ab%2Fc&tag=A&tag=B'
test('外链真实保存后丢失响应，原提交核查不重复创建且保留后续输入', async ({ page }) => {
  await login(page)
  await page.goto('/admin/gallery/new')
  await page.getByLabel('作品标题', { exact: true }).fill(`未知结果 ${randomUUID()}`)
  await page.getByLabel('图片来源', { exact: true }).selectOption('external')
  await page.getByLabel('外部图片地址', { exact: true }).fill(url)
  let committed = 0,
    posts = 0
  const endpoint = '**/api/v1/admin/gallery'
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts++
    expect(route.request().postDataJSON().externalUrl).toBe(url)
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    committed = (await response.json()).data.id
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '限定在已提交外链作品后的响应故障' }),
    })
  })
  await page.getByRole('button', { name: '发布作品', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未核清')
  expect(committed).toBeGreaterThan(0)
  await page.getByLabel('作品说明', { exact: true }).fill('结果核查期间继续写下的说明')
  const checked = page.waitForResponse(
    (response) => response.url().includes('/admin/gallery/submissions/') && response.request().method() === 'GET',
  )
  await page.getByRole('button', { name: '发布作品', exact: true }).click()
  expect((await (await checked).json()).data.item.id).toBe(committed)
  await expect(page.getByLabel('作品说明', { exact: true })).toHaveValue('结果核查期间继续写下的说明')
  await expect(page.getByLabel('外部图片地址', { exact: true })).toHaveValue(url)
  expect(posts).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: '当前新增输入仍保留' })).toBeVisible()
})
test('合法外链预览失败仍能保存发布，刷新和独立上下文保留真实来源', async ({ page, browser, baseURL }, testInfo) => {
  let failures = 0
  await page.route(url, async (route) => {
    failures++
    await route.abort('failed')
  })
  await login(page)
  await page.goto('/admin/gallery/new')
  const title = `外链光影 ${randomUUID()}`
  await page.getByRole('textbox', { name: '作品标题', exact: true }).fill(title)
  await page.getByLabel('图片来源', { exact: true }).selectOption('external')
  await page.getByLabel('外部图片地址', { exact: true }).fill(url)
  await expect(page.getByText('当前预览加载失败', { exact: false })).toBeVisible()
  expect(failures).toBeGreaterThan(0)
  await expect(page.getByText('地址格式合法，可以保存。预览结果不决定保存结果。')).toBeVisible()
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/gallery') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '发布作品', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  const photo = (await response.json()).data
  expect(photo).toMatchObject({ source: 'external', mediaId: null, externalUrl: url, status: 'published' })
  expect(photo.width).toBeUndefined()
  await expect(page).toHaveURL(new RegExp(`/admin/gallery/${photo.id}$`))
  await page.reload()
  await expect(page.getByLabel('外部图片地址', { exact: true })).toHaveValue(url)
  await captureMotion(page, testInfo, 'external-preview-failed-saved.png')
  const other = await browser.newContext({ baseURL })
  try {
    const reader = await other.newPage()
    await reader.route(url, (route) =>
      route.fulfill({ contentType: 'image/png', body: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64') }),
    )
    await reader.goto(`/gallery?photo=${photo.id}`)
    const dialog = reader.getByRole('dialog', { name: title, exact: true })
    await expect(dialog.locator('.image-frame--ready')).toBeVisible()
    await expect(dialog.getByRole('img')).toHaveAttribute('src', url)
    await reader.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  } finally {
    await other.close()
  }
})

test('切换来源的两套输入可刷新恢复，保存只提交选中来源并释放媒体引用', async ({ page }) => {
  await login(page)
  await page.goto('/admin/gallery/new')
  await page.getByRole('textbox', { name: '作品标题', exact: true }).fill(`来源切换 ${randomUUID()}`)
  await page.getByRole('button', { name: '选择或上传图片', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
  await picker.getByRole('button', { name: '使用此图片', exact: true }).first().click()
  await expect(picker).not.toBeVisible()
  const mediaSrc = await page.locator('.gallery-editor__preview img').getAttribute('src')
  await page.getByLabel('图片来源', { exact: true }).selectOption('external')
  await page.getByLabel('外部图片地址', { exact: true }).fill(url)
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(page.getByLabel('外部图片地址', { exact: true })).toHaveValue(url)
  await page.getByLabel('图片来源', { exact: true }).selectOption('media')
  await expect(page.locator('.gallery-editor__preview img')).toHaveAttribute('src', mediaSrc!)
  const posted = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/gallery') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  const first = await posted
  const managed = (await first.json()).data
  expect(first.request().postDataJSON()).toMatchObject({ externalUrl: null })
  expect(first.request().postDataJSON()).not.toHaveProperty('source')
  await page.getByLabel('图片来源', { exact: true }).selectOption('external')
  await expect(page.getByLabel('外部图片地址', { exact: true })).toHaveValue(url)
  const switched = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/admin/gallery/${managed.id}`) && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  const second = await switched
  expect(second.status()).toBe(200)
  expect(second.request().postDataJSON()).toMatchObject({ mediaId: null, externalUrl: url })
  expect((await second.json()).data.id).toBe(managed.id)
})

test('未知尺寸先占位，横竖外链失败后重试，灯箱键盘关闭归还焦点', async ({ page, request }, testInfo) => {
  const loginResponse = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  const token = (await loginResponse.json()).data.accessToken
  const title = `竖向街景 ${randomUUID()}`
  const created = await request.post('/api/v1/admin/gallery', {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, externalUrl: url, requestId: randomUUID(), status: 'published', sortOrder: 9999 },
  })
  expect(created.status()).toBe(201)
  const photo = (await created.json()).data
  let fail = true,
    hits = 0
  const samples = (await (await request.get('/api/v1/gallery?pageSize=48')).json()).data.items
  const portraitSample = samples.find(
    (item: { width?: number; height?: number }) => item.width && item.height && item.height > item.width,
  )
  expect(portraitSample).toBeTruthy()
  const portraitResponse = await request.get(portraitSample.src)
  expect(portraitResponse.status()).toBe(200)
  const portrait = await portraitResponse.body()
  await page.route(url, (route) => {
    hits++
    return fail ? route.abort('failed') : route.fulfill({ contentType: 'image/webp', body: portrait })
  })
  await page.goto('/gallery')
  const card = page.getByRole('button', { name: `查看照片：${title}`, exact: true })
  await expect(card.locator('.image-frame--error')).toBeVisible()
  expect(hits).toBeGreaterThan(0)
  await expect(card.locator('.image-frame')).toHaveCSS('aspect-ratio', '3 / 2')
  fail = false
  await card.getByRole('button', { name: `重新加载图片：${title}` }).click()
  await expect(card.locator('.image-frame--ready')).toBeVisible()
  await expect(card.locator('.image-frame')).toHaveCSS(
    'aspect-ratio',
    `${portraitSample.width} / ${portraitSample.height}`,
  )
  await card.press('Enter')
  const dialog = page.getByRole('dialog', { name: title, exact: true })
  await expect(dialog.locator('.image-frame--ready')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`photo=${photo.id}`))
  await captureMotion(page, testInfo, 'external-portrait-lightbox.png')
  await page.keyboard.press('ArrowRight')
  await expect(page).not.toHaveURL(new RegExp(`photo=${photo.id}(?:&|$)`))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.locator('[data-focus-key^="gallery-photo-"]:focus')).toHaveCount(1)
})
