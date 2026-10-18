/**
 * @file site-navigation.ts
 * @description 站点导航、页脚链接、每日一言、备案号与版权文案：缺省值、DTO 与语义校验。
 * 这些字段是站点资料 JSON 的后加键，旧记录与旧内容包可能缺失；读取时按缺省值补齐，
 * 缺省值等于此前前端写死的效果，升级后站点外观不变。
 */
import { IsBoolean, IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'

/** 内置路由模块清单；导航只控制展示与顺序，路由本身始终可访问 */
export const SITE_NAV_KEYS = [
  'home',
  'archive',
  'projects',
  'gallery',
  'flash',
  'links',
  'guestbook',
  'subscriptions',
  'about',
  'prompts',
  'tabs',
] as const
export type SiteNavKey = (typeof SITE_NAV_KEYS)[number]

export interface SiteNavRouteItem {
  type: 'route'
  key: SiteNavKey
  visible: boolean
}
export interface SiteNavExternalItem {
  type: 'external'
  label: string
  url: string
  newTab: boolean
  visible: boolean
}
export type SiteNavItem = SiteNavRouteItem | SiteNavExternalItem
export interface SiteFooterLink {
  label: string
  url: string
  newTab: boolean
}
export interface SiteExtrasValues {
  navigation: SiteNavItem[]
  footerLinks: SiteFooterLink[]
  quotes: string[]
  icpNumber: string
  icpUrl: string
  copyright: string
}

export const SITE_LIMITS = {
  externalNav: 4,
  navLabel: 20,
  footerLinks: 8,
  footerLabel: 30,
  url: 1000,
  quotes: 30,
  quote: 120,
  icpNumber: 40,
  icpUrl: 300,
  copyright: 200,
} as const

/** 缺省值与此前前端 mock 的效果一致；每日一言是公共领域的古语，不含博主身份 */
export function defaultSiteExtras(): SiteExtrasValues {
  return {
    navigation: SITE_NAV_KEYS.map((key) => ({ type: 'route', key, visible: true })),
    footerLinks: [
      { label: '关于本站', url: '/about', newTab: false },
      { label: 'RSS 订阅', url: '/rss.xml', newTab: true },
      { label: '站点地图', url: '/sitemap.xml', newTab: true },
    ],
    quotes: [
      '路漫漫其修远兮，吾将上下而求索。',
      '保持热爱，奔赴山海。',
      '种一棵树最好的时间是十年前，其次是现在。',
      '心之所向，素履以往。',
      '不积跬步，无以至千里。',
    ],
    icpNumber: '',
    icpUrl: '',
    copyright: '',
  }
}

const isRoute = (item: { type?: unknown }) => item.type === 'route'
const isExternal = (item: { type?: unknown }) => item.type === 'external'

export class SiteNavItemDto {
  @IsIn(['route', 'external']) type!: 'route' | 'external'
  @ValidateIf(isRoute) @IsIn(SITE_NAV_KEYS) key?: SiteNavKey
  @ValidateIf(isExternal)
  @IsString()
  @MinLength(1)
  @MaxLength(SITE_LIMITS.navLabel)
  label?: string
  @ValidateIf(isExternal) @IsString() @MinLength(1) @MaxLength(SITE_LIMITS.url) url?: string
  @ValidateIf(isExternal) @IsBoolean() newTab?: boolean
  @IsBoolean() visible!: boolean
}
export class SiteFooterLinkDto {
  @IsString() @MinLength(1) @MaxLength(SITE_LIMITS.footerLabel) label!: string
  @IsString() @MinLength(1) @MaxLength(SITE_LIMITS.url) url!: string
  @IsBoolean() newTab!: boolean
}
/** 外链只接受不带凭据的 http(s) 地址 */
export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !/[\s\\]/.test(value)
  } catch {
    return false
  }
}
/** 站内路径：以单个斜杠开头，不含空白、反斜杠或协议相对写法 */
export function isSitePath(value: string) {
  return /^\/(?!\/)[^\s\\]*$/.test(value)
}

export class SiteExtrasError extends Error {}

/**
 * 校验并规范化调用方提供的新字段；未提供的字段保持 undefined，由调用方决定沿用当前值。
 * 只保留每种条目允许的键，内置模块缺失时按显示追加到末尾，首页不能隐藏。
 */
