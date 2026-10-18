/**
 * @file footer.ts
 * @description 页脚链接、版权文案、备案号与每日一言的缺省值和展示转换；Powered by 为框架声明，保持代码内置
 */
import type { FooterLink, PoweredByItem, SiteFooterLinkSetting } from './types'

/** 页脚链接上限，与服务端一致 */
export const MAX_FOOTER_LINKS = 8
/** 每日一言条数与单条长度上限，与服务端一致 */
export const MAX_QUOTES = 30
export const MAX_QUOTE_LENGTH = 120
/** 未填写备案链接时指向工信部备案查询 */
export const DEFAULT_ICP_URL = 'https://beian.miit.gov.cn/'

/** 框架声明，不随站点设置变化 */
export const poweredByItems: PoweredByItem[] = [
  { label: 'Nuxt', href: 'https://nuxt.com' },
  { label: 'Vue', href: 'https://vuejs.org' },
]

/** 缺省页脚链接，等于此前写死的效果 */
export function defaultFooterLinks(): SiteFooterLinkSetting[] {
  return [
    { label: '关于本站', url: '/about', newTab: false },
    { label: 'RSS 订阅', url: '/rss.xml', newTab: true },
    { label: '站点地图', url: '/sitemap.xml', newTab: true },
  ]
}

/** 缺省每日一言：公共领域的古语与常用语，不含博主身份 */
export function defaultQuotes(): string[] {
  return [
    '路漫漫其修远兮，吾将上下而求索。',
    '保持热爱，奔赴山海。',
    '种一棵树最好的时间是十年前，其次是现在。',
    '心之所向，素履以往。',
    '不积跬步，无以至千里。',
  ]
}

/** 站外地址或带扩展名的服务端文件（如 /rss.xml）不能交给 Nuxt 路由 */
function isNativeLink(url: string) {
  return /^https?:\/\//i.test(url) || /\.[a-z0-9]+$/i.test(url.split(/[?#]/)[0] ?? '')
}

/** 站点设置的页脚链接转展示项；旧接口未返回时使用缺省链接 */
export function buildFooterLinks(links: readonly SiteFooterLinkSetting[] | undefined | null): FooterLink[] {
  const list: readonly SiteFooterLinkSetting[] = Array.isArray(links)
    ? (links as SiteFooterLinkSetting[])
    : defaultFooterLinks()
  return list.map((link) => ({
    label: link.label,
    href: link.url,
    external: link.newTab || isNativeLink(link.url),
    newTab: link.newTab,
  }))
}

/** 版权文案：留空使用默认格式；自定义文案支持 {year} 与 {siteName} 占位 */
export function formatCopyright(text: string | undefined, year: number, siteName: string) {
  const custom = text?.trim()
  if (!custom) return `© ${year} ${siteName}. All rights reserved.`
  return custom.replaceAll('{year}', String(year)).replaceAll('{siteName}', siteName)
}

/** 随机取一条每日一言；列表为空时返回空串，由组件隐藏 */
export function pickQuote(quotes: readonly string[], random = Math.random) {
  return quotes.length ? (quotes[Math.floor(random() * quotes.length)] ?? '') : ''
}
