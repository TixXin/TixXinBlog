/** @file post-outline.spec.ts @description 隔离长文的章节位置、窄屏、原生撤销、输入法事件与恢复保存链路。 */
import { expect, test } from '@playwright/test'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

const longArticle =
  '# 写作手记\n\n```md\n# 代码里的标题不进入章节\n```\n\n' +
  Array.from({ length: 80 }, (_, index) => {
    const title = index === 39 || index === 79 ? '阶段回顾' : `写作阶段 ${index + 1}`
    const heading = index === 39 ? `${title}\n---` : `## ${title}`
    return `${heading}\n\n${'把观察、实现和验证依次写清楚，保留中文长段落与 English words 的自然折行。'.repeat(20)}\n\n`
  }).join('')
const lastOffset = longArticle.lastIndexOf('## 阶段回顾')
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

test.beforeEach(async ({ page, browserName }) => {
  expect(process.env.E2E_ISOLATED).toBe('true')
  prepareMotionCapture(page, browserName)
  page.on('dialog', (dialog) => dialog.accept())
  const login = await page.request.post('/api/v1/auth/login', {
    data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
  })
  expect(login.status()).toBe(200)
  await page.goto('/admin/posts/new')
  await expect(page.getByRole('textbox', { name: 'Markdown 正文', exact: true })).toBeEnabled()
  await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true }).uncheck()
})

for (const width of [320, 390, 760, 761, 800, 801, 1440]) {
  test(`${width}px 长文章通过章节定位到文末并返回开头，无横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
    await body.fill(longArticle)
    const input = await body.elementHandle()
    const chapters = page.getByRole('combobox', { name: '选择正文章节', exact: true })
    await expect(chapters.locator('option')).toHaveCount(82)
    await expect(chapters).not.toContainText('代码里的标题')
    expect(await chapters.locator('option').filter({ hasText: '阶段回顾' }).count()).toBe(2)
    await chapters.selectOption('80')
    await page.getByRole('button', { name: '定位章节', exact: true }).click()
    await expect(body).toBeFocused()
    expect(
      await body.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd]),
    ).toEqual([lastOffset, lastOffset])
    expect(await body.evaluate((element: HTMLTextAreaElement) => element.scrollTop > element.scrollHeight * 0.8)).toBe(
      true,
    )
    await expect(body).toHaveValue(longArticle)
    expect(await input!.evaluate((element) => element === document.querySelector('.post-editor__body textarea'))).toBe(
      true,
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(
      await page.locator('.admin-main').evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true)
    await chapters.selectOption('0')
    await page.getByRole('button', { name: '定位章节', exact: true }).click()
    expect(await body.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.scrollTop])).toEqual([
      0, 0,
    ])
    if (width === 320 || width === 1440) await captureMotion(page, testInfo, `post-outline-${width}.png`)
  })
}

test('章节定位不清空原生撤销重做记录，输入法合成期间不接管选区', async ({ page }) => {
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await body.fill(longArticle)
  await body.press(`${modifier}+End`)
  await page.keyboard.insertText('补充段落')
  await expect(body).toHaveValue(longArticle + '补充段落')
  const chapters = page.getByRole('combobox', { name: '选择正文章节', exact: true })
  await chapters.selectOption('0')
  const jump = page.getByRole('button', { name: '定位章节', exact: true })
  await jump.click()
  await body.press(`${modifier}+z`)
  await expect(body).toHaveValue(longArticle)
  await body.press(`${modifier}+Shift+z`)
  await expect(body).toHaveValue(longArticle + '补充段落')

  await body.evaluate((element: HTMLTextAreaElement) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    element.value += '\n\n## 正在合成中文标题'
    element.setSelectionRange(element.value.length, element.value.length)
    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }),
    )
  })
  await expect(chapters).toBeDisabled()
  await expect(jump).toBeDisabled()
  expect(await body.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(
    longArticle.length + '补充段落\n\n## 正在合成中文标题'.length,
  )
  await body.evaluate((element) => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
  await expect(chapters).toContainText('正在合成中文标题')
  await chapters.selectOption('81')
  await jump.click()
  expect(await body.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(
    longArticle.length + '补充段落\n\n'.length,
  )
})

test('仅定位不会改写本机恢复副本，刷新载入长文后章节仍可定位', async ({ page }) => {
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('长文章的组织与回顾')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await body.fill(longArticle)
  await expect(page.getByRole('region', { name: '文章保存状态' })).toContainText('本机恢复副本：已保存于')
  const readCopies = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('tixxin-post-recovery:'))
        .sort()
        .map((key) => localStorage.getItem(key)),
    )
  await expect
    .poll(async () => (await readCopies()).some((value) => JSON.parse(value!).draft.contentRaw === longArticle))
    .toBe(true)
  const before = await readCopies()
  await page.getByRole('combobox', { name: '选择正文章节', exact: true }).selectOption('80')
  await page.getByRole('button', { name: '定位章节', exact: true }).click()
  expect(await readCopies()).toEqual(before)
  await page.reload()
  await page.getByRole('button', { name: '比较恢复副本', exact: true }).click()
  await page.getByRole('button', { name: '载入本机副本继续编辑', exact: true }).click()
  await expect(body).toHaveValue(longArticle)
  await page.getByRole('combobox', { name: '选择正文章节', exact: true }).selectOption('80')
  await page.getByRole('button', { name: '定位章节', exact: true }).click()
  expect(await body.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(lastOffset)
})

test('定位章节保留自动保存开关，原有空闲草稿保存能够完成', async ({ page }) => {
  const automatic = page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true })
  await automatic.check()
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('持续写作时的章节定位')
  const body = page.getByRole('textbox', { name: 'Markdown 正文', exact: true })
  await body.fill(longArticle)
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/admin/posts') && response.request().method() === 'POST',
    { timeout: 25000 },
  )
  await page.getByRole('combobox', { name: '选择正文章节', exact: true }).selectOption('80')
  await page.getByRole('button', { name: '定位章节', exact: true }).click()
  await expect(automatic).toBeChecked()
  const response = await saved
  expect(response.status()).toBe(201)
  const result = (await response.json()).data
  expect(result.contentRaw).toBe(longArticle)
  expect(result.status).toBe('draft')
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  await expect(body).toHaveValue(longArticle)
})