export function normalizeSiteExtrasInput(input: Partial<Record<keyof SiteExtrasValues, unknown>>) {
  const fail = (message: string): never => {
    throw new SiteExtrasError(message)
  }
  const result: Partial<SiteExtrasValues> = {}
  if (input.navigation !== undefined) {
    if (!Array.isArray(input.navigation)) fail('导航配置格式不正确')
    const items = input.navigation as Record<string, unknown>[]
    const keys = new Set<string>()
    const urls = new Set<string>()
    const navigation: SiteNavItem[] = []
    for (const item of items) {
      if (!item || typeof item !== 'object') fail('导航配置格式不正确')
      if (typeof item.visible !== 'boolean') fail('导航显隐需为布尔值')
      if (item.type === 'route') {
        if (['label', 'url', 'newTab'].some((key) => item[key] !== undefined)) fail('内置导航项不能自定义名称或地址')
        const key = String(item.key)
        if (!(SITE_NAV_KEYS as readonly string[]).includes(key)) fail('导航包含未知模块')
        if (keys.has(key)) fail('导航模块重复')
        keys.add(key)
        if (key === 'home' && !item.visible) fail('首页导航不能隐藏')
        navigation.push({ type: 'route', key: key as SiteNavKey, visible: item.visible as boolean })
      } else if (item.type === 'external') {
        if (item.key !== undefined) fail('外链导航项不能指定模块')
        const label = typeof item.label === 'string' ? item.label.trim() : ''
        const url = typeof item.url === 'string' ? item.url.trim() : ''
        if (!label || label.length > SITE_LIMITS.navLabel) fail(`外链导航名称需为 1–${SITE_LIMITS.navLabel} 个字符`)
        if (url.length > SITE_LIMITS.url || !isHttpUrl(url)) fail('外链导航仅支持 http(s) 地址')
        if (typeof item.newTab !== 'boolean') fail('外链导航需说明是否新窗口打开')
        if (urls.has(url)) fail('外链导航地址重复')
        urls.add(url)
        navigation.push({
          type: 'external',
          label,
          url,
          newTab: item.newTab as boolean,
          visible: item.visible as boolean,
        })
      } else fail('导航条目类型不正确')
    }
    if (urls.size > SITE_LIMITS.externalNav) fail(`外链导航最多 ${SITE_LIMITS.externalNav} 个`)
    for (const key of SITE_NAV_KEYS) if (!keys.has(key)) navigation.push({ type: 'route', key, visible: true })
    result.navigation = navigation
  }
  if (input.footerLinks !== undefined) {
    if (!Array.isArray(input.footerLinks)) fail('页脚链接格式不正确')
    const links = input.footerLinks as Record<string, unknown>[]
    if (links.length > SITE_LIMITS.footerLinks) fail(`页脚链接最多 ${SITE_LIMITS.footerLinks} 个`)
    const seen = new Set<string>()
    result.footerLinks = links.map((link) => {
      if (!link || typeof link !== 'object') return fail('页脚链接格式不正确')
      const label = typeof link.label === 'string' ? link.label.trim() : ''
      const url = typeof link.url === 'string' ? link.url.trim() : ''
      if (!label || label.length > SITE_LIMITS.footerLabel) fail(`页脚链接名称需为 1–${SITE_LIMITS.footerLabel} 个字符`)
      if (url.length > SITE_LIMITS.url || (!isSitePath(url) && !isHttpUrl(url)))
        fail('页脚链接仅支持站内路径或 http(s) 地址')
      if (typeof link.newTab !== 'boolean') fail('页脚链接需说明是否新窗口打开')
      if (seen.has(url)) fail('页脚链接地址重复')
      seen.add(url)
      return { label, url, newTab: link.newTab as boolean }
    })
  }
  if (input.quotes !== undefined) {
    if (!Array.isArray(input.quotes)) fail('每日一言格式不正确')
    const quotes = (input.quotes as unknown[]).map((quote) => (typeof quote === 'string' ? quote.trim() : ''))
    if (quotes.length > SITE_LIMITS.quotes) fail(`每日一言最多 ${SITE_LIMITS.quotes} 条`)
    if (quotes.some((quote) => !quote || quote.length > SITE_LIMITS.quote))
      fail(`每日一言每条需为 1–${SITE_LIMITS.quote} 个字符`)
    if (new Set(quotes).size !== quotes.length) fail('每日一言不能重复')
    result.quotes = quotes
  }
  for (const [key, max] of [
    ['icpNumber', SITE_LIMITS.icpNumber],
    ['icpUrl', SITE_LIMITS.icpUrl],
    ['copyright', SITE_LIMITS.copyright],
  ] as const) {
    const value = input[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.trim().length > max || /[\r\n]/.test(value))
      fail('备案号、备案链接或版权文案格式不正确')
    result[key] = (value as string).trim()
  }
  if (result.icpUrl && !isHttpUrl(result.icpUrl)) fail('备案链接仅支持 http(s) 地址')
  return result
}

/** 读取时补齐缺失字段；历史上已经校验过的值原样保留，未知模块剔除、缺失模块追加 */
export function withSiteExtrasDefaults<T extends Partial<SiteExtrasValues>>(values: T): T & SiteExtrasValues {
  const defaults = defaultSiteExtras()
  const navigation = Array.isArray(values.navigation)
    ? values.navigation.filter(
        (item) => item.type !== 'route' || (SITE_NAV_KEYS as readonly string[]).includes(item.key),
      )
    : defaults.navigation
  for (const key of SITE_NAV_KEYS)
    if (!navigation.some((item) => item.type === 'route' && item.key === key))
      navigation.push({ type: 'route', key, visible: true })
  return {
    ...values,
    navigation,
    footerLinks: values.footerLinks ?? defaults.footerLinks,
    quotes: values.quotes ?? defaults.quotes,
    icpNumber: values.icpNumber ?? '',
    icpUrl: values.icpUrl ?? '',
    copyright: values.copyright ?? '',
  }
}
