/** @file site-editor-protection.spec.ts @description 隔离站点编辑专项：恢复合并、已执行但响应丢失、窄屏排序与焦点 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { SiteSettingsData } from '../../app/features/site/settings'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

test.beforeEach(async ({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
})
async function currentSite(page: Page) {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` }
  const response = await page.request.get('/api/v1/admin/site', { headers })
  expect(response.status()).toBe(200)
  return { value: (await response.json()).data as SiteSettingsData, headers }
}
async function restore(page: Page, value: SiteSettingsData, headers: Record<string, string>) {
  const latest = await page.request.get('/api/v1/admin/site', { headers })
  expect(latest.status()).toBe(200)
  const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...body } = value
  const response = await page.request.patch('/api/v1/admin/site', {
    headers,
    data: { ...body, revision: (await latest.json()).data.revision },
  })
  expect(response.status()).toBe(200)
}
test('未保存关于介绍刷新后显式恢复，保留其他标签页的公告', async ({ page }) => {
  const original = await currentSite(page)
  try {
    await page.goto('/admin/site')
    await page.getByRole('textbox', { name: '详细介绍', exact: true }).fill('围绕这个博客记录实现过程与长期维护经验。')
    const latest = await page.request.get('/api/v1/admin/site', { headers: original.headers })
    const values = (await latest.json()).data
    const { updatedAt: _updatedAt, announcementUpdatedAt: _announcementUpdatedAt, ...editable } = values
    const changed = await page.request.patch('/api/v1/admin/site', {
      headers: original.headers,
      data: { ...editable, announcement: '本周更新了站点维护笔记。' },
    })
    expect(changed.status()).toBe(200)
    page.once('dialog', (dialog) => dialog.accept())
    await page.reload()
    await expect(page.getByRole('textbox', { name: '详细介绍', exact: true })).toHaveValue(
      original.value.about?.introduction ?? '',
    )
    await page.getByRole('button', { name: '恢复此前输入', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '详细介绍', exact: true })).toHaveValue(
      '围绕这个博客记录实现过程与长期维护经验。',
    )
    await expect(page.getByRole('textbox', { name: '站点公告', exact: true })).toHaveValue('本周更新了站点维护笔记。')
  } finally {
    await restore(page, original.value, original.headers)
  }
})
test('真实 PATCH 已完成而客户端断线，核对后不重复提交', async ({ page }) => {
  const original = await currentSite(page)
  let writes = 0,
    committed = false
  try {
    await page.goto('/admin/site')
    await page.getByRole('textbox', { name: '详细介绍', exact: true }).fill('记录可复核的技术实践与维护过程。')
    await page.route('**/api/v1/admin/site', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      writes++
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      committed = true
      await route.abort('failed')
    })
    await page.getByRole('button', { name: '保存并生效', exact: true }).click()
    await expect(page.getByRole('button', { name: '核对服务器提交结果', exact: true })).toBeVisible()
    await expect.poll(() => committed).toBe(true)
    await expect(page.getByRole('button', { name: '保存并生效', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '核对服务器提交结果', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('服务器已包含此次提交的资料')
    await expect(page.getByRole('button', { name: '核对服务器提交结果', exact: true })).toHaveCount(0)
    expect(writes).toBe(1)
  } finally {
    await page.unroute('**/api/v1/admin/site')
    await restore(page, original.value, original.headers)
  }
})
for (const width of [320, 390]) {
  test(`${width}px 关于条目排序后焦点保持在同一条目且无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 840 })
    await page.goto('/admin/site')
    const about = page.getByRole('group', { name: '关于页资料', exact: true })
    await expect(about).toBeVisible()
    if (await about.getByRole('button', { name: '添加技能栏目', exact: true }).count())
      await about.getByRole('button', { name: '添加技能栏目', exact: true }).click()
    const skills = about.getByRole('group', { name: '技能', exact: true })
    await skills.getByRole('button', { name: '添加技能', exact: true }).click()
    const first = skills.getByRole('textbox', { name: '名称', exact: true }).last()
    await first.fill('待整理的第一项')
    await skills.getByRole('button', { name: '添加技能', exact: true }).click()
    await skills.getByRole('textbox', { name: '名称', exact: true }).last().fill('待整理的第二项')
    await skills.getByRole('button', { name: '上移待整理的第二项', exact: true }).click()
    await expect(page.locator('input:focus')).toHaveValue('待整理的第二项')
    const titles = await skills
      .getByRole('textbox', { name: '名称', exact: true })
      .evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value))
    expect(titles.indexOf('待整理的第二项')).toBe(titles.indexOf('待整理的第一项') - 1)
    await skills.getByRole('button', { name: '移除待整理的第二项', exact: true }).click()
    await expect(page.locator('input:focus')).toHaveValue('待整理的第一项')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await captureMotion(page, testInfo, `site-about-${width}-focus.png`, { target: skills })
  })
}
