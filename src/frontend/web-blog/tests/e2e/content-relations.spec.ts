/** @file content-relations.spec.ts @description 三域关联选择、排序、解除、公开阅读和失效目标在隔离环境验收。 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
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
    expect(result.status(), path).toBeLessThan(300)
    return (await result.json()).data
  }
}
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
}
async function choose(page: Page, type: string, title: string) {
  const picker = page.locator('.content-relations')
  await picker.getByRole('combobox', { name: '关联目标类型' }).selectOption(type)
  await picker.getByRole('textbox', { name: '查找关联内容' }).fill(title)
  await expect(picker.getByRole('button', { name: '查找内容', exact: true })).toBeEnabled()
  await picker.getByRole('button', { name: '查找内容', exact: true }).click()
  const row = picker.locator('.content-relations__candidates li').filter({ hasText: title })
  await row.getByRole('button').click()
}
async function settlePublicOwner(page: Page) {
  // 通过真实管理入口确认公开页认证已恢复，避免在 SSR 文字刚出现时硬重载截断 refresh。
  await page.getByRole('button', { name: '更多导航', exact: true }).click()
  const menu = page.getByRole('dialog', { name: '更多导航', exact: true })
  await expect(menu.getByRole('link', { name: '管理后台', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
}
test('文章、项目、图库有序关联可维护，撤回目标不暴露私有资料', async ({ page, request }, testInfo) => {
  const call = await api(request),
    marker = randomUUID()
  const project = await call('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: '关联项目 ' + marker,
    status: 'published',
  })
  const gallery = await call('/admin/gallery', 'POST', {
    requestId: randomUUID(),
    title: '关联作品 ' + marker,
    externalUrl: 'https://example.com/relation.png',
    status: 'published',
  })
  const post = await call('/admin/posts', 'POST', {
    title: '关联文章 ' + marker,
    contentRaw: '写作与作品整理。',
    status: 'draft',
  })
  await page.route('https://example.com/relation.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64') }),
  )
  await login(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/admin/posts/${post.id}`)
  await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿' }).uncheck()
  await choose(page, 'project', project.title)
  await choose(page, 'gallery', gallery.title)
  await page.getByRole('button', { name: '上移关联 2', exact: true }).click()
  await expect(page.locator('.content-relations ol > li').first()).toContainText(gallery.title)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect
    .poll(async () => (await call(`/admin/posts/${post.id}`)).relatedContent)
    .toEqual([
      { type: 'gallery', id: gallery.id },
      { type: 'project', id: project.id },
    ])
  await page.reload()
  await expect(page.locator('.content-relations ol > li')).toHaveCount(2)
  const { id, savedAt, deletedAt, ...body } = await call(`/admin/posts/${post.id}`)
  await call(`/admin/posts/${id}`, 'PATCH', { ...body, status: 'published' })
  await page.goto(`/articles/${id}`)
  const reading = page.getByRole('region', { name: '关联阅读' })
  await expect(reading.getByRole('link').first()).toHaveAttribute('href', `/gallery?photo=${gallery.id}`)
  await expect(reading.getByRole('link')).toHaveCount(2)
  await settlePublicOwner(page)
  await page.goto(`/admin/projects/${project.id}`)
  await choose(page, 'post', post.title)
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect.poll(async () => (await call(`/admin/projects/${project.id}`)).relatedContent.length).toBe(1)
  await page.goto(`/projects?project=${project.id}`)
  await expect(page.locator('.projects-focus .related-content a')).toHaveAttribute('href', `/articles/${post.id}`)
  await settlePublicOwner(page)
  await page.goto(`/admin/gallery/${gallery.id}`)
  await choose(page, 'post', post.title)
  await page.getByRole('button', { name: '保存作品', exact: true }).click()
  await expect.poll(async () => (await call(`/admin/gallery/${gallery.id}`)).relatedContent.length).toBe(1)
  await page.goto(`/gallery?photo=${gallery.id}`)
  await expect(page.getByRole('dialog').locator('.related-content a')).toHaveAttribute('href', `/articles/${post.id}`)
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
  await settlePublicOwner(page)
  const latest = await call(`/admin/projects/${project.id}`)
  await call(`/admin/projects/${project.id}`, 'PATCH', { revision: latest.revision, status: 'withdrawn' })
  await page.goto(`/articles/${post.id}`)
  await expect(page.locator('.related-content a')).toHaveCount(1)
  await expect(page.locator('.related-content')).not.toContainText(project.title)
  await settlePublicOwner(page)
  await page.goto(`/admin/posts/${post.id}`)
  await expect(page.locator('.content-relations ol')).toContainText('已撤回')
  await page.getByRole('button', { name: '解除关联 2', exact: true }).click()
  await expect(page.locator('.content-relations ol > li')).toHaveCount(1)
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await page.getByRole('button', { name: '确认公开发布', exact: true }).click()
  await expect.poll(async () => (await call(`/admin/posts/${post.id}`)).relatedContent.length).toBe(1)
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await captureMotion(page, testInfo, 'content-relations-320.png', {
    target: page.locator('.content-relations'),
    animations: 'disabled',
  })
})
