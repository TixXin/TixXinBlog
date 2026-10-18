/** @file site-navigation.spec.ts @description 站点导航、页脚链接、每日一言与备案字段的 DTO 白名单、语义校验和缺省补齐 */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { SaveSiteSettingsDto } from './site-settings.dto'
import {
  SITE_NAV_KEYS,
  defaultSiteExtras,
  normalizeSiteExtrasInput,
  SiteExtrasError,
  withSiteExtrasDefaults,
} from './site-navigation'

const profile = {
  revision: 0,
  name: '山间札记',
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
const dtoErrors = (patch: Record<string, unknown>) =>
  validateSync(plainToInstance(SaveSiteSettingsDto, { ...profile, ...patch }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  })

describe('站点导航与页脚 DTO', () => {
  it('旧客户端不带新字段仍然合法', () => {
    expect(dtoErrors({})).toHaveLength(0)
  })

  it('接受内置模块、外链、页脚、一言与备案', () => {
    expect(
      dtoErrors({
        navigation: [
          { type: 'route', key: 'home', visible: true },
          { type: 'external', label: '旧站', url: 'https://old.example.com', newTab: true, visible: true },
        ],
        footerLinks: [{ label: 'RSS', url: '/rss.xml', newTab: true }],
        quotes: ['一句'],
        icpNumber: '京ICP备00000000号',
        icpUrl: 'https://beian.miit.gov.cn/',
        copyright: '',
      }),
    ).toHaveLength(0)
  })

  it.each([
    ['未知导航字段', { navigation: [{ type: 'route', key: 'home', visible: true, icon: 'lucide:home' }] }],
    ['未知模块', { navigation: [{ type: 'route', key: 'admin', visible: true }] }],
    ['外链缺少新窗口标记', { navigation: [{ type: 'external', label: 'x', url: 'https://a.example', visible: true }] }],
    [
      '页脚链接过多',
      {
        footerLinks: Array.from({ length: 9 }, (_, index) => ({ label: `${index}`, url: `/p${index}`, newTab: false })),
      },
    ],
    ['一言过长', { quotes: ['长'.repeat(121)] }],
    ['一言过多', { quotes: Array.from({ length: 31 }, (_, index) => `第${index}句`) }],
    ['备案号过长', { icpNumber: '号'.repeat(41) }],
    ['版权文案过长', { copyright: '版'.repeat(201) }],
  ])('拒绝%s', (_name, patch) => {
    expect(dtoErrors(patch).length).toBeGreaterThan(0)
  })
})

describe('站点导航与页脚语义校验', () => {
  const reject = (input: Parameters<typeof normalizeSiteExtrasInput>[0], message: string) =>
    expect(() => normalizeSiteExtrasInput(input)).toThrow(new SiteExtrasError(message))

  it('未提供的字段保持未定义，交给保存逻辑沿用当前值', () => {
    expect(normalizeSiteExtrasInput({})).toEqual({})
  })

  it('保留顺序与显隐，缺失的内置模块按显示追加，外链去首尾空白', () => {
    const result = normalizeSiteExtrasInput({
      navigation: [
        { type: 'route', key: 'about', visible: true },
        { type: 'external', label: ' 旧站 ', url: ' https://old.example.com/ ', newTab: false, visible: true },
        { type: 'route', key: 'home', visible: true },
        { type: 'route', key: 'prompts', visible: false },
      ],
    })
    expect(result.navigation?.slice(0, 4)).toEqual([
      { type: 'route', key: 'about', visible: true },
      { type: 'external', label: '旧站', url: 'https://old.example.com/', newTab: false, visible: true },
      { type: 'route', key: 'home', visible: true },
      { type: 'route', key: 'prompts', visible: false },
    ])
    expect(result.navigation).toHaveLength(SITE_NAV_KEYS.length + 1)
    expect(
      result.navigation
        ?.filter((item) => item.type === 'route')
        .map((item) => item.key)
        .sort(),
    ).toEqual([...SITE_NAV_KEYS].sort())
  })

  it('首页不能隐藏，模块与外链地址不能重复', () => {
    reject({ navigation: [{ type: 'route', key: 'home', visible: false }] }, '首页导航不能隐藏')
    reject(
      {
        navigation: [
          { type: 'route', key: 'archive', visible: true },
          { type: 'route', key: 'archive', visible: false },
        ],
      },
      '导航模块重复',
    )
    const link = { type: 'external', label: 'a', url: 'https://a.example', newTab: true, visible: true }
    reject({ navigation: [link, { ...link, label: 'b' }] }, '外链导航地址重复')
  })

  it('外链最多四个且只允许 http(s)，不能带凭据', () => {
    const links = Array.from({ length: 5 }, (_, index) => ({
      type: 'external',
      label: `站${index}`,
      url: `https://site${index}.example`,
      newTab: true,
      visible: true,
    }))
    reject({ navigation: links }, '外链导航最多 4 个')
    for (const url of ['javascript:alert(1)', 'mailto:a@b.example', 'https://user:pass@a.example', '/archive'])
      reject(
        { navigation: [{ type: 'external', label: 'x', url, newTab: false, visible: true }] },
        '外链导航仅支持 http(s) 地址',
      )
  })

  it('页脚链接接受站内路径或 http(s)，拒绝协议相对、反斜杠和重复地址', () => {
    expect(
      normalizeSiteExtrasInput({
        footerLinks: [
          { label: '关于', url: '/about', newTab: false },
          { label: '源码', url: 'https://example.com/repo', newTab: true },
        ],
      }).footerLinks,
    ).toHaveLength(2)
    for (const url of ['//evil.example', '/\\evil', 'about', 'javascript:alert(1)', '/a b'])
      reject({ footerLinks: [{ label: 'x', url, newTab: false }] }, '页脚链接仅支持站内路径或 http(s) 地址')
    reject(
      {
        footerLinks: [
          { label: 'a', url: '/about', newTab: false },
          { label: 'b', url: '/about', newTab: true },
        ],
      },
      '页脚链接地址重复',
    )
  })

  it('一言去首尾空白后不能为空或重复', () => {
    expect(normalizeSiteExtrasInput({ quotes: [' 第一句 ', '第二句'] }).quotes).toEqual(['第一句', '第二句'])
    reject({ quotes: ['第一句', ' 第一句'] }, '每日一言不能重复')
    reject({ quotes: [''] }, '每日一言每条需为 1–120 个字符')
  })

  it('备案链接只接受 http(s)，备案与版权不能换行', () => {
    expect(normalizeSiteExtrasInput({ icpNumber: ' 京ICP备1号 ', icpUrl: '' })).toEqual({
      icpNumber: '京ICP备1号',
      icpUrl: '',
    })
    reject({ icpUrl: 'beian.miit.gov.cn' }, '备案链接仅支持 http(s) 地址')
    reject({ copyright: 'a\nb' }, '备案号、备案链接或版权文案格式不正确')
  })
})

describe('站点导航与页脚缺省补齐', () => {
  it('旧记录缺省等于此前写死的导航、页脚与一言', () => {
    const legacy: { name: string; quotes?: string[] } = { name: '旧站' }
    const values = withSiteExtrasDefaults(legacy)
    expect(values.name).toBe('旧站')
    expect(values.navigation.map((item) => (item.type === 'route' ? item.key : ''))).toEqual([...SITE_NAV_KEYS])
    expect(values.navigation.every((item) => item.visible)).toBe(true)
    expect(values.footerLinks.map((link) => link.url)).toEqual(['/about', '/rss.xml', '/sitemap.xml'])
    expect(values.quotes).toHaveLength(5)
    expect(values).toMatchObject({ icpNumber: '', icpUrl: '', copyright: '' })
  })

  it('缺省值不含博主身份信息，每次返回独立副本', () => {
    const first = defaultSiteExtras()
    first.quotes.push('改动')
    expect(defaultSiteExtras().quotes).toHaveLength(5)
    expect(JSON.stringify(defaultSiteExtras())).not.toMatch(/tixxin|tix\.xin|github\.com|mailto:/i)
  })

  it('剔除已移除的模块并追加新模块，保留已保存的空列表', () => {
    const values = withSiteExtrasDefaults({
      navigation: [
        { type: 'route', key: 'retired' as never, visible: true },
        { type: 'route', key: 'home', visible: true },
      ],
      footerLinks: [],
      quotes: [],
    })
    expect(values.navigation[0]).toEqual({ type: 'route', key: 'home', visible: true })
    expect(values.navigation).toHaveLength(SITE_NAV_KEYS.length)
    expect(values.footerLinks).toEqual([])
    expect(values.quotes).toEqual([])
  })
})
