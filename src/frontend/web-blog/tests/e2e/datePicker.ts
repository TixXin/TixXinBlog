/**
 * @file datePicker.ts
 * @description 端到端用例的日期选择辅助：通过 CommonDatePicker 面板逐级选择年份、月份与日期，
 *              与用户真实操作一致，替代对原生日期输入框的 fill
 * @author TixXin
 * @since 2026-10-20
 */
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** 打开触发按钮对应的面板，选中 YYYY-MM-DD；面板关闭后触发按钮显示所选日期 */
export async function pickDate(page: Page, trigger: Locator, iso: string) {
  const [year, month] = iso.split('-').map(Number) as [number, number]
  await trigger.click()
  const panel = page.locator('.date-picker-panel')
  await expect(panel).toBeVisible()
  const title = panel.locator('.date-picker__title')
  // 日 → 月 → 年视图
  await title.click()
  await title.click()
  for (let step = 0; step < 50; step += 1) {
    const [start, end] = ((await title.textContent()) ?? '').split('–').map((part) => Number(part.trim()))
    if (year >= start! && year <= end!) break
    await panel
      .locator('.date-picker__nav')
      .nth(year < start! ? 0 : 1)
      .click()
  }
  await panel.locator('.date-picker__cell', { hasText: new RegExp(`^${year}$`) }).click()
  await panel
    .locator('.date-picker__cell')
    .nth(month - 1)
    .click()
  await panel.locator(`[data-iso="${iso}"]`).click()
  await expect(panel).toHaveCount(0)
}
