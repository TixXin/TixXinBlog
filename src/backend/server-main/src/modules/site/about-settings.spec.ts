/** @file about-settings.spec.ts @description 关于页公开边界及嵌套输入验证 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AboutSettingsDto, emptyAbout, publicAbout } from './about-settings'

describe('关于页公开边界', () => {
  const value: AboutSettingsDto = {
    visible: true,
    introduction: '记录技术实践',
    sections: [
      {
        kind: 'skill',
        visible: true,
        items: [
          { title: 'Vue', detail: '', period: '', visible: true },
          { title: '未确认', detail: '私密说明', period: '', visible: false },
        ],
      },
      { kind: 'reading', visible: false, items: [{ title: '尚未公开', detail: '', period: '', visible: true }] },
    ],
  }
  it('剔除隐藏栏目及条目，保留顺序且不改变后台输入', () => {
    expect(publicAbout(value).sections).toEqual([
      { kind: 'skill', visible: true, items: [value.sections[0]!.items[0]] },
    ])
    expect(value.sections[0]!.items).toHaveLength(2)
    expect(publicAbout({ ...value, visible: false })).toEqual(emptyAbout())
    expect(publicAbout(undefined)).toEqual(emptyAbout())
  })
  it('拒绝超长、非法栏目、嵌套空对象及多余字段', () => {
    expect(validateSync(plainToInstance(AboutSettingsDto, value))).toHaveLength(0)
    for (const bad of [
      { ...value, introduction: '字'.repeat(5001) },
      { ...value, sections: [null] },
      { ...value, sections: [{ kind: 'unknown', visible: true, items: [] }] },
      { ...value, secret: true },
    ])
      expect(
        validateSync(plainToInstance(AboutSettingsDto, bad), { whitelist: true, forbidNonWhitelisted: true }).length,
      ).toBeGreaterThan(0)
  })
})
