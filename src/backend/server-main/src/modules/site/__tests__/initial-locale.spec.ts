/**
 * @file initial-locale.spec.ts
 * @description 站点默认语言为 en 时本地化未编辑的初始资料（迁移语句与常量一致性；实际回放见 tests/initial-locale-integration.ts），
 *              默认页脚、每日一言与图库兜底名称按语言返回；缺省与无效值保持中文
 * @author TixXin
 * @since 2026-10-19
 */
import type { EntityManager } from '@mikro-orm/postgresql'
import { Migration20261019120000_localize_initial_site_settings } from '../../../migrations/20261019120000_localize_initial_site_settings'
import { siteDefaultLocale } from '../../../common/i18n'
import {
  INITIAL_PROFILE_REASON,
  initialSiteProfile,
  SAFE_INITIAL_SITE_VALUES,
  SAFE_INITIAL_SITE_VALUES_EN,
} from '../initial-profile'
import { defaultSiteExtras } from '../site-navigation'
import { GalleryController } from '../../gallery/gallery.controller'
import { GalleryService } from '../../gallery/gallery.service'

async function migrationQueries(locale: string | undefined) {
  const previous = process.env.SITE_DEFAULT_LOCALE
  if (locale === undefined) delete process.env.SITE_DEFAULT_LOCALE
  else process.env.SITE_DEFAULT_LOCALE = locale
  try {
    const migration = new Migration20261019120000_localize_initial_site_settings({} as never, {} as never)
    await migration.up()
    return migration.getQueries().map(String)
  } finally {
    if (previous === undefined) delete process.env.SITE_DEFAULT_LOCALE
    else process.env.SITE_DEFAULT_LOCALE = previous
  }
}

describe('站点默认语言', () => {
  it.each([
    [undefined, 'zh-CN'],
    ['', 'zh-CN'],
    ['en', 'en'],
    [' en ', 'en'],
    ['EN', 'zh-CN'],
    ['fr', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
  ])('SITE_DEFAULT_LOCALE=%j → %s', (value, expected) => {
    expect(siteDefaultLocale({ SITE_DEFAULT_LOCALE: value })).toBe(expected)
  })
})

describe('初始资料本地化迁移', () => {
  it('缺省、zh-CN 与无效值不产生任何语句', async () => {
    for (const locale of [undefined, '', 'zh-CN', 'fr', 'EN']) expect(await migrationQueries(locale)).toEqual([])
  })

  it('en 时只针对未编辑的中文初始资料逐字段改写，并与业务常量一致', async () => {
    const [sql, ...rest] = await migrationQueries('en')
    expect(rest).toEqual([])
    // 未编辑：修订 0、无后续修订、中文初始原因、当前值与修订 0 一致。
    expect(sql).toContain('s.revision=0')
    expect(sql).toContain(`r.reason='${INITIAL_PROFILE_REASON}'`)
    expect(sql).toContain('not exists(select 1 from site_settings_revision where revision<>0)')
    expect(sql).toContain(`(s."values"-'about')=(r."values"-'about')`)
    // 只改写与中文初始值逐字一致的字段。
    expect(sql).toContain(`s."values"->>'ownerName'='${SAFE_INITIAL_SITE_VALUES.ownerName}'`)
    expect(sql).toContain(`'{"ownerName":"${SAFE_INITIAL_SITE_VALUES_EN.ownerName}"}'`)
    expect(sql).toContain(`s."values"->>'avatarAlt'='${SAFE_INITIAL_SITE_VALUES.avatarAlt}'`)
    expect(sql).toContain(`'{"avatarAlt":"${SAFE_INITIAL_SITE_VALUES_EN.avatarAlt}"}'`)
    expect(sql).toContain(`reason='${initialSiteProfile('en').reason}'`)
  })

  it('英文初始资料只替换名称与头像说明，其余字段同中文版', () => {
    expect({ ...SAFE_INITIAL_SITE_VALUES_EN, ownerName: '博主', avatarAlt: '博主头像' }).toEqual(
      SAFE_INITIAL_SITE_VALUES,
    )
    expect(JSON.stringify(SAFE_INITIAL_SITE_VALUES_EN)).not.toMatch(/[\u4e00-\u9fff]/)
    expect(initialSiteProfile('zh-CN')).toEqual({ values: SAFE_INITIAL_SITE_VALUES, reason: INITIAL_PROFILE_REASON })
  })
})

describe('默认页脚与每日一言', () => {
  it('未保存的页脚与每日一言按站点默认语言给出，中文缺省不变', () => {
    expect(defaultSiteExtras().footerLinks.map((link) => link.label)).toEqual(['关于本站', 'RSS 订阅', '站点地图'])
    const english = defaultSiteExtras('en')
    expect(english.footerLinks.map((link) => [link.label, link.url])).toEqual([
      ['About', '/about'],
      ['RSS', '/rss.xml'],
      ['Sitemap', '/sitemap.xml'],
    ])
    expect(english.quotes).toHaveLength(5)
    expect(JSON.stringify(english)).not.toMatch(/[一-鿿]/)
    expect(english.navigation).toEqual(defaultSiteExtras('zh-CN').navigation)
  })
})

describe('图库分类兜底名称', () => {
  it('未分类按请求语言返回', async () => {
    const em = {
      execute: jest
        .fn()
        .mockResolvedValueOnce([
          { value: '', count: 2 },
          { value: '风景', count: 1 },
        ])
        .mockResolvedValueOnce([{ photos: 3, locations: 1, categories: 1 }]),
    }
    const service = new GalleryService(em as unknown as EntityManager)
    jest.spyOn(service, 'settings').mockResolvedValue({ gear: [] } as never)
    const english = await new GalleryController(service).metadata('en')
    expect(english.categories.map((item) => item.label)).toEqual(['Uncategorized', '风景'])
    em.execute.mockResolvedValueOnce([{ value: '', count: 2 }]).mockResolvedValueOnce([{}])
    expect((await service.metadata()).categories[0]!.label).toBe('未分类')
  })
})
