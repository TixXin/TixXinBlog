/** @file discovery-search.spec.ts @description 六域搜索分组、类型分页、返回恢复、局部失败和窄屏键盘回归。 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function admin(request: APIRequestContext) {
  const login = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken
  return async (path: string, body: unknown) => {
    const response = await request.post('/api/v1/admin' + path, {
      data: body,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status(), path).toBeLessThan(300)
    return (await response.json()).data
  }
}

test('六域预览保留每个来源，类型切换和图库、项目深链准确', async ({ page, request }) => {
  const write = await admin(request),
    keyword = '跨域阅读' + randomUUID()
  const post = await write('/posts', { title: keyword + '文章', contentRaw: '公开正文', status: 'published' })
  const project = await write('/projects', { requestId: randomUUID(), title: keyword + '项目', status: 'published' })
  const link = await write('/links', {
    requestId: randomUUID(),
    name: keyword + '来源',
    url: 'https://example.com/' + randomUUID(),
    status: 'published',
  })
  const gallery = await write('/gallery', {
    requestId: randomUUID(),
    title: keyword + '作品',
    externalUrl: 'https://example.com/search-image.png',
    status: 'published',
  })
  const flash = await write('/flashes', { content: keyword + '闪念', isDraft: false })
  const moment = await write('/moments', { requestId: randomUUID(), content: keyword + '动态', status: 'published' })
  await write('/moments', { requestId: randomUUID(), content: keyword + '尚未公开', status: 'draft' })
  await page.route('https://example.com/search-image.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64') }),
  )
  await page.goto('/search?' + new URLSearchParams({ q: keyword }))
  await expect(page.locator('.search-page__group')).toHaveCount(6)
  for (const [type, href] of [
    ['post', `/articles/${post.id}`],
    ['project', `/projects?project=${project.id}`],
    ['link', link.url],
    ['gallery', `/gallery?photo=${gallery.id}`],
    ['flash', `/flash/${flash.id}`],
    ['moment', `/moments/${moment.id}`],
  ]) {
    const group = page.locator(`.search-page__group[data-search-type="${type}"]`)
    await expect(group.locator('li')).toHaveCount(1)
    await expect(group.locator('li a')).toHaveAttribute('href', href!)
  }
  await expect(page.getByText(keyword + '尚未公开', { exact: true })).toHaveCount(0)
  await page.getByRole('navigation', { name: '搜索内容类型' }).getByRole('link', { name: '项目', exact: true }).click()
  await expect(page).toHaveURL(/type=project/)
  await expect(page.locator('.search-page__group')).toHaveCount(1)
  await page.locator('.search-page__group li a').click()
  await expect(page.locator(`.projects-focus [data-project-id="${project.id}"]`)).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/type=project/)
  await expect(page.getByRole('searchbox', { name: '搜索站内公开内容' })).toHaveValue(keyword)
})

test('完整结果服务端分页可返回恢复，来源失败不吞其他组', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('分页样本') + '&type=post&page=2')
  const items = page.locator('.search-page__group[data-search-type="post"] li')
  await expect(items).toHaveCount(10)
  const previous = await items.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  await items.first().locator('a').click()
  await expect(page).toHaveURL(/\/articles\//)
  await page.goBack()
  await expect(page).toHaveURL(/type=post&page=2/)
  await expect(items).toHaveCount(10)
  // 返回动效短暂保留 aria-hidden 的旧内容克隆；等待退出层移除后核对完整结果，不能采样半次 DOM 更新。
  await expect
    .poll(() => items.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))))
    .toEqual(previous)
  let failures = 0
  await page.route('**/api/v1/gallery?*', (route) => {
    if (new URL(route.request().url()).searchParams.get('q') === '分页样本' && failures === 0) {
      failures++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '图库检索上游故障' }),
      })
    }
    return route.continue()
  })
  await page.getByRole('navigation', { name: '搜索内容类型' }).getByRole('link', { name: '全部类型' }).click()
  await expect(page.getByRole('alert')).toContainText('图库搜索暂时不可用')
  expect(failures).toBe(1)
  await expect(page.locator('[data-search-type="post"] li')).toHaveCount(3)
  await expect(page.locator('[data-search-type="gallery"]')).toContainText('此来源暂不可用')
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const width of [320, 390, 1024]) {
  test(`搜索弹窗 ${width}px 类型分页与关闭重开保留查询`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    const entry = page.locator('[data-focus-key="site-search"]:visible').first()
    await entry.click()
    const dialog = page.getByRole('dialog', { name: '站内搜索', exact: true })
    const input = dialog.getByRole('textbox', { name: '搜索站内公开内容', exact: true })
    await expect(input).toBeFocused()
    await input.fill('分页样本')
    await dialog
      .getByRole('navigation', { name: '搜索内容类型' })
      .getByRole('button', { name: '文章', exact: true })
      .click()
    await expect(dialog.locator('.search-modal__item')).toHaveCount(10)
    await dialog.getByRole('button', { name: '下一页', exact: true }).click()
    await expect(dialog.getByRole('status')).toContainText('第 2 页')
    await input.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(entry).toBeFocused()
    await entry.click()
    await expect(input).toHaveValue('分页样本')
    await expect(dialog.getByRole('status')).toContainText('第 2 页')
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await captureMotion(page, testInfo, `search-${width}.png`, { target: dialog, animations: 'disabled' })
  })
}
