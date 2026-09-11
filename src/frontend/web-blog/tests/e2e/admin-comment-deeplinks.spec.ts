/** @file admin-comment-deeplinks.spec.ts @description 隔离管理评论深链：服务端页码定位、焦点、隐藏及删除后的准确反馈。 */
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'

test('朋友圈评论深链跨分页定位隐藏评论，删除后明确反馈', async ({ page }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` }
  const created = await page.request.post('/api/v1/admin/moments', {
    headers,
    data: { requestId: randomUUID(), content: '记录一次关于阅读与写作的讨论', status: 'published' },
  })
  expect(created.status()).toBe(201)
  const moment = (await created.json()).data
  let target = ''
  for (let index = 0; index < 17; index++) {
    // 隔离环境仍使用真实写限流；每七条主动跨过一秒窗口，不放宽服务器规则。
    if (index && index % 7 === 0) await pause(1100)
    const response = await page.request.post(`/api/v1/admin/moments/${moment.id}/comments`, {
      headers,
      data: { requestId: randomUUID(), content: `继续讨论第 ${index + 1} 个问题` },
    })
    expect(response.status()).toBe(201)
    target = (await response.json()).data.id
  }
  const hidden = await page.request.patch(`/api/v1/admin/moments/${moment.id}/comments/${target}`, {
    headers,
    data: { status: 'hidden', expectedStatus: 'published' },
  })
  expect(hidden.status()).toBe(200)
  const location = await page.request.get(`/api/v1/admin/moments/${moment.id}/comments/${target}/location`, { headers })
  expect((await location.json()).data.page).toBe(2)
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto(`/admin/moments?comments=${moment.id}&commentId=${target}`)
  const comment = page.locator(`[data-comment-id="${target}"]`)
  await expect(comment).toBeFocused()
  await expect(comment).toBeInViewport()
  await expect(comment).toContainText('已隐藏')
  await expect(page.getByRole('navigation', { name: '动态评论分页', exact: true })).toContainText('2 / 2')
  await page.reload()
  await expect(comment).toBeFocused()
  const removed = await page.request.delete(`/api/v1/admin/moments/${moment.id}/comments/${target}`, { headers })
  expect(removed.status()).toBe(200)
  await page.reload()
  await expect(page.getByText('评论不存在、已删除或不属于这条动态', { exact: true })).toBeVisible()
  await expect(comment).toHaveCount(0)
})

test('闪念评论深链聚焦指定评论，删除后保留明确缺失状态', async ({ page }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` }
  const created = await page.request.post('/api/v1/admin/flashes', {
    headers,
    data: { content: '记录读者交流中的新想法', isDraft: false },
  })
  expect(created.status()).toBe(201)
  const flash = (await created.json()).data
  const response = await page.request.post(`/api/v1/flashes/${flash.id}/comments`, {
    headers: { 'X-Visitor-Id': randomUUID() },
    data: { authorName: '读者', content: '这个想法让我想到另一个问题' },
  })
  expect(response.status()).toBe(201)
  const target = (await response.json()).data.id
  await page.goto(`/admin/flashes?comments=${flash.id}&commentId=${target}`)
  const comment = page.locator(`[data-comment-id="${target}"]`)
  await expect(comment).toBeFocused()
  await expect(comment).toContainText('这个想法让我想到另一个问题')
  const removed = await page.request.delete(`/api/v1/admin/flashes/${flash.id}/comments/${target}`, { headers })
  expect(removed.status()).toBe(200)
  await page.reload()
  await expect(page.getByText('目标评论不存在或已删除。', { exact: true })).toBeVisible()
  await expect(comment).toHaveCount(0)
})
