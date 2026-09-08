/**
 * @file flash-ux.spec.ts
 * @description 隔离数据库上的闪念权限、忙碌/错误恢复、过滤与详情状态验收
 * @author TixXin
 * @since 2026-09-07
 */
import { expect, test } from '@playwright/test'
import { writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

test('公开闪念可互动，草稿归档受限，手机工具栏和折叠搜索可用', async ({ page, browser, baseURL }, testInfo) => {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/flash')
  const editor = page.getByRole('textbox', { name: '闪念正文', exact: true })
  await editor.fill('UX 公开闪念验收')
  await page.getByRole('button', { name: '添加标签', exact: true }).click()
  await page.getByRole('textbox', { name: '新标签', exact: true }).fill('验收')
  await page.getByRole('textbox', { name: '新标签', exact: true }).press('Enter')
  const draftButton = page.getByRole('button', { name: '保存草稿', exact: true })
  const bounds = await draftButton.boundingBox()
  expect(bounds!.width).toBeGreaterThan(60)
  expect(bounds!.height).toBeGreaterThanOrEqual(32)
  await page.locator('.fed').screenshot({ animations: 'disabled', path: testInfo.outputPath('flash-editor-390.png') })
  await page.getByRole('button', { name: /^发布/ }).click()
  const publicNote = page.locator('.fnc').filter({ hasText: 'UX 公开闪念验收' })
  await expect(publicNote).toBeVisible()
  const id = (await publicNote.getAttribute('id'))!.replace('flash-note-', '')
  await editor.fill('UX 未公开草稿验收')
  await draftButton.click()
  const draft = page.locator('.fnc').filter({ hasText: 'UX 未公开草稿验收' })
  await expect(draft.getByRole('button', { name: '点赞', exact: true })).toBeDisabled()
  await expect(draft.getByRole('button', { name: '评论', exact: true })).toBeDisabled()
  await publicNote.getByRole('button', { name: '归档', exact: true }).click()
  await page.getByRole('button', { name: '查看归档箱', exact: true }).click()
  await expect(publicNote.getByRole('button', { name: '点赞', exact: true })).toBeDisabled()
  await publicNote.getByRole('button', { name: '恢复', exact: true }).click()
  await page.getByRole('button', { name: '返回主列表', exact: true }).click()
  await expect(publicNote).toBeVisible()
  const guestContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
  try {
    const guest = await guestContext.newPage()
    await guest.goto('/flash')
    const note = guest.locator(`#flash-note-${id}`)
    await expect(note.getByRole('button', { name: '点赞', exact: true })).toBeEnabled()
    await expect(guest.getByText('UX 未公开草稿验收', { exact: true })).toHaveCount(0)
    await expect(note.getByRole('button', { name: '编辑闪念', exact: true })).toHaveCount(0)
    let continueLike!: () => Promise<void>
    await guest.route(`**/api/v1/flashes/${id}/like`, (route) => {
      continueLike = () => route.continue()
    })
    await note.getByRole('button', { name: '点赞', exact: true }).click()
    await expect(note.getByRole('button', { name: '点赞', exact: true })).toBeDisabled()
    await expect.poll(() => typeof continueLike).toBe('function')
    await continueLike()
    await expect(note.getByRole('button', { name: '取消点赞', exact: true })).toBeEnabled()
    await guest.unroute(`**/api/v1/flashes/${id}/like`)
    await note.getByRole('button', { name: '评论', exact: true }).click()
    const comment = note.getByRole('textbox', { name: '闪念评论内容', exact: true })
    await comment.fill('UX 网络恢复后评论')
    await guest.route(`**/api/v1/flashes/${id}/comments`, (route) => route.abort())
    await note.getByRole('button', { name: '发送评论', exact: true }).click()
    await guest.getByRole('textbox', { name: '昵称 *', exact: true }).fill('UX 闪念访客')
    await guest.getByRole('button', { name: '确认身份', exact: true }).click()
    await expect(guest.getByText('暂时无法连接闪念服务，请稍后重试', { exact: true })).toBeVisible()
    await expect(comment).toHaveValue('UX 网络恢复后评论')
    await expect(note.getByRole('button', { name: '发送评论', exact: true })).toBeEnabled()
    await guest.unroute(`**/api/v1/flashes/${id}/comments`)
    await note.getByRole('button', { name: '发送评论', exact: true }).click()
    await expect(note.getByText('UX 网络恢复后评论', { exact: true })).toBeVisible()
    await expect(comment).toHaveValue('')
    await guest.getByRole('button', { name: '搜索闪念', exact: true }).click()
    const search = guest.getByRole('textbox', { name: '搜索闪念内容或标签', exact: true })
    await search.fill('公开闪念验收')
    await expect(guest.getByRole('status').filter({ hasText: '关键词：公开闪念验收' })).toBeVisible()
    await search.press('Escape')
    await expect(search).toHaveCount(0)
    await expect(guest.getByRole('status').filter({ hasText: '关键词：公开闪念验收' })).toBeVisible()
    await guest.getByRole('button', { name: '清除全部筛选', exact: true }).click()
    await guest.goto(`/flash/${id}`)
    await expect(guest.locator('.aside-right')).toBeHidden()
    await expect(guest.getByText('UX 公开闪念验收', { exact: true })).toBeVisible()
    await guest.screenshot({ animations: 'disabled', path: testInfo.outputPath('flash-public-detail.png') })
  } finally {
    await guestContext.close()
  }
})

test('缺失动态与闪念返回404，页面语言和恢复动作正确', async ({ page, request }) => {
  for (const [path, title] of [
    ['/moments/not-present', '动态不存在'],
    ['/flash/00000000-0000-4000-8000-000000000000', '闪念不存在'],
  ]) {
    expect((await request.get(path!)).status()).toBe(404)
    await page.goto(path!)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
  }
})

test('闪念网络失败不伪装不存在，重试仍回到原详情', async ({ page, request }, testInfo) => {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/flash')
  await page.getByRole('textbox', { name: '闪念正文', exact: true }).fill('UX 详情故障恢复')
  await page.getByRole('button', { name: /^发布/ }).click()
  const note = page.locator('.fnc').filter({ hasText: 'UX 详情故障恢复' })
  await expect(note).toBeVisible()
  const id = (await note.getAttribute('id'))!.replace('flash-note-', '')
  await page.route('**/api/v1/flashes?**', (route) => route.abort())
  await note.getByRole('link', { name: /查看闪念详情/ }).click()
  await expect(page.getByRole('heading', { name: '闪念加载失败', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '闪念不存在', exact: true })).toHaveCount(0)
  await page.unroute('**/api/v1/flashes?**')
  // 带故障代理的本机runner还能校验SSR HTTP状态；普通CI始终执行上面的CSR恢复路径。
  const failureFile = process.env.E2E_FLASH_FAILURE_FLAG
  if (failureFile) {
    expect(resolve(failureFile)).toBe(resolve(process.cwd(), '../../../.codex/ui-ux-fixes/fail-flash-api'))
    try {
      await writeFile(failureFile, 'fail')
      const failure = await request.get(`/flash/${id}`)
      expect(failure.status()).toBe(502)
      expect(await failure.text()).toContain('闪念加载失败')
      await testInfo.attach('SSR上游故障状态', {
        body: JSON.stringify({ path: `/flash/${id}`, status: failure.status() }),
        contentType: 'application/json',
      })
    } finally {
      await unlink(failureFile).catch(() => {})
    }
  }
  await page.getByRole('button', { name: '重试当前页面', exact: true }).click()
  await expect(page.getByText('UX 详情故障恢复', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/flash/${id}$`))
  await expect(page.locator('.aside-right')).toBeHidden()
})
