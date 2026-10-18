/** @file site-settings.dto.spec.ts @description 站点保存、恢复与关于资料的字段边界及逐层白名单校验。 */
import { plainToInstance } from 'class-transformer'
import type { EntityManager } from '@mikro-orm/postgresql'
import { expectDtoInvalid, expectDtoValid } from '../../common/testing/dto-validation'
import { AboutItemDto, AboutSectionDto, AboutSettingsDto } from './about-settings'
import { ExpectedSiteRevisionDto, SaveSiteSettingsDto } from './site-settings.dto'
import { SiteSettingsService } from './site-settings.service'

const social = { label: '代码', href: 'https://github.com/tixxin', icon: 'lucide:github' }
const aboutItem = { title: '独立开发', detail: '记录实践', period: '2026', visible: true }
const aboutSection = { kind: 'experience', visible: true, items: [aboutItem] }
const about = { visible: true, introduction: '关于我', sections: [aboutSection] }
const site = {
  revision: 0,
  name: '记录与实践',
  description: '',
  ownerName: '博主',
  ownerTitle: '',
  avatar: '',
  avatarAlt: '',
  seoTitle: '',
  seoDescription: '',
  announcement: '',
  socials: [],
}

describe('站点写入 DTO', () => {
  it('接受旧客户端最小完整资料和包含关于页的新字段', () => {
    expectDtoValid(SaveSiteSettingsDto, site)
    expectDtoValid(SaveSiteSettingsDto, {
      ...site,
      about,
      socials: [social],
      presenceLabel: '在线',
      presenceSignature: '持续记录',
      presenceStatus: 'online',
      launchedAt: '2026-10-18',
    })
  })

  it.each([
    ['name', 80],
    ['description', 300],
    ['ownerName', 80],
    ['ownerTitle', 200],
    ['avatar', 1000],
    ['avatarAlt', 300],
    ['seoTitle', 160],
    ['seoDescription', 320],
    ['announcement', 1000],
    ['presenceLabel', 20],
    ['presenceSignature', 60],
  ] as const)('%s 接受长度上限并拒绝超长与非字符串', (field, maximum) => {
    expectDtoValid(SaveSiteSettingsDto, { ...site, [field]: '字'.repeat(maximum) })
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, [field]: '字'.repeat(maximum + 1) }, field, 'maxLength')
    for (const value of [42, false, [], {}, null]) {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, [field]: value }, field, 'isString')
    }
  })

  it.each(['name', 'ownerName'])('%s 去空白后至少保留一个字符', (field) => {
    expectDtoValid(SaveSiteSettingsDto, { ...site, [field]: '字' })
    for (const value of ['', ' \t\n ']) {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, [field]: value }, field, 'minLength')
    }
  })

  it.each([
    'name',
    'description',
    'ownerName',
    'ownerTitle',
    'avatar',
    'avatarAlt',
    'seoTitle',
    'seoDescription',
    'announcement',
  ])('完整保存缺少 %s 时拒绝', (field) => {
    const input: Record<string, unknown> = { ...site }
    delete input[field]
    expectDtoInvalid(SaveSiteSettingsDto, input, field, 'isString')
  })

  it('修剪站点、社交和新增文字字段，保留显式空文本', () => {
    const input = plainToInstance(SaveSiteSettingsDto, {
      ...site,
      name: '  博客  ',
      presenceLabel: '  在线  ',
      presenceSignature: '   ',
      socials: [{ ...social, label: '  代码  ', href: '  https://github.com/tixxin  ' }],
    })
    expect(input).toMatchObject({
      name: '博客',
      presenceLabel: '在线',
      presenceSignature: '',
      socials: [{ label: '代码', href: 'https://github.com/tixxin' }],
    })
    expectDtoValid(SaveSiteSettingsDto, input)
  })

  it.each(['', 'online', 'idle', 'busy'])('接受在线状态 %s', (presenceStatus) => {
    expectDtoValid(SaveSiteSettingsDto, { ...site, presenceStatus })
  })

  it.each(['offline', 'ONLINE', 1, true, null])('拒绝非法在线状态 %p', (presenceStatus) => {
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, presenceStatus }, 'presenceStatus', 'isIn')
  })

  it.each(['', '2026-10-18'])('接受上线日期格式 %s', (launchedAt) => {
    expectDtoValid(SaveSiteSettingsDto, { ...site, launchedAt })
  })

  it.each(['2026-1-01', '2026-10-18T00:00:00Z', '18/10/2026'])('拒绝不符合日期格式 %s', (launchedAt) => {
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, launchedAt }, 'launchedAt', 'matches')
  })

  it.each([1, true, [], {}, null])('上线日期拒绝非字符串 %p', (launchedAt) => {
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, launchedAt }, 'launchedAt', 'isString')
  })

  it('拒绝站点顶层、社交和关于资料各层的未知字段', () => {
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, updatedAt: '2026-10-18' }, 'updatedAt', 'whitelistValidation')
    expectDtoInvalid(
      SaveSiteSettingsDto,
      { ...site, socials: [{ ...social, id: 1 }] },
      'socials.0.id',
      'whitelistValidation',
    )
    expectDtoInvalid(SaveSiteSettingsDto, { ...site, about: { ...about, id: 1 } }, 'about.id', 'whitelistValidation')
    expectDtoInvalid(
      SaveSiteSettingsDto,
      { ...site, about: { ...about, sections: [{ ...aboutSection, id: 1 }] } },
      'about.sections.0.id',
      'whitelistValidation',
    )
    expectDtoInvalid(
      SaveSiteSettingsDto,
      { ...site, about: { ...about, sections: [{ ...aboutSection, items: [{ ...aboutItem, id: 1 }] }] } },
      'about.sections.0.items.0.id',
      'whitelistValidation',
    )
  })

  it('关于资料必须为对象，不能使用数组或 null', () => {
    for (const value of [[], [about], null, '资料', 1]) {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, about: value }, 'about', 'isObject')
    }
  })

  describe('恢复和保存版本', () => {
    it.each([0, 1, 2147483647])('接受非负整数版本 %i', (revision) => {
      expectDtoValid(ExpectedSiteRevisionDto, { revision })
      expectDtoValid(SaveSiteSettingsDto, { ...site, revision })
    })

    it('拒绝负数、缺失、非整数和隐式类型转换', () => {
      expectDtoInvalid(ExpectedSiteRevisionDto, { revision: -1 }, 'revision', 'min')
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, revision: -1 }, 'revision', 'min')
      for (const revision of [undefined, null, '0', true, 0.5, [], {}, Infinity, NaN]) {
        expectDtoInvalid(ExpectedSiteRevisionDto, { revision }, 'revision', 'isInt')
        expectDtoInvalid(SaveSiteSettingsDto, { ...site, revision }, 'revision', 'isInt')
      }
      expectDtoInvalid(ExpectedSiteRevisionDto, { revision: 0, force: true }, 'force', 'whitelistValidation')
    })
  })

  describe('社交资料', () => {
    it('社交链接接受空数组及最多八项', () => {
      expectDtoValid(SaveSiteSettingsDto, { ...site, socials: Array.from({ length: 8 }, () => ({ ...social })) })
      expectDtoInvalid(
        SaveSiteSettingsDto,
        { ...site, socials: Array.from({ length: 9 }, () => ({ ...social })) },
        'socials',
        'arrayMaxSize',
      )
    })

    it.each([undefined, null, '链接', {}, 1])('拒绝非数组社交资料 %p', (socials) => {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, socials }, 'socials', 'isArray')
    })

    it.each([[], null, '链接', 1])('社交条目必须为对象 %p', (value) => {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, socials: [value] }, 'socials', 'isObject')
    })

    it.each([
      ['label', 40],
      ['href', 1000],
    ] as const)('社交 %s 的长度和类型边界', (field, maximum) => {
      const input = (value: unknown) => ({ ...site, socials: [{ ...social, [field]: value }] })
      expectDtoValid(SaveSiteSettingsDto, input('字'))
      expectDtoValid(SaveSiteSettingsDto, input('字'.repeat(maximum)))
      expectDtoInvalid(SaveSiteSettingsDto, input('字'.repeat(maximum + 1)), `socials.0.${field}`, 'maxLength')
      for (const value of ['', '  '])
        expectDtoInvalid(SaveSiteSettingsDto, input(value), `socials.0.${field}`, 'minLength')
      for (const value of [undefined, null, 1, [], {}])
        expectDtoInvalid(SaveSiteSettingsDto, input(value), `socials.0.${field}`, 'isString')
    })

    it.each(['github', 'twitter', 'mail', 'globe', 'link', 'rss', 'youtube', 'linkedin'])(
      '允许已支持 Lucide 图标 %s',
      (icon) => {
        expectDtoValid(SaveSiteSettingsDto, { ...site, socials: [{ ...social, icon: `lucide:${icon}` }] })
      },
    )

    it.each(['lucide:unknown', 'mdi:github', '', 1, null, undefined])('拒绝未知或非字符串图标 %p', (icon) => {
      expectDtoInvalid(SaveSiteSettingsDto, { ...site, socials: [{ ...social, icon }] }, 'socials.0.icon', 'isIn')
    })
  })

  describe('现有 URL 协议边界', () => {
    it.each(['http://example.com/a.webp', 'https://example.com/a.webp', '/media/a.webp', ''])(
      'DTO 接受头像支持的地址形态 %s',
      (avatar) => {
        expectDtoValid(SaveSiteSettingsDto, { ...site, avatar })
      },
    )

    it.each(['http://example.com', 'https://example.com', 'mailto:author@example.com'])(
      'DTO 接受社交链接支持的协议 %s',
      (href) => {
        expectDtoValid(SaveSiteSettingsDto, { ...site, socials: [{ ...social, href }] })
      },
    )

    // URL 协议由保存入口先行验证；仅提供事务桩，确保非法输入在访问数据库之前拒绝。
    it.each([
      'javascript:alert(1)',
      'data:image/png;base64,a',
      'file:///tmp/a',
      'ftp://example.com/a',
      '//example.com/a',
    ])('保存入口拒绝头像和社交危险协议 %s', async (url) => {
      const transactional = jest.fn()
      const service = new SiteSettingsService({ transactional } as unknown as EntityManager)
      await expect(service.save({ ...site, avatar: url })).rejects.toThrow('头像需要 HTTP(S) 地址或站内图片路径')
      await expect(service.save({ ...site, socials: [{ ...social, href: url }] })).rejects.toThrow(
        '社交链接仅支持 HTTP(S) 或 mailto 邮箱',
      )
      expect(transactional).not.toHaveBeenCalled()
    })
  })
})

