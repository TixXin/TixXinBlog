/** @file media-organization.spec.ts @description 隔离媒体说明、真实尺寸与引用筛选、业务跳转及选择器未保存保护。 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import type { MediaAsset } from '../../app/features/media/types'
import { captureMotion, prepareMotionCapture } from './motionScreenshot'

async function upload(page: Page, token: string, name: string, width: number, height: number, color: string) {
  const data = await page.evaluate(
    ({ width, height, color }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')!
      context.fillStyle = color
      context.fillRect(0, 0, width, height)
      return canvas.toDataURL('image/png').split(',')[1]!
    },
    { width, height, color },
  )
  const response = await page.request.post('/api/v1/admin/media', {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name, mimeType: 'image/png', buffer: Buffer.from(data, 'base64') },
      uploadId: randomUUID(),
      alt: name,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as MediaAsset
}

for (const width of [320, 390, 1440]) {
  test(`${width}px 媒体说明、组合筛选与引用跳转形成真实操作链路`, async ({ page, browserName }, testInfo) => {
    expect(process.env.E2E_ISOLATED).toBe('true')
    prepareMotionCapture(page, browserName)
    await page.setViewportSize({ width, height: 900 })
    const login = await page.request.post('/api/v1/auth/login', {
      data: { username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD },
    })
    expect(login.status()).toBe(200)
    const token = (await login.json()).data.accessToken as string
    await page.goto('/admin/media')
    const prefix = '构图-' + randomUUID().slice(0, 8)
    const detail = `封面构图说明与素材出处 ${prefix}`
    const landscape = await upload(page, token, `${prefix}-暖色横图.png`, 90, 60, '#cc7744')
    const portrait = await upload(page, token, `${prefix}-蓝色竖图.png`, 60, 90, '#4477cc')
    await upload(page, token, `${prefix}-绿色方图.png`, 60, 60, '#447755')
    const title = `整理写作素材的方法 ${prefix}`
    const post = await page.request.post('/api/v1/admin/posts', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title,
        contentRaw: `# 构图笔记\n\n![暖色横向图](${landscape.url})`,
        cover: landscape.url,
        status: 'draft',
      },
    })
    expect(post.status()).toBe(201)
    const postId = (await post.json()).data.id as number
    await page.goto(`/admin/media?search=${encodeURIComponent(prefix)}`)
    const cards = page.locator('.media-library__grid > li')
    await expect(cards).toHaveCount(3)
    const card = cards.filter({ has: page.getByText(landscape.name, { exact: true }) })
    const description = card.getByRole('textbox', { name: `${landscape.name} 素材说明`, exact: true })
    await description.fill(detail)
    await expect(page.getByRole('combobox', { name: '媒体构图', exact: true })).toBeDisabled()
    const saved = page.waitForResponse(
      (response) => response.url().endsWith(`/admin/media/${landscape.id}`) && response.request().method() === 'PATCH',
    )
    await card.getByRole('button', { name: '保存素材说明', exact: true }).click()
    expect((await saved).status()).toBe(200)
    await expect(card.getByRole('button', { name: '保存素材说明', exact: true })).toBeDisabled()
    await expect(card.getByRole('textbox', { name: `${landscape.name} 替代文本`, exact: true })).toHaveValue(
      landscape.alt,
    )
    await page.getByRole('textbox', { name: '搜索媒体', exact: true }).fill(detail)
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText(landscape.name)
    await page.getByRole('textbox', { name: '搜索媒体', exact: true }).fill(prefix)
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(cards).toHaveCount(3)
    await page.getByRole('combobox', { name: '媒体构图', exact: true }).selectOption('portrait')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText(portrait.name)
    const empty = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname.endsWith('/admin/media') &&
        url.searchParams.get('usage') === 'used' &&
        url.searchParams.get('orientation') === 'portrait'
      )
    })
    await page.getByRole('combobox', { name: '媒体使用状态', exact: true }).selectOption('used')
    expect((await (await empty).json()).data.total).toBe(0)
    await expect(cards).toHaveCount(0)
    await expect(page.getByText('暂无媒体资源', { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: '媒体构图', exact: true }).selectOption('')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText(landscape.name)
    await cards.first().getByRole('button', { name: '查看引用', exact: true }).click()
    const references = page.getByRole('region', { name: '媒体引用', exact: true })
    await expect(references).toContainText('引用位置（2）')
    await references.getByRole('link', { name: title, exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/admin/posts/${postId}$`))
    await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue(title)
    await page.getByRole('checkbox', { name: '空闲 15 秒后自动保存服务器草稿', exact: true }).uncheck()
    await page.getByRole('button', { name: '从媒体库选择封面', exact: true }).click()
    const picker = page.getByRole('dialog', { name: '选择媒体图片', exact: true })
    await expect(picker).toBeVisible()
    await picker.getByRole('textbox', { name: '搜索媒体', exact: true }).fill(prefix)
    await picker.getByRole('button', { name: '搜索', exact: true }).click()
    await expect(picker.locator('.media-library__grid > li')).toHaveCount(3)
    await picker.getByRole('combobox', { name: '媒体使用状态', exact: true }).selectOption('unused')
    await expect(picker.locator('.media-library__grid > li')).toHaveCount(2)
    await picker.getByRole('combobox', { name: '媒体构图', exact: true }).selectOption('portrait')
    await expect(picker.locator('.media-library__grid > li')).toHaveCount(1)
    const portraitDescription = picker.getByRole('textbox', { name: `${portrait.name} 素材说明`, exact: true })
    await portraitDescription.fill('尚未提交的竖向构图说明')
    await expect(picker.getByRole('button', { name: '使用此图片', exact: true })).toBeDisabled()
    let closePrompt = false
    page.once('dialog', async (dialog) => {
      closePrompt = true
      await dialog.dismiss()
    })
    await picker.getByRole('button', { name: '关闭媒体选择器', exact: true }).click()
    expect(closePrompt).toBe(true)
    await expect(picker).toBeVisible()
    await expect(portraitDescription).toHaveValue('尚未提交的竖向构图说明')
    await picker.getByRole('button', { name: '取消素材说明修改', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await picker.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await captureMotion(page, testInfo, `media-organization-${width}.png`, { target: picker })
    await picker.getByRole('button', { name: '使用此图片', exact: true }).click()
    await expect(picker).not.toBeVisible()
    await expect(page.getByRole('textbox', { name: '封面地址', exact: true })).toHaveValue(portrait.url)
  })
}
