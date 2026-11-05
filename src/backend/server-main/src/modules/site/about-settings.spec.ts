/** @file about-settings.spec.ts @description 关于页公开边界及嵌套输入验证 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { AboutSettingsDto, aboutUsesV17Fields, emptyAbout, publicAbout, siteImageValues } from './about-settings'

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

describe('关于页 v17 字段', () => {
  const support = {
    visible: true,
    message: '请我喝杯咖啡',
    methods: [
      { label: '微信', url: '', image: '/api/v1/media/a1111111-1111-4111-8111-111111111111.webp' },
      { label: '空方式', url: '', image: '' },
      { label: '', url: 'https://ko-fi.com/x', image: '' },
    ],
  }
  const value: AboutSettingsDto = {
    visible: true,
    introduction: '**你好**',
    en: { introduction: 'Hello' },
    showSiteInfo: true,
    support,
    sections: [
      {
        kind: 'now',
        visible: true,
        updatedAt: '2026-11-01',
        items: [
          {
            title: '整理博客',
            detail: '',
            period: '',
            visible: true,
            url: 'https://example.org/now',
            en: { title: 'Tidying up the blog', detail: '', period: '' },
          },
        ],
      },
      { kind: 'uses', visible: true, items: [{ title: 'MacBook Air', detail: '', period: '', visible: true }] },
    ],
  }
  it('公开读取保留英文资料、开关与可用的支持方式', () => {
    const result = publicAbout(value)
    expect(result.en).toEqual({ introduction: 'Hello' })
    expect(result.showSiteInfo).toBe(true)
    expect(result.support?.methods.map((method) => method.label)).toEqual(['微信'])
    expect(result.sections.map((section) => section.kind)).toEqual(['now', 'uses'])
  })
  it('关于页未公开时支持方式仍可公开，关闭或没有可用方式时省略', () => {
    expect(publicAbout({ ...value, visible: false })).toEqual({
      ...emptyAbout(),
      support: { ...support, methods: [support.methods[0]] },
    })
    expect(publicAbout({ ...value, support: { ...support, visible: false } }).support).toBeUndefined()
    expect(publicAbout({ ...value, support: { ...support, methods: [support.methods[1]!] } }).support).toBeUndefined()
  })
  it('校验链接、日期与收款图地址', () => {
    expect(validateSync(plainToInstance(AboutSettingsDto, value))).toHaveLength(0)
    const item = value.sections[0]!.items[0]!
    for (const bad of [
      { ...value, sections: [{ ...value.sections[0]!, items: [{ ...item, url: 'javascript:alert(1)' }] }] },
      { ...value, sections: [{ ...value.sections[0]!, items: [{ ...item, url: 'https://u:p@example.org/' }] }] },
      { ...value, sections: [{ ...value.sections[0]!, updatedAt: '2026/11/01' }] },
      { ...value, support: { ...support, methods: [{ label: 'x', url: '', image: '//evil.example/a.png' }] } },
      { ...value, support: { ...support, methods: [{ label: 'x', url: '', image: 'http://example.org/a.png' }] } },
      { ...value, support: { ...support, methods: Array(7).fill(support.methods[0]) } },
    ])
      expect(validateSync(plainToInstance(AboutSettingsDto, bad)).length).toBeGreaterThan(0)
  })
  it('收款图与头像一起登记为站点媒体引用', () => {
    expect(siteImageValues({ avatar: '/avatar.svg', about: value })).toEqual([
      '/avatar.svg',
      '/api/v1/media/a1111111-1111-4111-8111-111111111111.webp',
      '',
      '',
    ])
    expect(siteImageValues({ avatar: '/a.png' })).toEqual(['/a.png'])
  })
  it('识别 v17 才有的字段', () => {
    expect(aboutUsesV17Fields(value)).toBe(true)
    expect(aboutUsesV17Fields(emptyAbout())).toBe(false)
    expect(
      aboutUsesV17Fields({ visible: true, introduction: '', sections: [{ kind: 'uses', visible: true, items: [] }] }),
    ).toBe(true)
    expect(aboutUsesV17Fields(null)).toBe(false)
  })
})
