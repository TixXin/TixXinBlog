/** @file sustainable-admin.spec.ts @description 隔离运营工作台、通知业务状态、局部失败及三主题断点键盘验收。 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { setTimeout as pause } from 'node:timers/promises'
import { overviewDomains, overviewTasks } from '../../app/features/admin/overview'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
})
async function admin(page: Page) {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const token = (await login.json()).data.accessToken
  const context = (await page.request.get('/api/v1/site')).headers()['x-content-context']
  return async (path: string, method = 'GET', data?: unknown, owner = true) => {
    const response = await page.request.fetch('/api/v1' + path, {
      method,
      data,
      headers: {
        'X-Visitor-Id': 'sustainable-' + randomUUID(),
        ...(context ? { 'X-Content-Context': context } : {}),
        ...(owner ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    expect(response.status(), `${method} ${path}`).toBeLessThan(300)
    return (await response.json()).data
  }
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  if (await page.locator('.admin-main').count())
    expect(
      await page.locator('.admin-main').evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true)
}
async function setPolicy(api: Awaited<ReturnType<typeof admin>>, requireApproval: boolean) {
  const current = await api('/admin/comments/policy')
  return api('/admin/comments/policy', 'PATCH', { revision: current.revision, requireApproval })
}
async function setSite(api: Awaited<ReturnType<typeof admin>>, values: Record<string, unknown>) {
  const current = await api('/admin/site')
  const {
    updatedAt: _updatedAt,
    announcementUpdatedAt: _announcementUpdatedAt,
    ...editable
  } = { ...current, ...values }
  return api('/admin/site', 'PATCH', { ...editable, revision: current.revision })
}

test('六域草稿与五类待办均来自真实列表，并能进入筛选落点及返回', async ({ page }) => {
  const api = await admin(page),
    suffix = randomUUID().slice(0, 8)
  const bodies: Record<string, unknown> = {
    post: { title: `待完成的写作 ${suffix}`, contentRaw: '继续整理文章。', status: 'draft' },
    flash: { content: `待整理的灵感 ${suffix}`, isDraft: true },
    moment: { content: `准备分享的近况 ${suffix}`, status: 'draft', requestId: randomUUID() },
    gallery: {
      title: `光影记录 ${suffix}`,
      externalUrl: 'https://example.com/workspace-photo.jpg',
      status: 'draft',
      requestId: randomUUID(),
    },
    project: { title: `写作工具 ${suffix}`, status: 'draft', requestId: randomUUID() },
    link: {
      name: `阅读来源 ${suffix}`,
      url: `https://example.com/${suffix}`,
      status: 'draft',
      requestId: randomUUID(),
    },
  }
  for (const domain of overviewDomains) await api(domain.path, 'POST', bodies[domain.domain])
  const overview = await api('/admin/overview')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: '创作与草稿', exact: true })).toBeVisible()
  for (const domain of overviewDomains) {
    const count = overview.counts[domain.drafts]
    expect(count).toBeGreaterThan(0)
    const card = page
      .getByRole('region', { name: '创作与草稿', exact: true })
      .locator('article')
      .filter({ has: page.locator(`a[href="${domain.path}"]`) })
    await expect(card.getByRole('link', { name: `${count} 份草稿`, exact: true })).toBeVisible()
    await card.getByRole('link', { name: `${count} 份草稿`, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${domain.path}\\?status=draft$`))
    expect((await api(domain.path + '?status=draft')).total).toBe(count)
    const filters = {
      post: '文章状态',
      flash: '闪念状态',
      moment: '筛选动态状态',
      gallery: '筛选作品状态',
      project: '筛选项目发布状态',
      link: '筛选友链发布状态',
    }
    await expect(page.getByRole('combobox', { name: filters[domain.domain], exact: true })).toHaveValue('draft')
    await expect(
      page.getByRole('heading', { name: `${domain.label === '图库' ? '图库' : domain.label}管理`, exact: true }),
    ).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: '创作与草稿', exact: true })).toBeVisible()
  }
  await setPolicy(api, false)
  await api(
    '/posts/1/comments',
    'POST',
    { requestId: randomUUID(), author: '读者', content: '希望进一步了解这个实现。' },
    false,
  )
  await api('/guestbook', 'POST', { requestId: randomUUID(), author: '读者', content: '期待继续阅读更新。' }, false)
  await setPolicy(api, true)
  await api(
    '/posts/1/comments',
    'POST',
    { requestId: randomUUID(), author: '读者', content: '关于写作的一些想法。' },
    false,
  )
  await api(
    '/guestbook',
    'POST',
    { requestId: randomUUID(), author: '读者', content: '下午好，来看看最近的文章。' },
    false,
  )
  const moment = (await api('/admin/moments?status=published&pageSize=1')).items[0]
  await api(
    `/moments/${moment.id}/comments`,
    'POST',
    { requestId: randomUUID(), author: '读者', content: '这段记录很有启发。' },
    false,
  )
  const current = await api('/admin/overview')
  await page.getByRole('button', { name: '刷新工作台', exact: true }).click()
  for (const task of overviewTasks) {
    const count = current.counts[task.key]
    expect(count).toBeGreaterThan(0)
    const link = page
      .getByRole('region', { name: '待处理互动', exact: true })
      .getByRole('link', { name: new RegExp(`${task.label}\\s*${count}$`) })
    await expect(link).toBeVisible()
    await link.focus()
    await page.keyboard.press('Enter')
    const target = new URL(task.to, 'http://localhost')
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(task.to)
    const endpoint = target.pathname === '/admin/moment-comments' ? '/admin/moments/comments' + target.search : task.to
    expect((await api(endpoint)).total).toBe(count)
    if (task.key === 'pendingComments')
      await expect(page.getByRole('combobox', { name: '评论状态', exact: true })).toHaveValue('pending')
    else if (task.key === 'pendingGuestbook')
      await expect(page.getByRole('combobox', { name: '留言审核状态', exact: true })).toHaveValue('pending')
    else if (task.key === 'pendingMomentComments')
      await expect(
        page.getByRole('navigation', { name: '朋友圈评论筛选' }).locator('[aria-current="page"]'),
      ).toHaveText('待审核')
    else
      await expect(
        page.getByRole('checkbox', {
          name: task.key === 'unanswered' ? '仅待回复根评论' : '仅待博主回复',
          exact: true,
        }),
      ).toBeChecked()
    await expect(page.getByRole('main', { name: '管理内容' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: '待处理互动', exact: true })).toBeVisible()
  }
  await setPolicy(api, false)
})

test('通知已读不改变待审核，隐藏和删除后显示不可用，键盘焦点不丢失', async ({ page }) => {
  const api = await admin(page)
  await setPolicy(api, true)
  const message = await api(
    '/guestbook',
    'POST',
    { requestId: randomUUID(), author: '清晨读者', content: '想了解文章中提到的维护流程。' },
    false,
  )
  const notification = (await api('/admin/notifications')).items.find(
    (item: { url: string | null }) => item.url === `/admin/guestbook?focus=${message.id}`,
  )
  expect(notification).toBeTruthy()
  const before = (await api('/admin/overview')).counts.pendingGuestbook
  await page.goto('/admin/notifications?filter=unread')
  const row = page.locator(`[data-notification-id="${notification.id}"]`)
  await expect(row).toContainText('等待审核')
  await row.getByRole('button', { name: '标记已读', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(row).toHaveCount(0)
  expect(await page.evaluate(() => ['LI', 'H1'].includes(document.activeElement?.tagName ?? ''))).toBe(true)
  expect((await api('/admin/overview')).counts.pendingGuestbook).toBe(before)
  await page.getByRole('navigation', { name: '通知筛选' }).getByRole('link', { name: '全部', exact: true }).click()
  await expect(row).toContainText('等待审核')
  await expect(row.getByRole('button', { name: '标记已读', exact: true })).toHaveCount(0)
  let current = await api(`/admin/guestbook/${message.id}`)
  await api(`/admin/guestbook/${message.id}`, 'PATCH', { revision: current.revision, status: 'hidden' })
  await page.reload()
  await expect(row).toContainText('对应内容不可用')
  await expect(row.getByRole('link', { name: '查看对应内容' })).toHaveCount(0)
  current = await api(`/admin/guestbook/${message.id}`)
  await api(`/admin/guestbook/${message.id}?revision=${current.revision}`, 'DELETE')
  await page.reload()
  await expect(row).toContainText('内容已删除或隐藏')
  expect((await api('/admin/overview')).counts.pendingGuestbook).toBe(before - 1)
  await setPolicy(api, false)
})

test('维护摘要单区故障保留工作台与通知，局部重试后恢复；未启用不报成功', async ({ page }) => {
  await admin(page)
  let failure = false
  await page.route('**/api/v1/admin/operations', async (route) => {
    if (!failure && route.request().method() === 'GET') {
      failure = true
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '隔离运行状态故障' }),
      })
      return
    }
    await route.continue()
  })
  await page.goto('/admin')
  const summary = page.getByRole('region', { name: '通知与维护', exact: true })
  await expect(summary).toContainText('维护运行记录暂不可用')
  expect(failure).toBe(true)
  await expect(page.getByRole('region', { name: '创作与草稿' })).toBeVisible()
  await expect(summary.getByRole('link', { name: /互动通知/ })).toContainText('条未读')
  await summary.getByRole('button', { name: '重新读取维护摘要', exact: true }).click()
  await expect(summary).toContainText('最近备份完整性校验：尚无运行记录')
  await expect(summary).not.toContainText('维护运行记录暂不可用')
  await summary.getByRole('link', { name: '查看运行、投递与备份记录', exact: true }).click()
  await expect(page.getByRole('region', { name: '运行检查', exact: true })).toContainText('邮件：未启用或配置未完整')
  await expect(page.getByRole('region', { name: '运行检查', exact: true })).toContainText(
    '自动备份：未启用或配置未完整',
  )
  await expect(page.getByText('SMTP 服务已接受本次邮件。', { exact: true })).toHaveCount(0)
  await page.goBack()
  await expect(page.getByRole('heading', { name: '管理概览', exact: true })).toBeVisible()
})

