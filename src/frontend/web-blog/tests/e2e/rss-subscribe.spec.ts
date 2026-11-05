/**
 * @file rss-subscribe.spec.ts
 * @description RSS 订阅弹窗验收：首页订阅卡与页脚订阅链接打开弹窗、切换订阅源与复制地址、
 *              修饰键点击与弹窗内源文件链接保持原生新标签页行为，闪念与朋友圈页头不再放订阅按钮
 * @author TixXin
 * @since 2026-11-05
 */
import { expect, test } from '@playwright/test'

test('首页订阅卡打开订阅弹窗，可切换订阅源并复制完整地址', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const button = page.locator('.subscribe-card__button').filter({ visible: true })
  await expect(button).toHaveCount(1)
  await expect(button).toHaveAttribute('href', '/rss.xml')
  await button.click()

  const dialog = page.getByRole('dialog', { name: '订阅更新' })
  await expect(dialog).toBeVisible()
  await expect(page).not.toHaveURL(/\.xml$/)
  const url = dialog.getByLabel('订阅地址')
  await expect(url).toHaveValue(/^https?:\/\/[^/]+\/rss\.xml$/)
  await expect(dialog.getByRole('button', { name: '文章', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('link', { name: 'Atom' })).toHaveAttribute('href', '/atom.xml')

  await dialog.getByRole('button', { name: '朋友圈', exact: true }).click()
  await expect(url).toHaveValue(/\/moments\.xml$/)
  await expect(dialog.getByRole('link', { name: 'Atom' })).toHaveCount(0)
  const feedUrl = await url.inputValue()
  await expect(dialog.getByRole('link', { name: 'Inoreader' })).toHaveAttribute(
    'href',
    `https://www.inoreader.com/?add_feed=${encodeURIComponent(feedUrl)}`,
  )

  await dialog.getByRole('button', { name: '复制链接' }).click()
  await expect(dialog.getByRole('button', { name: '已复制' })).toBeVisible()
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(feedUrl)

  // 弹窗内的源文件链接保持原生链接，在新标签页打开 XML
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    dialog.getByRole('link', { name: '在新标签页查看源文件' }).click(),
  ])
  await expect(popup).toHaveURL(/\/moments\.xml$/)
  await popup.close()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('修饰键点击订阅按钮走原生链接，不打开弹窗', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const [tab] = await Promise.all([
    context.waitForEvent('page'),
    page
      .locator('.subscribe-card__button')
      .filter({ visible: true })
      .click({ modifiers: ['ControlOrMeta'] }),
  ])
  await expect(tab).toHaveURL(/\/rss\.xml$/)
  await tab.close()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('页脚指向本站订阅文件的链接同样打开弹窗', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const footerFeed = page.locator('a[href="/rss.xml"]:not(.subscribe-card__button)').filter({ visible: true }).first()
  await expect(footerFeed).toBeVisible()
  await footerFeed.click()
  await expect(page.getByRole('dialog', { name: '订阅更新' })).toBeVisible()
  await expect(page).not.toHaveURL(/\.xml$/)
})

test('闪念与朋友圈页头不再放 RSS 订阅按钮', async ({ page }) => {
  for (const path of ['/flash', '/moments']) {
    await page.goto(path)
    await expect(page.locator('.page-actions').first()).toBeVisible()
    await expect(page.locator('.page-actions a[href$=".xml"]')).toHaveCount(0)
  }
})
