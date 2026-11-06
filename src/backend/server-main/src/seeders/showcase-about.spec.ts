/** @file showcase-about.spec.ts @description showcase 关于页样本必须通过真实的资料校验，并覆盖全部栏目与 v17 字段 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ABOUT_SECTION_KINDS, AboutSettingsDto, publicAbout } from '../modules/site/about-settings'
import { SHOWCASE_ABOUT, sameAbout } from './showcase-about'

describe('showcase 关于页样本', () => {
  it('通过资料校验，栏目不重复且覆盖全部类型', () => {
    expect(
      validateSync(plainToInstance(AboutSettingsDto, SHOWCASE_ABOUT), { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([])
    const kinds = SHOWCASE_ABOUT.sections.map((section) => section.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
    expect([...kinds].sort()).toEqual([...ABOUT_SECTION_KINDS].sort())
  })
  it('公开读取保留链接、英文资料、本站信息与支持方式', () => {
    const value = publicAbout(SHOWCASE_ABOUT)
    expect(value.en?.introduction).toBeTruthy()
    expect(value.showSiteInfo).toBe(true)
    expect(value.support?.methods).toHaveLength(1)
    expect(value.sections.find((section) => section.kind === 'now')?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(value.sections.flatMap((section) => section.items).some((item) => item.url && item.en)).toBe(true)
  })
  it('比较忽略对象键顺序，内容不同则不相等', () => {
    // 模拟 jsonb 读回后键顺序变化
    const roundTrip = Object.fromEntries(Object.entries(structuredClone(SHOWCASE_ABOUT)).reverse())
    expect(sameAbout(roundTrip, SHOWCASE_ABOUT)).toBe(true)
    expect(sameAbout({ ...SHOWCASE_ABOUT, showSiteInfo: false }, SHOWCASE_ABOUT)).toBe(false)
  })
})
