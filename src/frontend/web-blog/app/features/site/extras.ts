/**
 * @file extras.ts
 * @description 后台“导航与页脚”编辑区的即时校验，规则与服务端 site-navigation.ts 一致；最终以服务端校验为准
 */
import type { SiteSettingsData } from './settings'
import { MAX_EXTERNAL_NAV } from '~/features/nav/routes'
import { MAX_FOOTER_LINKS, MAX_QUOTES, MAX_QUOTE_LENGTH } from './footer'
import { currentTranslate, type Translate } from '~/utils/format'

export const SITE_EXTRA_LIMITS = {
  navLabel: 20,
  footerLabel: 30,
  url: 1000,
  icpNumber: 40,
  icpUrl: 300,
  copyright: 200,
} as const

/** 不带凭据的 http(s) 地址 */
export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !/[\s\\]/.test(value)
  } catch {
    return false
  }
}
/** 站内路径：单个斜杠开头，不含空白、反斜杠或协议相对写法 */
export function isSitePath(value: string) {
  return /^\/(?!\/)[^\s\\]*$/.test(value)
}

type ExtrasValue = Pick<
  SiteSettingsData,
  'navigation' | 'footerLinks' | 'quotes' | 'icpNumber' | 'icpUrl' | 'copyright'
>

const V = 'admin-system.siteValidation'

/**
 * 返回字段标识到错误文案的映射；字段标识与编辑组件中的输入框一一对应。
 * 文案按调用时的界面语言生成，组件可显式传入 t。
 */
export function siteExtrasErrors(value: ExtrasValue, t: Translate = currentTranslate()): Record<string, string> {
  const errors: Record<string, string> = {}
  const navUrls = new Set<string>()
  let external = 0
  value.navigation.forEach((entry, index) => {
    if (entry.type !== 'external') return
    external++
    const label = entry.label.trim()
    const url = entry.url.trim()
    if (!label || label.length > SITE_EXTRA_LIMITS.navLabel)
      errors[`nav-${index}-label`] = t(`${V}.labelLength`, { max: SITE_EXTRA_LIMITS.navLabel })
    if (!isHttpUrl(url) || url.length > SITE_EXTRA_LIMITS.url) errors[`nav-${index}-url`] = t(`${V}.navUrl`)
    else if (navUrls.has(url)) errors[`nav-${index}-url`] = t(`${V}.navUrlDuplicate`)
    navUrls.add(url)
  })
  if (external > MAX_EXTERNAL_NAV) errors.navigation = t(`${V}.navigationMax`, { max: MAX_EXTERNAL_NAV })
  const footerUrls = new Set<string>()
  value.footerLinks.forEach((link, index) => {
    const label = link.label.trim()
    const url = link.url.trim()
    if (!label || label.length > SITE_EXTRA_LIMITS.footerLabel)
      errors[`footer-${index}-label`] = t(`${V}.labelLength`, { max: SITE_EXTRA_LIMITS.footerLabel })
    if ((!isSitePath(url) && !isHttpUrl(url)) || url.length > SITE_EXTRA_LIMITS.url)
      errors[`footer-${index}-url`] = t(`${V}.footerUrl`)
    else if (footerUrls.has(url)) errors[`footer-${index}-url`] = t(`${V}.footerUrlDuplicate`)
    footerUrls.add(url)
  })
  if (value.footerLinks.length > MAX_FOOTER_LINKS)
    errors.footerLinks = t(`${V}.footerLinksMax`, { max: MAX_FOOTER_LINKS })
  const quotes = new Set<string>()
  value.quotes.forEach((quote, index) => {
    const text = quote.trim()
    if (!text || text.length > MAX_QUOTE_LENGTH)
      errors[`quote-${index}`] = t(`${V}.quoteLength`, { max: MAX_QUOTE_LENGTH })
    else if (quotes.has(text)) errors[`quote-${index}`] = t(`${V}.quoteDuplicate`)
    quotes.add(text)
  })
  if (value.quotes.length > MAX_QUOTES) errors.quotes = t(`${V}.quotesMax`, { max: MAX_QUOTES })
  if (value.icpNumber.trim().length > SITE_EXTRA_LIMITS.icpNumber)
    errors.icpNumber = t(`${V}.icpNumberMax`, { max: SITE_EXTRA_LIMITS.icpNumber })
  const icpUrl = value.icpUrl.trim()
  if (icpUrl && (!isHttpUrl(icpUrl) || icpUrl.length > SITE_EXTRA_LIMITS.icpUrl)) errors.icpUrl = t(`${V}.icpUrl`)
  if (value.copyright.trim().length > SITE_EXTRA_LIMITS.copyright)
    errors.copyright = t(`${V}.copyrightMax`, { max: SITE_EXTRA_LIMITS.copyright })
  return errors
}
