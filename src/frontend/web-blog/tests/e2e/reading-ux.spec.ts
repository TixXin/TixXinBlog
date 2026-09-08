/**
 * @file reading-ux.spec.ts
 * @description 隔离长文章的完整标题、目录偏移、进度、横向内容与分享锚点验收
 * @author TixXin
 * @since 2026-09-07
 */
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function chooseTheme(page: Page, name: string) {
  await page.getByRole('button', { name: '界面设置', exact: true }).click()
  await page.getByRole('button', { name: `${name} 布局主题`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: '界面设置', exact: true })).toHaveCount(0)
}
async function openContents(page: Page) {
  const button = page.getByRole('button', { name: '文章目录', exact: true })
  if (await button.isVisible()) {
    await button.click()
    return page.getByRole('dialog', { name: '文章目录', exact: true })
  }
  return page.locator('.aside-right, .aurora-aside').filter({ visible: true })
}

test('长标题与正文在三主题和手机可读，目录不遮挡且文末进度完成', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(process.env.E2E_USERNAME!)
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole('link', { name: '新建文章', exact: true }).click()
  const title =
    'UI阅读验收：这是一篇验证三种布局及手机完整标题的长文章，包含中文、英文与连续标识符 LongUnbrokenIdentifierForResponsiveReading2026'
  const sections = ['第一节：结构检查', '第二节：长段落阅读', '第三节：到达文末']
  const content = sections
    .flatMap((heading, index) => [
      `## ${heading}`,
      '',
      ...Array.from(
        { length: 18 },
        (_, paragraph) =>
          `段落${index + 1}-${paragraph + 1}。这是一段用于真实浏览器排版验收的中文正文，检查行高、换行和阅读宽度。它不包含真实用户资料，也不代表正式发布内容。\n`,
      ),
      ...(index === 1
        ? [
            '### 表格与代码',
            '',
            '| 字段 | 值 |',
            '| --- | --- |',
            '| 标识符 | LongIdentifier' + 'x'.repeat(100) + ' |',
            '',
            '```text',
            'LongCodeIdentifier' + 'x'.repeat(180),
            '```',
            '',
          ]
        : []),
    ])
    .join('\n')
  await page.getByRole('textbox', { name: '标题', exact: true }).fill(title)
  await page
    .getByRole('textbox', { name: '摘要', exact: true })
    .fill('完整摘要应按照自然行高显示，用于验证多行标题与元信息同时存在时不会将摘要挤成半行。'.repeat(2))
  await page.getByLabel('专栏', { exact: true }).fill('示例专栏')
  await page.getByRole('textbox', { name: '标签（逗号分隔）', exact: true }).fill('示例标签')
  await page.getByRole('textbox', { name: 'Markdown 正文', exact: true }).fill(content)
  await page.getByRole('textbox', { name: '封面地址', exact: true }).fill('/avatar-photo.webp')
  await page.getByRole('textbox', { name: '封面替代文本', exact: true }).fill('隔离排版验收使用的站点头像')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/\d+$/)
  const id = page.url().split('/').pop()!
  await page.getByRole('button', { name: '发布文章', exact: true }).click()
  await page
    .getByRole('dialog', { name: '发布前检查', exact: true })
    .getByRole('button', { name: '确认公开发布', exact: true })
    .click()
  await expect(page.getByText('当前状态：已发布')).toBeVisible()
  try {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/')
      const card = page.locator('.post-item').filter({ hasText: title })
      await expect(card).toBeVisible()
      const metrics = await card.locator('.post-item__summary').evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        line: Number.parseFloat(getComputedStyle(element).lineHeight),
      }))
      expect(metrics.height).toBeGreaterThanOrEqual(metrics.line - 1)
      expect(Math.abs(metrics.height / metrics.line - Math.round(metrics.height / metrics.line))).toBeLessThan(0.05)
      await card.screenshot({ animations: 'disabled', path: testInfo.outputPath(`long-card-cover-${width}.png`) })
    }
    for (const [layout, name, width] of [
      ['nexus', 'Nexus 三栏', 1440],
      ['aurora', 'Aurora 双栏', 1440],
      ['dock', 'Dock 浮岛', 1440],
      ['nexus', 'Nexus 三栏', 320],
    ] as const) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(`/articles/${id}`)
      await chooseTheme(page, name)
      await page.setViewportSize({ width, height: 1000 })
      const heading = page.getByRole('heading', { name: title, exact: true })
      await expect(heading).toBeVisible()
      const titleMetrics = await heading.evaluate((element) => ({
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        whiteSpace: getComputedStyle(element).whiteSpace,
      }))
      expect(titleMetrics.scrollHeight).toBeLessThanOrEqual(titleMetrics.height + 1)
      expect(titleMetrics.whiteSpace).not.toBe('nowrap')
      const contents = await openContents(page)
      const secondLink = contents.getByRole('link', { name: '第二节：长段落阅读', exact: true })
      const hash = (await secondLink.getAttribute('href'))!
      await secondLink.click()
      const second = page.getByRole('heading', { name: '第二节：长段落阅读', exact: true })
      await expect(second).toBeVisible()
      await expect
        .poll(async () =>
          second.evaluate((element) => {
            const header = document.querySelector('.article-sticky-header')!
            const headerBottom =
              getComputedStyle(header).position === 'sticky' ? Math.max(0, header.getBoundingClientRect().bottom) : 0
            return element.getBoundingClientRect().top - headerBottom
          }),
        )
        .toBeGreaterThanOrEqual(-1)
      const activeContents = await openContents(page)
      await expect(activeContents.getByRole('link', { name: '第二节：长段落阅读', exact: true })).toHaveAttribute(
        'aria-current',
        'location',
      )
      if (await page.getByRole('dialog', { name: '文章目录', exact: true }).isVisible())
        await page.getByRole('button', { name: '关闭文章目录', exact: true }).click()
      await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${layout}-${width}-reading.png`) })
      await page.goto(`/articles/${id}${hash}`)
      await expect(second).toBeVisible()
      await page.locator('.article-reading-content').locator('p').last().scrollIntoViewIfNeeded()
      const atEnd = await openContents(page)
      await expect(atEnd.getByText('100%', { exact: true })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
      expect(overflow).toBe(false)
      if (await page.getByRole('dialog', { name: '文章目录', exact: true }).isVisible())
        await page.getByRole('button', { name: '关闭文章目录', exact: true }).click()
    }
  } finally {
    // 只撤回本测试创建的文章，避免影响其他以106篇公开样本为基线的测试。
    await page.goto(`/admin/posts/${id}`)
    await page.getByRole('button', { name: '撤回为草稿', exact: true }).click()
    await expect(page.getByText('当前状态：草稿')).toBeVisible()
  }
})
