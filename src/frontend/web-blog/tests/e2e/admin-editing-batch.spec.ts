/** @file admin-editing-batch.spec.ts @description 隔离后台编辑与批量体验：Ctrl/⌘+S 保存、正文粘贴图片上传、评论与留言批量操作、通知全部已读。 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

async function login(page: Page) {
  expect(process.env.E2E_ISOLATED).toBe('true')
  const response = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(response.status()).toBe(200)
  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` }
}

test('新建文章按 Ctrl/⌘+S 保存草稿，无改动时再次按键不重复提交', async ({ page }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await expect(body).toBeEnabled()
  await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true }).uncheck()
  await page
    .getByRole('textbox', { name: '标题', exact: true })
    .fill(`快捷键保存的写作笔记 ${randomUUID().slice(0, 6)}`)
  await page.getByRole('combobox', { name: '专栏', exact: true }).fill('写作')
  await body.fill('# 记录\n\n使用快捷键保存草稿。')
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/posts') && response.request().method() === 'POST',
  )
  await body.press(`${modifier}+s`)
  expect((await saved).status()).toBe(201)
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  // 跳转后编辑页重新挂载，等服务器版本加载完成、快捷键处理器就绪后再按键
  await expect(page.getByRole('region', { name: '文章保存状态', exact: true })).toContainText('版本 1')
  let writes = 0
  page.on('request', (request) => {
    if (/\/api\/v1\/admin\/posts\/\d+$/.test(request.url()) && request.method() === 'PATCH') writes++
  })
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).press(`${modifier}+s`)
  await expect(page.getByText('当前没有需要保存的修改')).toBeVisible()
  expect(writes).toBe(0)
})

test('正文粘贴 PNG 先插入占位，上传到媒体库后替换为 Markdown 图片', async ({ page }) => {
  await login(page)
  await page.goto('/admin/posts/new')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await expect(body).toBeEnabled()
  await body.fill('段落开头')
  const uploaded = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/media') && response.request().method() === 'POST',
  )
  await body.evaluate(async (element: HTMLTextAreaElement) => {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 30
    canvas.getContext('2d')!.fillRect(0, 0, 40, 30)
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'))
    const data = new DataTransfer()
    data.items.add(new File([blob], '写作流程示意.png', { type: 'image/png' }))
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(body).toHaveValue(/段落开头!\[上传中…\]\(uploading:[0-9a-f]{8}\)/)
  expect((await uploaded).status()).toBe(201)
  await expect(body).toHaveValue(/^段落开头!\[写作流程示意\]\(\/api\/v1\/media\/[0-9a-f-]+\.webp\)$/)
  // 只有文本的粘贴不被接管，保持浏览器默认行为。
  const prevented = await body.evaluate((element: HTMLTextAreaElement) => {
    const data = new DataTransfer()
    data.setData('text/plain', '，继续写作')
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(false)
})

test('评论页当前页多选后批量隐藏，删除需要确认', async ({ page }) => {
  const headers = await login(page)
  const key = randomUUID().slice(0, 6)
  const post = await page.request.post('/api/v1/admin/posts', {
    headers,
    data: { title: `批量审核评论 ${key}`, contentRaw: '# 正文\n\n用于评论批量操作。', status: 'published' },
  })
  expect(post.status()).toBe(201)
  const postId = (await post.json()).data.id as number
  for (const content of [`第一条读者意见 ${key}`, `第二条读者意见 ${key}`]) {
    const created = await page.request.post(`/api/v1/posts/${postId}/comments`, {
      headers: { 'X-Visitor-Id': randomUUID() },
      data: { author: '读者', content },
    })
    expect(created.status()).toBe(201)
  }
  await page.goto(`/admin/comments?postId=${postId}`)
  const first = page.getByRole('checkbox', { name: new RegExp(`第一条读者意见 ${key}`) })
  const second = page.getByRole('checkbox', { name: new RegExp(`第二条读者意见 ${key}`) })
  await first.check()
  const all = page.getByRole('checkbox', { name: '选择当前页全部评论', exact: true })
  expect(await all.evaluate((element: HTMLInputElement) => element.indeterminate)).toBe(true)
  await expect(page.getByRole('status').filter({ hasText: '已选择 1 条评论' })).toBeVisible()
  await second.check()
  await expect(all).toBeChecked()
  await page.getByRole('button', { name: '批量隐藏', exact: true }).click()
  await expect(page.getByText('已设为已隐藏 2 条评论')).toBeVisible()
  await expect(page.locator('.admin-comments__list li').filter({ hasText: '已隐藏' })).toHaveCount(2)
  page.once('dialog', (dialog) => dialog.dismiss())
  await all.check()
  await page.getByRole('button', { name: '批量删除', exact: true }).click()
  await expect(page.locator('.admin-comments__list li')).toHaveCount(2)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '批量删除', exact: true }).click()
  await expect(page.getByText('暂无评论', { exact: true })).toBeVisible()
})

test('留言页批量隐藏，通知页全部已读后导航徽章消失', async ({ page }) => {
  const headers = await login(page)
  const key = randomUUID().slice(0, 6)
  for (const content of [`山间来信 ${key}`, `海边来信 ${key}`]) {
    const created = await page.request.post('/api/v1/guestbook', {
      headers: { 'X-Visitor-Id': randomUUID() },
      data: { requestId: randomUUID(), author: '旅人', content },
    })
    expect(created.status()).toBe(201)
  }
  await page.goto(`/admin/guestbook?q=${encodeURIComponent(key)}`)
  await page.getByRole('checkbox', { name: '选择当前页全部留言', exact: true }).check()
  await expect(page.getByRole('status').filter({ hasText: '已选择 2 条留言' })).toBeVisible()
  await page.getByRole('button', { name: '批量隐藏', exact: true }).click()
  await expect(page.getByText('已隐藏 2 条留言')).toBeVisible()
  const listed = await page.request.get(`/api/v1/admin/guestbook?q=${encodeURIComponent(key)}`, { headers })
  expect(
    (await listed.json()).data.items.every((note: { moderationStatus: string }) => note.moderationStatus === 'hidden'),
  ).toBe(true)

  await page.goto('/admin/notifications?filter=unread')
  const readAll = page.getByRole('button', { name: '全部标记已读', exact: true })
  await expect(readAll).toBeVisible()
  await readAll.click()
  await expect(page.getByText(/^未读 0 条/)).toBeVisible()
  await expect(page.locator('.admin-navigation__badge')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '互动通知', level: 1 })).toBeFocused()
})