describe('关于页嵌套写入 DTO', () => {
  it('允许空介绍、空栏目和空条目文字', () => {
    expectDtoValid(AboutSettingsDto, { visible: false, introduction: '', sections: [] })
    expectDtoValid(AboutSectionDto, { kind: 'reading', visible: false, items: [] })
    expectDtoValid(AboutItemDto, { title: '', detail: '', period: '', visible: false })
  })

  it.each([
    ['title', 120],
    ['detail', 1000],
    ['period', 80],
  ] as const)('条目 %s 的文字长度和类型边界', (field, maximum) => {
    expectDtoValid(AboutItemDto, { ...aboutItem, [field]: '字'.repeat(maximum) })
    expectDtoInvalid(AboutItemDto, { ...aboutItem, [field]: '字'.repeat(maximum + 1) }, field, 'maxLength')
    for (const value of [undefined, null, 1, false, [], {}])
      expectDtoInvalid(AboutItemDto, { ...aboutItem, [field]: value }, field, 'isString')
  })

  it('关于介绍最多五千字，且必须为字符串', () => {
    expectDtoValid(AboutSettingsDto, { ...about, introduction: '字'.repeat(5000) })
    expectDtoInvalid(AboutSettingsDto, { ...about, introduction: '字'.repeat(5001) }, 'introduction', 'maxLength')
    for (const introduction of [undefined, null, 1, false, [], {}])
      expectDtoInvalid(AboutSettingsDto, { ...about, introduction }, 'introduction', 'isString')
  })

  it('每层 visible 都只接受布尔值并拒绝额外字段', () => {
    for (const visible of [undefined, null, 'true', 0, [], {}]) {
      expectDtoInvalid(AboutSettingsDto, { ...about, visible }, 'visible', 'isBoolean')
      expectDtoInvalid(AboutSectionDto, { ...aboutSection, visible }, 'visible', 'isBoolean')
      expectDtoInvalid(AboutItemDto, { ...aboutItem, visible }, 'visible', 'isBoolean')
    }
    expectDtoInvalid(AboutSettingsDto, { ...about, id: 1 }, 'id', 'whitelistValidation')
    expectDtoInvalid(AboutSectionDto, { ...aboutSection, id: 1 }, 'id', 'whitelistValidation')
    expectDtoInvalid(AboutItemDto, { ...aboutItem, id: 1 }, 'id', 'whitelistValidation')
  })

  it.each(['experience', 'skill', 'interest', 'reading'])('接受栏目枚举 %s', (kind) => {
    expectDtoValid(AboutSectionDto, { ...aboutSection, kind })
  })

  it.each(['other', 'SKILL', '', null, undefined, 1])('拒绝非法栏目 %p', (kind) => {
    expectDtoInvalid(AboutSectionDto, { ...aboutSection, kind }, 'kind', 'isIn')
  })

  it('最多四个栏目，每个栏目最多三十个条目', () => {
    expectDtoValid(AboutSettingsDto, { ...about, sections: Array.from({ length: 4 }, () => ({ ...aboutSection })) })
    expectDtoInvalid(
      AboutSettingsDto,
      { ...about, sections: Array.from({ length: 5 }, () => ({ ...aboutSection })) },
      'sections',
      'arrayMaxSize',
    )
    expectDtoValid(AboutSectionDto, { ...aboutSection, items: Array.from({ length: 30 }, () => ({ ...aboutItem })) })
    expectDtoInvalid(
      AboutSectionDto,
      { ...aboutSection, items: Array.from({ length: 31 }, () => ({ ...aboutItem })) },
      'items',
      'arrayMaxSize',
    )
  })

  it.each([undefined, null, {}, 1, '栏目'])('栏目与条目必须为数组 %p', (value) => {
    expectDtoInvalid(AboutSettingsDto, { ...about, sections: value }, 'sections', 'isArray')
    expectDtoInvalid(AboutSectionDto, { ...aboutSection, items: value }, 'items', 'isArray')
  })

  it.each([[], null, 1, '条目'])('栏目与条目的数组元素必须为对象 %p', (value) => {
    expectDtoInvalid(AboutSettingsDto, { ...about, sections: [value] }, 'sections', 'isObject')
    expectDtoInvalid(AboutSectionDto, { ...aboutSection, items: [value] }, 'items', 'isObject')
  })
})
