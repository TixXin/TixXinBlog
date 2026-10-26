/** @file siteConflictLabels.test.ts @description 站点设置冲突字段显示名：字段、关于页路径、栏目名插值、未知路径回落与分隔符 */
import { describe, expect, it } from 'vitest'
import { SITE_EDITOR_I18N, siteConflictLabels } from '../../app/features/site/editorLabels'

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}(${JSON.stringify(params)})` : key)
const F = `${SITE_EDITOR_I18N}.fields`

describe('站点设置冲突字段显示名', () => {
  it('按字段路径取文案，并用分隔符连接', () => {
    expect(siteConflictLabels(['name', 'searchIndexing', 'copyright'], t)).toBe(
      [`${F}.name`, `${F}.searchIndexing`, `${F}.copyright`].join(`${F}.separator`),
    )
  })

  it('关于页的可见性、简介、顺序与栏目各有名称', () => {
    expect(siteConflictLabels(['about.visible'], t)).toBe(`${F}.aboutVisible`)
    expect(siteConflictLabels(['about.introduction'], t)).toBe(`${F}.aboutIntroduction`)
    expect(siteConflictLabels(['about.sections.order'], t)).toBe(`${F}.aboutOrder`)
    expect(siteConflictLabels(['about.reading'], t)).toBe(
      `${F}.aboutSection(${JSON.stringify({ section: 'misc.about.section.reading' })})`,
    )
  })

  it('未知路径回落通用名称，空列表返回空串', () => {
    expect(siteConflictLabels(['about.unknown', 'unknown'], t)).toBe(`${F}.fallback${F}.separator${F}.fallback`)
    expect(siteConflictLabels([], t)).toBe('')
  })
})