test('积压超过一页时邮件通知深链读取指定旧通知并聚焦，隐藏后保持准确状态', async ({ page }, testInfo) => {
  const api = await admin(page)
  await setPolicy(api, true)
  let target!: { id: string },
    messageId = 0
  for (let index = 0; index < 21; index++) {
    // 隔离环境仍遵守真实写限流，每七条跨过一秒窗口。
    if (index && index % 7 === 0) await pause(1100)
    const message = await api(
      '/guestbook',
      'POST',
      { requestId: randomUUID(), author: '周末读者', content: `想继续了解第 ${index + 1} 段维护经验。` },
      false,
    )
    if (!index) {
      messageId = message.id
      target = (await api('/admin/notifications')).items.find(
        (item: { url: string | null }) => item.url === `/admin/guestbook?focus=${message.id}`,
      )
      expect(target).toBeTruthy()
    }
  }
  expect((await api('/admin/notifications')).items.some((item: { id: string }) => item.id === target.id)).toBe(false)
  expect((await page.request.get(`/api/v1/admin/notifications/${target.id}`)).status()).toBe(401)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto(`/admin/notifications?notification=${target.id}`)
  const panel = page.getByRole('region', { name: '指定通知', exact: true })
  await expect(panel).toHaveAttribute('data-focused-notification-id', target.id)
  await expect(panel).toBeFocused()
  await expect(panel).toContainText('等待审核')
  await expect(panel.getByRole('link', { name: '查看对应内容', exact: true })).toHaveAttribute(
    'href',
    `/admin/guestbook?focus=${messageId}`,
  )
  await panel.getByRole('button', { name: '标记已读', exact: true }).click()
  await expect(panel.getByRole('button', { name: '标记已读', exact: true })).toHaveCount(0)
  await expect(panel).toContainText('等待审核')
  await expect(panel).toBeFocused()
  await noOverflow(page)
  await captureMotion(page, testInfo, 'notification-deeplink-320.png', { target: panel })
  const message = await api(`/admin/guestbook/${messageId}`)
  await api(`/admin/guestbook/${messageId}`, 'PATCH', { revision: message.revision, status: 'hidden' })
  await page.reload()
  await expect(panel).toContainText('对应内容不可用')
  await expect(panel.getByRole('link', { name: '查看对应内容', exact: true })).toHaveCount(0)
  await page.goto(`/admin/notifications?notification=${randomUUID()}`)
  await expect(page.getByRole('alert')).toContainText('指定通知不存在或暂时无法读取')
  await expect(panel).toHaveCount(0)
  await expect(page.getByText(/未读 \d+ 条 · 当前筛选 \d+ 条/)).toBeVisible()
  await setPolicy(api, false)
})

