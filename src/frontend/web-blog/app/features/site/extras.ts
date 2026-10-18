/**
 * @file extras.ts
 * @description 后台“导航与页脚”编辑区的即时校验，规则与服务端 site-navigation.ts 一致；最终以服务端校验为准
 */
import type { SiteSettingsData } from './settings'
import { MAX_EXTERNAL_NAV } from '~/features/nav/routes'
import { MAX_FOOTER_LINKS, MAX_QUOTES, MAX_QUOTE_LENGTH } from './footer'

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

/** 返回字段标识到错误文案的映射；字段标识与编辑组件中的输入框一一对应 */
export function siteExtrasErrors(value: ExtrasValue): Record<string, string> {
  const errors: Record<string, string> = {}
  const navUrls = new Set<string>()
  let external = 0
  value.navigation.forEach((entry, index) => {
    if (entry.type !== 'external') return
    external++
    const label = entry.label.trim()
    const url = entry.url.trim()
    if (!label || label.length > SITE_EXTRA_LIMITS.navLabel)
      errors[`nav-${index}-label`] = `请填写 1–${SITE_EXTRA_LIMITS.navLabel} 个字符的名称`
    if (!isHttpUrl(url) || url.length > SITE_EXTRA_LIMITS.url)
      errors[`nav-${index}-url`] = '外链仅支持 http:// 或 https:// 开头的完整地址'
    else if (navUrls.has(url)) errors[`nav-${index}-url`] = '与其他外链导航地址重复'
    navUrls.add(url)
  })
  if (external > MAX_EXTERNAL_NAV) errors.navigation = `外链导航最多 ${MAX_EXTERNAL_NAV} 个`
  const footerUrls = new Set<string>()
  value.footerLinks.forEach((link, index) => {
    const label = link.label.trim()
    const url = link.url.trim()
    if (!label || label.length > SITE_EXTRA_LIMITS.footerLabel)
      errors[`footer-${index}-label`] = `请填写 1–${SITE_EXTRA_LIMITS.footerLabel} 个字符的名称`
    if ((!isSitePath(url) && !isHttpUrl(url)) || url.length > SITE_EXTRA_LIMITS.url)
      errors[`footer-${index}-url`] = '请填写以 / 开头的站内路径，或 http(s) 完整地址'
    else if (footerUrls.has(url)) errors[`footer-${index}-url`] = '与其他页脚链接地址重复'
    footerUrls.add(url)
  })
  if (value.footerLinks.length > MAX_FOOTER_LINKS) errors.footerLinks = `页脚链接最多 ${MAX_FOOTER_LINKS} 个`
  const quotes = new Set<string>()
  value.quotes.forEach((quote, index) => {
    const text = quote.trim()
    if (!text || text.length > MAX_QUOTE_LENGTH) errors[`quote-${index}`] = `请填写 1–${MAX_QUOTE_LENGTH} 个字符`
    else if (quotes.has(text)) errors[`quote-${index}`] = '与前面的一言重复'
    quotes.add(text)
  })
  if (value.quotes.length > MAX_QUOTES) errors.quotes = `每日一言最多 ${MAX_QUOTES} 条`
  if (value.icpNumber.trim().length > SITE_EXTRA_LIMITS.icpNumber)
    errors.icpNumber = `备案号最多 ${SITE_EXTRA_LIMITS.icpNumber} 个字符`
  const icpUrl = value.icpUrl.trim()
  if (icpUrl && (!isHttpUrl(icpUrl) || icpUrl.length > SITE_EXTRA_LIMITS.icpUrl))
    errors.icpUrl = '备案链接仅支持 http(s) 完整地址，留空使用工信部备案查询'
  if (value.copyright.trim().length > SITE_EXTRA_LIMITS.copyright)
    errors.copyright = `版权文案最多 ${SITE_EXTRA_LIMITS.copyright} 个字符`
  return errors
}
