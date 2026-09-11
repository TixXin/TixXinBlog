/** @file link-business.spec.ts @description 隔离友链真实业务、地址语义、复制边界与三主题验收 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { LinkPage } from '../../app/features/link/types'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  const pending = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const token = (await (await pending).json()).data.accessToken as string
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toBeVisible()
  return (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { sid: string }).sid
}
async function api(request: APIRequestContext) {
  const response = await request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(response.status()).toBe(200)
  const token = (await response.json()).data.accessToken
  return async (path: string, method = 'GET', data?: unknown) => {
    const response = await request.fetch('/api/v1' + path, {
      method,
      data,
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.status(), `${method} ${path}`).toBeLessThan(300)
    return (await response.json()).data
  }
}
async function sample(request: APIRequestContext): Promise<LinkPage> {
  const response = await request.get('/api/v1/links?pageSize=12')
  expect(response.status()).toBe(200)
  const value = (await response.json()).data as LinkPage
  expect(value.total).toBeGreaterThan(12)
  return value
}
async function upload(page: Page) {
  await page.getByRole('button', { name: '选择或上传Logo', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true }),
    name = `link-${randomUUID()}.png`
  const input = picker.getByLabel('选择或拖入图片', { exact: true })
  await expect(input).toBeEnabled()
  await input.setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64'),
  })
  await picker
    .locator('.media-library__grid > li')
    .filter({ hasText: name })
    .getByRole('button', { name: '使用此图片', exact: true })
    .click()
  await expect(picker).not.toBeVisible()
}
async function clipboard(page: Page, deny = false) {
  await page.addInitScript((failure) => {
    const state = { deny: failure, values: [] as string[] }
    ;(window as unknown as { clipboardProbe: typeof state }).clipboardProbe = state
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.values.push(text)
          if (state.deny) throw new Error('clipboard denied')
        },
      },
    })
  }, deny)
}

test('创建编辑上架推荐排序下架删除跨刷新与另一上下文一致', async ({ page, browser, request, baseURL }, testInfo) => {
  const call = await api(request),
    name = `散步文档 ${randomUUID()}`,
    url = `https://example.com/Docs/${randomUUID()}/?a=2&a=1#KeepCase`
  await login(page)
  await page.goto('/admin/links/new')
  await page.getByRole('textbox', { name: '友链站点名称', exact: true }).fill(name)
  await page.getByRole('textbox', { name: '友链站点地址', exact: true }).fill(url)
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/links\/\d+$/)
  const id = page.url().split('/').pop()!
  expect((await request.get(`/api/v1/links/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
  await page.reload()
  await expect(page.getByRole('textbox', { name: '友链站点地址', exact: true })).toHaveValue(url)
  const context = await browser.newContext({ baseURL })
  try {
    const reader = await context.newPage()
    prepareMotionCapture(reader, testInfo.project.name)
    await reader.goto(`/links?q=${encodeURIComponent(name)}`)
    const card = reader.locator(`[data-link-id="${id}"]`)
    await expect(card.getByRole('link', { name, exact: true })).toHaveAttribute('href', url)
    await expect(card.getByLabel('未设置站点图片')).toBeVisible()
    await page.getByRole('textbox', { name: '友链站点介绍', exact: true }).fill('整理设计与开发资料的个人站点。')
    await page.getByRole('button', { name: '保存友链', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('友链已保存')
    await reader.reload()
    await expect(card).toContainText('整理设计与开发资料')
    await page.goto(`/admin/links?q=${encodeURIComponent(name)}`)
    const row = page.locator('.admin-links__list > li').filter({ hasText: name })
    await row.getByRole('button', { name: '设为推荐', exact: true }).click()
    await expect(row.getByRole('button', { name: '取消推荐', exact: true })).toBeVisible()
    await row.getByRole('button', { name: '提高排序', exact: true }).click()
    await expect(row).toContainText('排序 1')
    await reader.reload()
    await expect(card.locator('.link-card__featured')).toHaveText('推荐')
    await captureMotion(reader, testInfo, 'link-published.png')
    await row.getByRole('button', { name: '下架友链', exact: true }).click()
    await expect(row).toContainText('已下架')
    await reader.reload()
    await expect(card).toHaveCount(0)
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '删除友链', exact: true }).click()
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await login(page)
    await page.goto(`/admin/links?q=${encodeURIComponent(name)}`)
    await expect(page.locator('.admin-links__list > li')).toHaveCount(0)
    expect((await call(`/admin/links?q=${encodeURIComponent(name)}`)).total).toBe(0)
  } finally {
    await context.close()
  }
})

test('重复URL返回400后可改地址重提，同域大小写路径与参数顺序保留', async ({ page, request }) => {
  const call = await api(request),
    marker = randomUUID(),
    original = `https://example.com/Docs/${marker}/?x=2&x=1#Keep`
  await call('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '已经登记的站点',
    url: original,
    status: 'published',
  })
  await login(page)
  await page.goto('/admin/links/new')
  await page.getByRole('textbox', { name: '友链站点名称', exact: true }).fill('另一处文档')
  const input = page.getByRole('textbox', { name: '友链站点地址', exact: true })
  await input.fill(original)
  const rejection = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/admin/links' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  expect((await rejection).status()).toBe(400)
  await expect(page.getByRole('alert')).toContainText(/地址|存在|重复/)
  await expect(page.getByRole('alert')).not.toContainText('保存结果尚未核清')
  await expect(input).toHaveValue(original)
  const changed = `https://example.com/docs/${marker}/?x=2&x=1#Keep`
  await input.fill(changed)
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/links\/\d+$/)
  const id = page.url().split('/').pop()!
  expect((await (await request.get(`/api/v1/links/${id}`)).json()).data.url).toBe(changed)
  await input.fill(original)
  const editRejection = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/admin/links/${id}` && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  expect((await editRejection).status()).toBe(400)
  await expect(input).toHaveValue(original)
  await input.fill(changed + 'Again')
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
})

test('Logo选择上传替换删除只释放本条引用，其他业务文件保留', async ({ page, request }) => {
  const call = await api(request),
    photo = (await call('/admin/gallery?pageSize=1')).items[0],
    references = (await call(`/admin/media/${photo.mediaId}/references`)).total
  const link = await call('/admin/links', 'POST', {
    requestId: randomUUID(),
    name: '共享图片的站点',
    url: `https://example.com/${randomUUID()}`,
    logoMediaId: photo.mediaId,
  })
  await login(page)
  await page.goto(`/admin/links/${link.id}`)
  await upload(page)
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
  let saved = await call(`/admin/links/${link.id}`)
  expect(saved.logoMediaId).not.toBe(photo.mediaId)
  expect(saved.logoUrl).toBeNull()
  expect((await call(`/admin/media/${photo.mediaId}/references`)).total).toBe(references)
  expect((await call(`/admin/media/${saved.logoMediaId}/references`)).total).toBe(1)
  expect((await request.get(saved.avatar)).status()).toBe(200)
  await page.getByRole('button', { name: '移除Logo', exact: true }).click()
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
  expect((await call(`/admin/media/${saved.logoMediaId}/references`)).total).toBe(0)
  expect((await call(`/admin/gallery/${photo.id}`)).mediaId).toBe(photo.mediaId)
  saved = await call(`/admin/links/${link.id}`)
  await call(`/admin/links/${link.id}?revision=${saved.revision}`, 'DELETE')
})

test('外部Logo必须HTTPS，图片失败重试独立于外链且不抓取站点地址', async ({ page, request }) => {
  const call = await api(request),
    marker = randomUUID(),
    address = `https://never-fetch-${marker}.example.com/Docs`,
    logo = `https://logo.example.com/${marker}.png`
  await login(page)
  await page.goto('/admin/links/new')
  await page.getByRole('textbox', { name: '友链站点名称', exact: true }).fill('外部图片站点')
  await page.getByRole('textbox', { name: '友链站点地址', exact: true }).fill(address)
  const logoInput = page.getByRole('textbox', { name: '外部Logo地址', exact: true })
  await logoInput.fill(logo.replace('https:', 'http:'))
  const rejected = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/admin/links' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  expect((await rejected).status()).toBe(400)
  await expect(logoInput).toHaveValue(logo.replace('https:', 'http:'))
  let imageFailures = 0,
    fail = true,
    siteRequests = 0
  await page.route(logo, (route) => {
    if (fail) {
      imageFailures++
      return route.abort()
    }
    return route.fulfill({ contentType: 'image/png', body: Buffer.from(process.env.E2E_MEDIA_SAMPLE!, 'base64') })
  })
  page.on('request', (request) => {
    if (request.url().startsWith(address)) siteRequests++
  })
  await logoInput.fill(logo)
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/links\/\d+$/)
  const id = page.url().split('/').pop()!
  expect((await call(`/admin/links/${id}`)).logoMediaId).toBeNull()
  await page.goto('/links?q=' + encodeURIComponent('外部图片站点'))
  const card = page.locator(`[data-link-id="${id}"]`),
    retry = card.getByRole('button', { name: /重新加载图片/ })
  await expect(retry).toBeVisible()
  expect(imageFailures).toBeGreaterThan(0)
  await expect(card.locator('a button')).toHaveCount(0)
  fail = false
  await retry.click()
  await expect(card.locator('.image-frame')).toHaveClass(/image-frame--ready/)
  expect(siteRequests).toBe(0)
})

test('未知创建核查原提交，迟到保存与刷新恢复保留新输入', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/links/new')
  const name = `待核查站点 ${randomUUID()}`
  await page.getByRole('textbox', { name: '友链站点名称', exact: true }).fill(name)
  await page.getByRole('textbox', { name: '友链站点地址', exact: true }).fill(`https://example.com/${randomUUID()}`)
  let writes = 0
  await page.route('**/api/v1/admin/links', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    if (writes === 1) return route.abort('failed')
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未核清')
  await page.getByRole('button', { name: '上架友链', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/links\/\d+$/)
  expect(writes).toBe(1)
  expect((await (await request.get('/api/v1/links?q=' + encodeURIComponent(name))).json()).data.total).toBe(1)
  const id = page.url().split('/').pop()!
  let delayed = false
  await page.route(`**/api/v1/admin/links/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    delayed = true
    await new Promise((resolve) => setTimeout(resolve, 750))
    await route.fulfill({ response })
  })
  const description = page.getByRole('textbox', { name: '友链站点介绍', exact: true })
  await description.fill('已提交的一版')
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect.poll(() => delayed).toBe(true)
  await description.fill('尚未提交的后一版')
  await expect(page.getByRole('status')).toContainText('当前新增输入仍保留')
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('友链恢复副本')).toBeVisible()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(description).toHaveValue('尚未提交的后一版')
})

test('版本冲突可比较并显式合并，真实会话失效后原地恢复输入', async ({ page, request }) => {
  const call = await api(request),
    link = await call('/admin/links', 'POST', {
      requestId: randomUUID(),
      name: '版本核对站点',
      url: `https://example.com/${randomUUID()}`,
    })
  const sid = await login(page)
  await page.goto(`/admin/links/${link.id}`)
  const description = page.getByRole('textbox', { name: '友链站点介绍', exact: true })
  await description.fill('本机介绍')
  await call(`/admin/links/${link.id}`, 'PATCH', { revision: link.revision, description: '另一窗口介绍' })
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByLabel('友链服务器版本')).toContainText('另一窗口介绍')
  await page.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
  await description.fill('会话过期时的新输入')
  await call(`/auth/sessions/${sid}`, 'DELETE')
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '用户名', exact: true })).toBeVisible()
  await expect(description).toHaveValue('会话过期时的新输入')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存友链', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '保存友链', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('友链已保存')
  expect((await call(`/admin/links/${link.id}`)).description).toBe('会话过期时的新输入')
})