for (const theme of ['nexus', 'aurora', 'dock']) {
  for (const width of [320, 390, 760, 761, 1440]) {
    test(`${theme} ${width}px 工作台通知运行入口与键盘均可使用`, async ({ page, context }, testInfo) => {
      await admin(page)
      await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: process.env.E2E_BASE_URL! }])
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 900 })
      for (const [path, title] of [
        ['/admin', '管理概览'],
        ['/admin/notifications', '互动通知'],
        ['/admin/operations', '运行状态'],
      ]) {
        await page.goto(path!)
        await expect(page.getByRole('heading', { name: title!, exact: true })).toBeVisible()
        if (path === '/admin')
          await expect(page.getByRole('heading', { name: '待处理互动', exact: true })).toBeVisible()
        else if (path === '/admin/notifications')
          await expect(page.getByText(/未读 \d+ 条 · 当前筛选 \d+ 条/)).toBeVisible()
        else await expect(page.getByRole('region', { name: '运行检查', exact: true })).toContainText('数据库：查询正常')
        await expect(page.getByRole('main').getByText('正在加载…', { exact: true })).toHaveCount(0)
        await noOverflow(page)
      }
      const link = page.getByRole('main').getByRole('link', { name: '互动通知', exact: true })
      await link.focus()
      await expect(link).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/admin\/notifications$/)
      await noOverflow(page)
      if (width <= 760) {
        await page.getByRole('button', { name: '管理导航', exact: true }).click()
        const drawer = page.getByRole('dialog', { name: '管理导航', exact: true })
        await expect(drawer).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(drawer).toBeHidden()
        await expect(page.getByRole('button', { name: '管理导航', exact: true })).toBeFocused()
      } else await expect(page.locator('.admin-sidebar')).toBeVisible()
      if ([320, 761, 1440].includes(width))
        await captureMotion(page, testInfo, `sustainable-admin-${theme}-${width}.png`)
    })
  }
  test(`${theme} 关于页只显示已确认公开栏目，缺省不伪造资料`, async ({ page, context }, testInfo) => {
    const api = await admin(page),
      original = await api('/admin/site')
    await context.addCookies([{ name: 'tixxin-blog-layout-theme', value: theme, url: process.env.E2E_BASE_URL! }])
    try {
      await setSite(api, { about: { visible: false, introduction: '隐藏的私人介绍', sections: [] } })
      await page.goto('/about')
      await expect(page.locator('.profile-content')).toHaveCount(0)
      await expect(page.getByText('隐藏的私人介绍', { exact: true })).toHaveCount(0)
      const publicly = await api('/site', 'GET', undefined, false)
      expect(JSON.stringify(publicly)).not.toContain('隐藏的私人介绍')
      await setSite(api, {
        about: {
          visible: true,
          introduction: '围绕这个博客记录技术实践。',
          sections: [
            {
              kind: 'skill',
              visible: true,
              items: [
                { title: '系统维护', detail: '记录可以复核的过程。', period: '', visible: true },
                { title: '不公开的条目', detail: '', period: '', visible: false },
              ],
            },
            {
              kind: 'experience',
              visible: false,
              items: [{ title: '不公开的经历', detail: '', period: '', visible: true }],
            },
            { kind: 'reading', visible: true, items: [] },
          ],
        },
      })
      for (const width of [320, 390, 760, 761, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.reload()
        await expect(page.getByText('围绕这个博客记录技术实践。', { exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: '系统维护', exact: true })).toBeVisible()
        await expect(page.getByText(/不公开的条目|不公开的经历/)).toHaveCount(0)
        await expect(page.getByRole('heading', { name: '书单', exact: true })).toHaveCount(0)
        await noOverflow(page)
      }
      await captureMotion(page, testInfo, `sustainable-about-${theme}.png`)
    } finally {
      await setSite(api, original)
    }
  })
}
