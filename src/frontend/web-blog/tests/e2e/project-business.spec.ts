/** @file project-business.spec.ts @description 隔离项目真实业务、全局搜索、版本恢复与三主题浏览器验收 */
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { ProjectItem, ProjectPage } from '../../app/features/project/types'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'
test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  const reading = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const token = (await (await reading).json()).data.accessToken as string
  await expect(page).toHaveURL(/\/admin$/, { timeout: 18000 })
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
async function publicSample(request: APIRequestContext): Promise<ProjectPage> {
  const response = await request.get('/api/v1/projects?pageSize=12')
  expect(response.status()).toBe(200)
  const result = (await response.json()).data as ProjectPage
  expect(result.total, '隔离项目样本须覆盖两页').toBeGreaterThan(12)
  return result
}
async function upload(page: Page) {
  await page.getByRole('button', { name: '选择或上传封面', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true }),
    name = `project-${randomUUID()}.png`
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

test('无封面项目创建发布与进展独立，刷新重新登录和另一个上下文一致', async ({
  page,
  browser,
  request,
  baseURL,
}, testInfo) => {
  const call = await api(request),
    title = `窗边工作台 ${randomUUID()}`
  const errors: string[] = []
  page.on('pageerror', (cause) => errors.push(cause.message))
  await login(page)
  await page.goto('/admin/projects/new')
  await page.getByRole('textbox', { name: '项目标题', exact: true }).fill(title)
  await page.getByRole('textbox', { name: '项目介绍', exact: true }).fill('把计划、记录与日常工具放在同一处。')
  await page.getByRole('combobox', { name: '项目进展', exact: true }).selectOption('archived')
  await page.getByRole('button', { name: '添加技术标签', exact: true }).click()
  await page.getByRole('textbox', { name: '技术名称 1', exact: true }).fill('Vue')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/projects\/\d+$/)
  const id = page.url().split('/').pop()!
  const draft = await call(`/admin/projects/${id}`)
  expect(draft).toMatchObject({ coverMediaId: null, progress: 'archived', status: 'draft' })
  expect((await request.get(`/api/v1/projects/${id}`)).status()).toBe(404)
  await page.getByRole('button', { name: '发布项目', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('项目已保存')
  await page.reload()
  await expect(page.getByRole('textbox', { name: '项目标题', exact: true })).toHaveValue(title)
  const other = await browser.newContext({ baseURL })
  try {
    const reader = await other.newPage()
    prepareMotionCapture(reader, testInfo.project.name)
    await reader.goto(`/projects?q=${encodeURIComponent(title)}`)
    const card = reader.locator(`[data-project-id="${id}"]`)
    await expect(card).toContainText('已归档')
    await expect(card).toContainText('暂无封面')
    await expect(card).toContainText('尚未提供公开链接')
    await page.getByRole('combobox', { name: '项目进展', exact: true }).selectOption('dev')
    await page.getByRole('button', { name: '保存项目', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('项目已保存')
    await reader.reload()
    await expect(card).toContainText('开发中')
    await captureMotion(reader, testInfo, 'project-without-cover.png')
    await page.goto(`/admin/projects?q=${encodeURIComponent(title)}`)
    const row = page.locator('.admin-projects__list > li').filter({ hasText: title })
    await row.getByRole('button', { name: '提高排序', exact: true }).click()
    await expect(row).toContainText('排序 1')
    await row.getByRole('button', { name: '撤回项目', exact: true }).click()
    await expect(row).toContainText('已撤回')
    await reader.reload()
    await expect(card).toHaveCount(0)
    page.once('dialog', (dialog) => dialog.accept())
    await row.getByRole('button', { name: '删除项目', exact: true }).click()
    await expect(row).toHaveCount(0)
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await login(page)
    await page.goto(`/admin/projects?q=${encodeURIComponent(title)}`)
    await expect(page.locator('.admin-projects__list > li')).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await other.close()
  }
})

test('封面选择上传替换与删除只释放当前项目引用', async ({ page, request }) => {
  const call = await api(request),
    photo = (await call('/admin/gallery?pageSize=1')).items[0]
  const oldReferences = (await call(`/admin/media/${photo.mediaId}/references`)).total
  const project = await call('/admin/projects', 'POST', {
    requestId: randomUUID(),
    title: `封面工作台 ${randomUUID()}`,
    coverMediaId: photo.mediaId,
  })
  await login(page)
  await page.goto(`/admin/projects/${project.id}`)
  await upload(page)
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('项目已保存')
  let latest = await call(`/admin/projects/${project.id}`)
  expect(latest.coverMediaId).not.toBe(photo.mediaId)
  expect((await call(`/admin/media/${photo.mediaId}/references`)).total).toBe(oldReferences)
  expect((await call(`/admin/media/${latest.coverMediaId}/references`)).total).toBe(1)
  expect((await request.get(latest.cover)).status()).toBe(200)
  await page.getByRole('button', { name: '移除封面', exact: true }).click()
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('项目已保存')
  expect((await call(`/admin/media/${latest.coverMediaId}/references`)).total).toBe(0)
  expect((await call(`/admin/gallery/${photo.id}`)).mediaId).toBe(photo.mediaId)
  latest = await call(`/admin/projects/${project.id}`)
  await call(`/admin/projects/${project.id}?revision=${latest.revision}`, 'DELETE')
})

test('未知创建核查同一提交，迟到保存和刷新恢复保留后续输入', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/projects/new')
  const title = `同步工作台 ${randomUUID()}`
  await page.getByRole('textbox', { name: '项目标题', exact: true }).fill(title)
  let writes = 0
  await page.route('**/api/v1/admin/projects', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    writes++
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    if (writes === 1) return route.abort('failed')
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: '发布项目', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未核清')
  await page.getByRole('button', { name: '发布项目', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/projects\/\d+$/)
  expect(writes).toBe(1)
  expect((await (await request.get('/api/v1/projects?q=' + encodeURIComponent(title))).json()).data.total).toBe(1)
  const id = page.url().split('/').pop()!
  let delayed = false
  await page.route(`**/api/v1/admin/projects/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    delayed = true
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.fulfill({ response })
  })
  const description = page.getByRole('textbox', { name: '项目介绍', exact: true })
  await description.fill('正在保存的说明')
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect.poll(() => delayed).toBe(true)
  await description.fill('等待期间继续输入的说明')
  await expect(page.getByRole('status')).toContainText('当前新增输入仍保留')
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByLabel('项目恢复副本')).toBeVisible()
  await page.getByRole('button', { name: '恢复输入', exact: true }).click()
  await expect(description).toHaveValue('等待期间继续输入的说明')
  expect((await (await request.get(`/api/v1/projects/${id}`)).json()).data.description).toBe('正在保存的说明')
})

test('版本冲突保留本地字段，显式合并后成功保存同一项目', async ({ page, request }) => {
  const call = await api(request),
    project = await call('/admin/projects', 'POST', { requestId: randomUUID(), title: `并发工作台 ${randomUUID()}` })
  await login(page)
  await page.goto(`/admin/projects/${project.id}`)
  await page.getByRole('textbox', { name: '项目介绍', exact: true }).fill('本地待保存介绍')
  await call(`/admin/projects/${project.id}`, 'PATCH', {
    revision: project.revision,
    description: '另一个窗口的介绍',
    progress: 'active',
  })
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByLabel('项目服务器版本')).toContainText('另一个窗口的介绍')
  await expect(page.getByRole('textbox', { name: '项目介绍', exact: true })).toHaveValue('本地待保存介绍')
  await page.getByRole('button', { name: '保留输入，按最新版本继续合并', exact: true }).click()
  await page.getByRole('combobox', { name: '项目进展', exact: true }).selectOption('active')
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('项目已保存')
  expect((await call(`/admin/projects/${project.id}`)).description).toBe('本地待保存介绍')
})

test('真实会话撤销后原地登录恢复项目输入再提交', async ({ page, request }) => {
  const call = await api(request),
    project = await call('/admin/projects', 'POST', { requestId: randomUUID(), title: `会话工作台 ${randomUUID()}` })
  const sid = await login(page)
  await page.goto(`/admin/projects/${project.id}`)
  await page.getByRole('textbox', { name: '项目介绍', exact: true }).fill('登录过期时尚未保存的介绍')
  await call(`/auth/sessions/${sid}`, 'DELETE')
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '用户名', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '项目介绍', exact: true })).toHaveValue('登录过期时尚未保存的介绍')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '保存项目', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('项目已保存')
  expect((await call(`/admin/projects/${project.id}`)).description).toBe('登录过期时尚未保存的介绍')
})

test('服务端拒绝无效链接时保留输入，有效链接与技术去重保存到公开卡片', async ({ page, request }) => {
  await login(page)
  await page.goto('/admin/projects/new')
  const title = `链接工作台 ${randomUUID()}`
  await page.getByRole('textbox', { name: '项目标题', exact: true }).fill(title)
  await page.getByRole('button', { name: '添加项目链接', exact: true }).click()
  const href = page.getByRole('textbox', { name: '链接地址 1', exact: true })
  await href.fill('javascript:alert(1)')
  const rejected = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/admin/projects' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '发布项目', exact: true }).click()
  expect((await rejected).status()).toBe(400)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(href).toHaveValue('javascript:alert(1)')
  await href.fill('https://github.com/TixXin/TixXinBlog')
  for (const name of ['Vue', 'vue']) {
    await page.getByRole('button', { name: '添加技术标签', exact: true }).click()
    await page
      .getByRole('textbox', { name: /^技术名称 / })
      .last()
      .fill(name)
  }
  await page.getByRole('button', { name: '发布项目', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/projects\/\d+$/)
  const id = page.url().split('/').pop()!,
    value = (await (await request.get(`/api/v1/projects/${id}`)).json()).data
  expect(value.tags).toHaveLength(1)
  await page.goto(`/projects?q=${encodeURIComponent(title)}`)
  const card = page.locator(`[data-project-id="${id}"]`)
  await expect(card.getByRole('link', { name: '源代码', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/TixXin/TixXinBlog',
  )
  await expect(card.locator('a[href="#"]')).toHaveCount(0)
})

test('技术覆盖率来自公开项目实际标签，进展计数与明细一致', async ({ request }) => {
  const sample = await publicSample(request),
    projects: ProjectItem[] = []
  for (let page = 1; page <= Math.ceil(sample.total / 48); page++)
    projects.push(...(await (await request.get(`/api/v1/projects?page=${page}&pageSize=48`)).json()).data.items)
  const metadata = (await (await request.get('/api/v1/projects/metadata')).json()).data
  expect(metadata.stats.projects).toBe(projects.length)
  for (const progress of ['active', 'dev', 'archived'])
    expect(metadata.stats[progress]).toBe(projects.filter((project) => project.progress === progress).length)
  for (const tag of metadata.tags) {
    const count = projects.filter((project) =>
      project.tags.some((item) => item.label.toLowerCase() === tag.label.toLowerCase()),
    ).length
    expect(tag.count).toBe(count)
    expect(tag.percent).toBe(Math.round((count * 100) / projects.length))
  }
  expect(metadata.stats.tags).toBe(
    new Set(projects.flatMap((project) => project.tags.map((tag) => tag.label.toLowerCase()))).size,
  )
})

test('全局搜索真实项目可导航，项目搜索失败保留其他来源结果并重试', async ({ page, request }) => {
  const call = await api(request),
    title = `分页样本工作台 ${randomUUID()}`
  const project = await call('/admin/projects', 'POST', { requestId: randomUUID(), title, status: 'published' })
  await page.goto('/')
  await page.locator('[data-focus-key="site-search"]:visible').first().click()
  const dialog = page.getByRole('dialog', { name: '站内搜索', exact: true }),
    input = dialog.getByRole('textbox', { name: '搜索站内公开内容', exact: true })
  let failed = 0
  await page.route('**/api/v1/projects?*', (route) => {
    if (new URL(route.request().url()).searchParams.get('q') === '分页样本' && failed === 0) {
      failed++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '项目上游不可用' }),
      })
    }
    return route.continue()
  })
  await input.fill('分页样本')
  await expect(dialog.getByRole('alert')).toContainText('项目搜索暂时不可用')
  expect(failed).toBe(1)
  await expect(dialog.locator('a[href^="/articles/"]').first()).toBeVisible()
  await dialog.getByRole('button', { name: '重试搜索', exact: true }).click()
  const result = dialog.getByRole('link').filter({ hasText: title })
  await expect(result).toHaveAttribute('href', '/projects?project=' + project.id)
  await result.click()
  await expect(page).toHaveURL(/\/projects\?project=/)
  await expect(page.locator(`.projects-focus [data-project-id="${project.id}"]`)).toBeVisible()
  expect(new URL(page.url()).searchParams.get('project')).toBe(String(project.id))
})

test('失败不显示伪空列表，慢查询不会覆盖新筛选', async ({ page, request }) => {
  const sample = await publicSample(request),
    first = sample.items[0]!,
    second = sample.items[1]!
  await page.goto('/projects')
  await expect(page.locator('.project-card')).toHaveCount(12)
  let failed = 0,
    slow = false
  await page.route('**/api/v1/projects?*', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    if (q === first.title && failed === 0) {
      failed++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '项目上游不可用' }),
      })
    }
    if (q === first.title && slow) await new Promise((resolve) => setTimeout(resolve, 900))
    await route.continue()
  })
  const search = page.getByRole('textbox', { name: '搜索项目', exact: true })
  await search.fill(first.title)
  await expect(page.locator('.projects-body [role="alert"]')).toContainText('项目服务暂时不可用')
  expect(failed).toBe(1)
  await expect(page.locator('.project-card')).toHaveCount(12)
  await page.locator('.projects-body').getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator(`[data-project-id="${first.id}"]`)).toBeVisible()
  await search.fill(second.title)
  await expect(page.locator(`[data-project-id="${second.id}"]`)).toBeVisible()
  slow = true
  const waiting = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/v1/projects' &&
      new URL(request.url()).searchParams.get('q') === first.title,
  )
  await search.fill(first.title)
  await waiting
  await search.fill(second.title)
  await expect(page.locator(`[data-project-id="${second.id}"]`)).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.locator(`[data-project-id="${first.id}"]`)).toHaveCount(0)
})

test('首次统计失败在手机入口有重试，成功后显示真实项目统计', async ({ page }) => {
  await page.goto('/about')
  let failures = 0
  await page.route('**/api/v1/projects/metadata', (route) => {
    if (failures === 0) {
      failures++
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '项目统计不可用' }),
      })
    }
    return route.continue()
  })
  await page.locator('a[href="/projects"]:visible').first().click()
  await expect(page.locator('.project-card').first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 900 })
  const compact = page.locator('.projects-compact-info')
  await compact.locator('summary').click()
  await expect(compact.getByRole('alert')).toContainText('项目服务暂时不可用')
  expect(failures).toBe(1)
  await expect(compact.locator('.project-stats')).toHaveCount(0)
  await compact.getByRole('button', { name: '重试', exact: true }).click()
  await expect(compact.locator('.project-stats')).toBeVisible()
})

test('关闭 JavaScript 仍包含真实项目标题和正文', async ({ browser, request, baseURL }) => {
  const sample = await publicSample(request),
    context = await browser.newContext({ baseURL, javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: '项目展示', exact: true })).toBeVisible()
    await expect(page.locator('.project-card')).toHaveCount(12)
    await expect(page.locator('.project-card').first()).toContainText(sample.items[0]!.title)
  } finally {
    await context.close()
  }
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 767, 768, 1023, 1024, 1279, 1280, 1439, 1440]) {
    test(`项目 ${theme}/${width} 统计去重、筛选分页恢复及键盘布局`, async ({
      page,
      context,
      request,
      baseURL,
    }, testInfo) => {
      const issues: string[] = []
      page.on('pageerror', (error) => issues.push(error.message))
      page.on('console', (message) => {
        if (/hydration|NotFoundError|TypeError/i.test(message.text())) issues.push(message.text())
      })
      await publicSample(request)
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: baseURL! }])
      await page.setViewportSize({ width, height: 960 })
      await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' })
      await page.goto('/projects')
      await expect(page.locator(`.theme-${theme}`)).toBeVisible()
      await expect(page.locator('.project-card')).toHaveCount(12)
      const compact = page.locator('.projects-compact-info'),
        fixed = theme === 'nexus' ? width >= 1440 : theme === 'aurora' ? width >= 1280 : false
      if (fixed) await expect(compact).not.toBeVisible()
      else {
        await expect(compact).toBeVisible()
        await compact.locator('summary').click()
      }
      await expect(page.locator('.project-stats:visible')).toHaveCount(1)
      await expect(page.locator('.tech-stack:visible')).toHaveCount(1)
      await expect(page.getByRole('heading', { name: '项目概览', exact: true })).toHaveCount(1)
      await expect(page.getByRole('heading', { name: '技术栈分布', exact: true })).toHaveCount(1)
      await expect(page.locator('.tech-stack:visible')).toContainText('比例不表示代码语言占比')
      if (theme === 'dock') await expect(page.locator('#right-sidebar-target .project-stats')).toHaveCount(0)
      if (!fixed) await compact.locator('summary').click()
      const pagination = page.getByRole('navigation', { name: '项目分页', exact: true })
      await pagination.getByRole('button', { name: '下一页', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/page=2/)
      await page.reload()
      await expect(page).toHaveURL(/page=2/)
      await page.goBack()
      await expect(page).not.toHaveURL(/page=2/)
      await page.goForward()
      await expect(page).toHaveURL(/page=2/)
      await page.getByRole('combobox', { name: '筛选项目进展', exact: true }).selectOption('active')
      await expect(page).toHaveURL(/progress=active/)
      await expect(page).not.toHaveURL(/page=2/)
      await expect(page.locator('.project-card').first()).toBeVisible()
      const tag = page.getByRole('combobox', { name: '筛选项目技术', exact: true })
      const firstTag = await tag.locator('option').nth(1).getAttribute('value')
      expect(firstTag).toBeTruthy()
      await tag.selectOption(firstTag!)
      await expect(page).toHaveURL(/tag=/)
      await page.reload()
      await expect(tag).toHaveValue(firstTag!)
      await page.goBack()
      await expect(page).not.toHaveURL(/tag=/)
      await page.goForward()
      await expect(tag).toHaveValue(firstTag!)
      const filtered = (
        await (await request.get(`/api/v1/projects?progress=active&tag=${encodeURIComponent(firstTag!)}`)).json()
      ).data as ProjectPage
      expect(filtered.total).toBeGreaterThan(0)
      await expect(page.locator('.project-card')).toHaveCount(filtered.items.length)
      expect(
        await page
          .locator('.project-card')
          .evaluateAll((cards) => cards.map((card) => Number((card as HTMLElement).dataset.projectId))),
      ).toEqual(filtered.items.map((project) => project.id))
      expect(issues).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      await expect(page.locator('.project-card__stars, .project-card__example')).toHaveCount(0)
      if ([390, 1440].includes(width)) await captureMotion(page, testInfo, `projects-${theme}-${width}.png`)
    })
  }
}
