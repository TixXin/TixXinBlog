/**
 * @file site-navigation.ts
 * @description 站点导航、页脚链接、每日一言、备案号与版权文案：缺省值、DTO 与语义校验。
 * 这些字段是站点资料 JSON 的后加键，旧记录与旧内容包可能缺失；读取时按缺省值补齐，
 * 缺省值等于此前前端写死的效果，升级后站点外观不变。
 */
import { IsBoolean, IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'
import { msg, siteDefaultLocale, type ApiLocale, type LocalizedMessage } from '../../common/i18n'

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

/**
 * 缺省值与此前前端 mock 的效果一致；每日一言是公共领域的古语或谚语，不含博主身份。
 * 博主保存前按部署的站点默认语言返回，保存后以博主内容为准，不随访客界面语言变化。
 */
export function defaultSiteExtras(locale: ApiLocale = siteDefaultLocale()): SiteExtrasValues {
  if (locale === 'en')
    return {
      navigation: SITE_NAV_KEYS.map((key) => ({ type: 'route', key, visible: true })),
      footerLinks: [
        { label: 'About', url: '/about', newTab: false },
        { label: 'RSS', url: '/rss.xml', newTab: true },
        { label: 'Sitemap', url: '/sitemap.xml', newTab: true },
      ],
      quotes: [
        'A journey of a thousand miles begins with a single step.',
        'Stay curious, keep exploring.',
        'The best time to plant a tree was twenty years ago. The second best time is now.',
        'Well begun is half done.',
        'Little by little, one travels far.',
      ],
      icpNumber: '',
      icpUrl: '',
      copyright: '',
    }
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

/** 校验失败；localized 保留字典 key，转抛为 HTTP 异常时按请求语言翻译 */
export class SiteExtrasError extends Error {
  readonly localized: LocalizedMessage | string
  constructor(message: LocalizedMessage | string) {
    super(typeof message === 'string' ? message : message.message)
    this.localized = message
  }
}

function fail(message: LocalizedMessage): never {
  throw new SiteExtrasError(message)
}
const trimmedText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** 内置模块：只允许 key 与显示开关，模块不可重复，首页不能隐藏 */
function normalizeRouteNavItem(item: Record<string, unknown>, keys: Set<string>): SiteNavRouteItem {
  if (['label', 'url', 'newTab'].some((key) => item[key] !== undefined)) fail(msg('site.navRouteCustomized'))
  const key = String(item.key)
  if (!(SITE_NAV_KEYS as readonly string[]).includes(key)) fail(msg('site.navUnknownModule'))
  if (keys.has(key)) fail(msg('site.navModuleDuplicate'))
  keys.add(key)
  if (key === 'home' && !item.visible) fail(msg('site.navHomeHidden'))
  return { type: 'route', key: key as SiteNavKey, visible: item.visible as boolean }
}

/** 外链：不带 key，名称与 http(s) 地址必填且地址不重复 */
function normalizeExternalNavItem(item: Record<string, unknown>, urls: Set<string>): SiteNavExternalItem {
  if (item.key !== undefined) fail(msg('site.navExternalKey'))
  const label = trimmedText(item.label)
  const url = trimmedText(item.url)
  if (!label || label.length > SITE_LIMITS.navLabel)
    fail(msg('site.navExternalLabelLength', { max: SITE_LIMITS.navLabel }))
  if (url.length > SITE_LIMITS.url || !isHttpUrl(url)) fail(msg('site.navExternalUrlInvalid'))
  if (typeof item.newTab !== 'boolean') fail(msg('site.navExternalNewTab'))
  if (urls.has(url)) fail(msg('site.navExternalUrlDuplicate'))
  urls.add(url)
  return { type: 'external', label, url, newTab: item.newTab, visible: item.visible as boolean }
}

function normalizeNavItem(item: unknown, keys: Set<string>, urls: Set<string>): SiteNavItem {
  if (!item || typeof item !== 'object') fail(msg('site.navFormatInvalid'))
  const entry = item as Record<string, unknown>
  if (typeof entry.visible !== 'boolean') fail(msg('site.navVisibleBoolean'))
  if (entry.type === 'route') return normalizeRouteNavItem(entry, keys)
  if (entry.type === 'external') return normalizeExternalNavItem(entry, urls)
  return fail(msg('site.navItemTypeInvalid'))
}

/** 导航：外链数量受限，缺失的内置模块按显示追加到末尾 */
function normalizeNavigation(value: unknown): SiteNavItem[] {
  if (!Array.isArray(value)) fail(msg('site.navFormatInvalid'))
  const keys = new Set<string>()
  const urls = new Set<string>()
  const navigation: SiteNavItem[] = []
  for (const item of value as unknown[]) navigation.push(normalizeNavItem(item, keys, urls))
  if (urls.size > SITE_LIMITS.externalNav) fail(msg('site.navExternalTooMany', { max: SITE_LIMITS.externalNav }))
  for (const key of SITE_NAV_KEYS) if (!keys.has(key)) navigation.push({ type: 'route', key, visible: true })
  return navigation
}

function normalizeFooterLink(link: unknown, seen: Set<string>): SiteFooterLink {
  if (!link || typeof link !== 'object') return fail(msg('site.footerFormatInvalid'))
  const entry = link as Record<string, unknown>
  const label = trimmedText(entry.label)
  const url = trimmedText(entry.url)
  if (!label || label.length > SITE_LIMITS.footerLabel)
    fail(msg('site.footerLabelLength', { max: SITE_LIMITS.footerLabel }))
  if (url.length > SITE_LIMITS.url || (!isSitePath(url) && !isHttpUrl(url))) fail(msg('site.footerUrlInvalid'))
  if (typeof entry.newTab !== 'boolean') fail(msg('site.footerNewTab'))
  if (seen.has(url)) fail(msg('site.footerUrlDuplicate'))
  seen.add(url)
  return { label, url, newTab: entry.newTab }
}

/** 页脚链接：站内路径或 http(s) 地址，数量受限且地址不重复 */
function normalizeFooterLinks(value: unknown): SiteFooterLink[] {
  if (!Array.isArray(value)) fail(msg('site.footerFormatInvalid'))
  const links = value as unknown[]
  if (links.length > SITE_LIMITS.footerLinks) fail(msg('site.footerTooMany', { max: SITE_LIMITS.footerLinks }))
  const seen = new Set<string>()
  return links.map((link) => normalizeFooterLink(link, seen))
}

/** 每日一言：去掉首尾空白后非空、限长、不重复 */
function normalizeQuotes(value: unknown): string[] {
  if (!Array.isArray(value)) fail(msg('site.quotesFormatInvalid'))
  const quotes = (value as unknown[]).map(trimmedText)
  if (quotes.length > SITE_LIMITS.quotes) fail(msg('site.quotesTooMany', { max: SITE_LIMITS.quotes }))
  if (quotes.some((quote) => !quote || quote.length > SITE_LIMITS.quote))
    fail(msg('site.quoteLength', { max: SITE_LIMITS.quote }))
  if (new Set(quotes).size !== quotes.length) fail(msg('site.quotesDuplicate'))
  return quotes
}

const FILING_FIELDS = [
  ['icpNumber', SITE_LIMITS.icpNumber],
  ['icpUrl', SITE_LIMITS.icpUrl],
  ['copyright', SITE_LIMITS.copyright],
] as const

/** 备案号、备案链接与版权文案：单行、限长，去掉首尾空白 */
function normalizeFilingFields(
  input: Partial<Record<keyof SiteExtrasValues, unknown>>,
  result: Partial<SiteExtrasValues>,
) {
  for (const [key, max] of FILING_FIELDS) {
    const value = input[key]
    if (value === undefined) continue
    if (typeof value !== 'string' || value.trim().length > max || /[\r\n]/.test(value))
      fail(msg('site.filingFormatInvalid'))
    result[key] = value.trim()
  }
}

/**
 * 校验并规范化调用方提供的新字段；未提供的字段保持 undefined，由调用方决定沿用当前值。
 * 只保留每种条目允许的键，内置模块缺失时按显示追加到末尾，首页不能隐藏。
 */
export function normalizeSiteExtrasInput(input: Partial<Record<keyof SiteExtrasValues, unknown>>) {
  const result: Partial<SiteExtrasValues> = {}
  if (input.navigation !== undefined) result.navigation = normalizeNavigation(input.navigation)
  if (input.footerLinks !== undefined) result.footerLinks = normalizeFooterLinks(input.footerLinks)
  if (input.quotes !== undefined) result.quotes = normalizeQuotes(input.quotes)
  normalizeFilingFields(input, result)
  if (result.icpUrl && !isHttpUrl(result.icpUrl)) fail(msg('site.filingUrlInvalid'))
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

/**
 * 公开读取的导航：隐藏的外链不对外返回，避免暴露博主未公开的地址；
 * 内置模块即使隐藏也保留条目，否则前端会按缺失模块补回为可见。
 */
export function publicSiteNavigation(navigation: readonly SiteNavItem[]): SiteNavItem[] {
  return navigation.filter((item) => item.type === 'route' || item.visible)
}