test('友链须知可保存和版本合并，公开metadata来自同一配置', async ({ page, request }) => {
  const call = await api(request),
    before = await call('/admin/links/settings')
  await login(page)
  await page.goto('/admin/links/settings')
  try {
    await expect(page.getByRole('button', { name: '添加须知', exact: true })).toBeEnabled()
    if ((await page.getByRole('textbox', { name: /^友链须知 / }).count()) === 12)
      await page.getByRole('button', { name: '移除须知 12', exact: true }).click()
    await page.getByRole('button', { name: '添加须知', exact: true }).click()
    await page
      .getByRole('textbox', { name: /^友链须知 / })
      .last()
      .fill('介绍和地址变化时，请同步更新站点资料。')
    await call('/admin/links/settings', 'PATCH', { revision: before.revision, rules: ['另一窗口保存的须知。'] })
    await page.getByRole('button', { name: '保存友链须知', exact: true }).click()
    await expect(page.getByLabel('友链须知版本冲突')).toContainText('另一窗口保存的须知')
    await page.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
    await page.getByRole('button', { name: '保存友链须知', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('友链须知已保存')
    expect((await (await request.get('/api/v1/links/metadata')).json()).data.rules).toContain(
      '介绍和地址变化时，请同步更新站点资料。',
    )
  } finally {
    const latest = await call('/admin/links/settings')
    await call('/admin/links/settings', 'PATCH', { revision: latest.revision, rules: before.rules })
  }
})

test('本站资料复制失败可重试，内容与实际设置和显示地址一致', async ({ page, request }) => {
  await clipboard(page, true)
  await page.goto('/links')
  const card = page.locator('.site-info:visible')
  await expect(card.getByRole('button', { name: '复制本站资料', exact: true })).toBeEnabled()
  const text = await card
    .locator('.site-info__list > div')
    .evaluateAll((rows) =>
      rows.map((row) => `${row.querySelector('dt')!.textContent}：${row.querySelector('dd')!.textContent}`).join('\n'),
    )
  const settings = (await (await request.get('/api/v1/site')).json()).data
  expect(text).toContain(settings.name)
  expect(text).toContain(settings.description)
  const siteUrl = await card
    .locator('.site-info__list > div')
    .filter({ has: page.getByText('地址', { exact: true }) })
    .locator('dd')
    .textContent()
  if (settings.avatar) expect(text).toContain(new URL(settings.avatar, siteUrl!).href)
  await card.getByRole('button', { name: '复制本站资料', exact: true }).click()
  await expect(card.getByRole('alert')).toContainText('复制失败')
  await expect(card.getByRole('textbox', { name: '待复制本站资料', exact: true })).toHaveValue(text)
  await page.evaluate(() => {
    ;(window as unknown as { clipboardProbe: { deny: boolean } }).clipboardProbe.deny = false
  })
  await card.getByRole('button', { name: '复制本站资料', exact: true }).click()
  await expect(card.getByRole('status')).toContainText('本站友链资料已复制')
  expect(
    await page.evaluate(() => (window as unknown as { clipboardProbe: { values: string[] } }).clipboardProbe.values),
  ).toEqual([text, text])
})

test('本站设置读取失败禁止复制默认资料，重试恢复且友链列表仍有效', async ({ page }) => {
  await clipboard(page)
  await page.goto('/links')
  const card = page.locator('.site-info:visible')
  await expect(card.getByRole('button', { name: '复制本站资料', exact: true })).toBeEnabled()
  let failures = 0
  await page.route('**/api/v1/site', (route) => {
    if (route.request().method() === 'GET' && failures === 0) {
      failures++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '站点设置暂不可用' }),
      })
    }
    return route.continue()
  })
  await card.getByRole('button', { name: '刷新本站资料', exact: true }).click()
  await expect(card.getByRole('alert')).toContainText('站点资料暂时无法读取')
  expect(failures).toBe(1)
  await expect(card.getByRole('button', { name: '复制本站资料', exact: true })).toBeDisabled()
  await expect(card.locator('.site-info__list')).toHaveCount(0)
  await expect(page.locator('.link-card')).toHaveCount(12)
  expect(
    await page.evaluate(
      () => (window as unknown as { clipboardProbe: { values: string[] } }).clipboardProbe.values.length,
    ),
  ).toBe(0)
  await card.getByRole('button', { name: '重试', exact: true }).click()
  await expect(card.getByRole('button', { name: '复制本站资料', exact: true })).toBeEnabled()
})

test('公开整理表单仅本机复制，失败和刷新保留输入且无申请POST', async ({ page }) => {
  await clipboard(page, true)
  await page.goto('/links')
  const form = page.locator('.link-form'),
    posts: string[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.startsWith('/api/v1/') &&
      !new URL(request.url()).pathname.startsWith('/api/v1/auth/')
    )
      posts.push(request.url())
  })
  await expect(form).toContainText('在线申请尚未开放')
  await form.getByRole('textbox', { name: '整理站点名称', exact: true }).fill('散步笔记')
  await form.getByRole('textbox', { name: '整理站点地址', exact: true }).fill('https://example.com/Notes?x=2&x=1')
  await form.getByRole('textbox', { name: '整理站点描述', exact: true }).fill('记录技术与日常')
  await form.getByRole('button', { name: '复制友链资料', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('复制失败')
  await expect(form.getByRole('textbox', { name: '整理站点名称', exact: true })).toHaveValue('散步笔记')
  await page.evaluate(() => {
    ;(window as unknown as { clipboardProbe: { deny: boolean } }).clipboardProbe.deny = false
  })
  await form.getByRole('button', { name: '复制友链资料', exact: true }).click()
  await expect(form.getByRole('status')).toContainText('尚未提交申请')
  expect(posts).toEqual([])
  await expect(page.getByRole('button', { name: '提交申请', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(form.getByRole('textbox', { name: '整理站点地址', exact: true })).toHaveValue(
    'https://example.com/Notes?x=2&x=1',
  )
})

test('全局友链搜索用真实记录和稳定编号，同域不同路径均可找到', async ({ page, context, request }) => {
  const call = await api(request),
    name = `双路径文档 ${randomUUID()}`,
    marker = randomUUID()
  const urls = [`https://example.com/Docs/${marker}`, `https://example.com/docs/${marker}`]
  for (const url of urls)
    await call('/admin/links', 'POST', { requestId: randomUUID(), name, url, status: 'published' })
  await page.goto('/')
  await page.locator('[data-focus-key="site-search"]:visible').first().click()
  const dialog = page.getByRole('dialog', { name: '站内搜索', exact: true })
  let failedSearches = 0
  await page.route('**/api/v1/links?*', (route) => {
    if (new URL(route.request().url()).searchParams.get('q') === name && failedSearches === 0) {
      failedSearches++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '友链搜索不可用' }),
      })
    }
    return route.continue()
  })
  await dialog.getByRole('textbox', { name: '搜索站内公开内容', exact: true }).fill(name)
  await expect(dialog.getByRole('alert')).toContainText('友链搜索暂时不可用')
  expect(failedSearches).toBe(1)
  await expect(dialog.getByText('没有找到相关内容', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: '重试搜索', exact: true }).click()
  const results = dialog.getByRole('link').filter({ hasText: name })
  await expect(results).toHaveCount(2)
  expect((await results.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).sort()).toEqual(
    urls.sort(),
  )
  const target = (await results.first().getAttribute('href'))!
  await context.route(target, (route) => route.fulfill({ contentType: 'text/html', body: '<title>目标地址</title>' }))
  const popup = page.waitForEvent('popup')
  await results.first().click()
  const opened = await popup
  await expect(opened).toHaveURL(target)
  await opened.close()
})

test('真实列表失败保留成功页，慢查询不覆盖新结果', async ({ page, request }) => {
  const firstPage = await sample(request),
    first = firstPage.items[0]!,
    second = firstPage.items.find((link) => link.name !== first.name)!
  await page.goto('/links')
  await expect(page.locator('.link-card')).toHaveCount(12)
  let failures = 0,
    slow = false
  await page.route('**/api/v1/links?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    if (q === first.name && failures === 0) {
      failures++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '友链暂不可用' }),
      })
    }
    if (q === first.name && slow) await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  const search = page.getByRole('textbox', { name: '搜索友链', exact: true })
  await search.fill(first.name)
  await expect(page.locator('.links-body [role="alert"]')).toContainText('友链服务暂时不可用')
  expect(failures).toBe(1)
  await expect(page.locator('.link-card')).toHaveCount(12)
  await page.locator('.links-body').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator(`[data-link-id="${first.id}"]`)).toBeVisible()
  await search.fill(second.name)
  await expect(page.locator(`[data-link-id="${second.id}"]`)).toBeVisible()
  slow = true
  const delayed = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/v1/links' &&
      new URL(request.url()).searchParams.get('q') === first.name,
  )
  await search.fill(first.name)
  await delayed
  await search.fill(second.name)
  await expect(page.locator(`[data-link-id="${second.id}"]`)).toBeVisible()
  await page.waitForTimeout(900)
  await expect(page.locator(`[data-link-id="${first.id}"]`)).toHaveCount(0)
})

test('公开统计来自实际友链和域名，推荐筛选一致', async ({ request }) => {
  const first = await sample(request),
    items: LinkPage['items'] = []
  for (let page = 1; page <= Math.ceil(first.total / 48); page++)
    items.push(...(await (await request.get(`/api/v1/links?page=${page}&pageSize=48`)).json()).data.items)
  const metadata = (await (await request.get('/api/v1/links/metadata')).json()).data
  expect(metadata.stats.links).toBe(items.length)
  expect(metadata.stats.featured).toBe(items.filter((link) => link.isFeatured).length)
  expect(metadata.stats.domains).toBe(new Set(items.map((link) => link.domain)).size)
  expect((await (await request.get('/api/v1/links?featured=true')).json()).data.total).toBe(metadata.stats.featured)
})

test('无JavaScript仍输出真实友链和本站资料，复制与整理输入保持禁用', async ({ browser, request, baseURL }) => {
  const first = await sample(request),
    settings = (await (await request.get('/api/v1/site')).json()).data
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 960 } })
  try {
    const page = await context.newPage()
    await page.goto('/links')
    await expect(page.getByRole('heading', { name: '友情链接', exact: true })).toBeVisible()
    await expect(page.locator('.link-card')).toHaveCount(12)
    await expect(page.locator('.link-card').first()).toContainText(first.items[0]!.name)
    await page.locator('.links-compact-info summary').click()
    await expect(page.locator('.site-info:visible')).toContainText(settings.name)
    await expect(page.getByRole('button', { name: '复制本站资料', exact: true })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: '整理站点名称', exact: true })).toBeDisabled()
  } finally {
    await context.close()
  }
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 767, 768, 1023, 1024, 1279, 1280, 1439, 1440]) {
    test(`友链 ${theme}/${width} 统计须知资料去重与推荐分页历史恢复`, async ({
      page,
      context,
      request,
      baseURL,
    }, testInfo) => {
      await sample(request)
      const issues: string[] = []
      page.on('pageerror', (error) => issues.push(error.message))
      page.on('console', (message) => {
        if (/hydration|NotFoundError|TypeError/i.test(message.text())) issues.push(message.text())
      })
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await page.setViewportSize({ width, height: 960 })
      await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' })
      await page.goto('/links')
      await expect(page.locator(`.theme-${theme}`)).toBeVisible()
      await expect(page.locator('.link-card')).toHaveCount(12)
      const compact = page.locator('.links-compact-info'),
        fixed = theme === 'nexus' ? width >= 1440 : theme === 'aurora' ? width >= 1280 : false
      if (fixed) await expect(compact).not.toBeVisible()
      else {
        await expect(compact).toBeVisible()
        await compact.locator('summary').click()
      }
      for (const selector of ['.link-stats', '.link-rules', '.site-info'])
        await expect(page.locator(`${selector}:visible`)).toHaveCount(1)
      await expect(page.locator('.link-stats:visible')).toContainText('不代表已验证互链')
      await expect(
        page.locator('.site-info:visible').getByRole('button', { name: '复制本站资料', exact: true }),
      ).toBeEnabled()
      if (theme === 'dock') await expect(page.locator('#right-sidebar-target .link-stats')).toHaveCount(0)
      if (!fixed) await compact.locator('summary').click()
      const next = page
        .getByRole('navigation', { name: '友链分页', exact: true })
        .getByRole('button', { name: '下一页', exact: true })
      await next.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/page=2/)
      await page.reload()
      await page.goBack()
      await expect(page).not.toHaveURL(/page=2/)
      await page.goForward()
      await expect(page).toHaveURL(/page=2/)
      await page.getByRole('combobox', { name: '筛选推荐友链', exact: true }).selectOption('true')
      await expect(page).toHaveURL(/featured=true/)
      await expect(page).not.toHaveURL(/page=2/)
      const featured = (await (await request.get('/api/v1/links?featured=true')).json()).data as LinkPage
      expect(featured.total).toBeGreaterThan(0)
      await expect(page.locator('.link-card')).toHaveCount(featured.items.length)
      expect(
        await page
          .locator('.link-card')
          .evaluateAll((cards) => cards.map((card) => Number((card as HTMLElement).dataset.linkId))),
      ).toEqual(featured.items.map((link) => link.id))
      await expect(page.locator('.link-card a[href="#"]')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      expect(issues).toEqual([])
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `links-${theme}-${width}.png`)
    })
  }
}
