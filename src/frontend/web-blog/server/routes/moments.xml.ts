/**
 * @file moments.xml.ts
 * @description 朋友圈 RSS 仅发布真实公开动态，使用运行时站点地址并及时反映撤回；
 *              language 与频道标题后缀跟随站点默认语言（服务端没有 Nuxt i18n 实例，使用本文件的小映射），条目内容不翻译
 */
import { resolveDefaultLocale, type SupportedLocale } from '../../i18n/localeOptions'
import {
  escapeXml,
  latestDate,
  publicFeedUrl,
  publicMoments,
  publicSiteSettings,
  publicSiteUrl,
  sendFeed,
} from '../utils/publicContent'

/** 频道标题；中文与 zh-CN 字典 common.feed.momentsRss 的站名后缀一致 */
const CHANNEL_TITLE: Record<SupportedLocale, (site: string) => string> = {
  'zh-CN': (site) => `${site} 朋友圈`,
  en: (site) => `${site} Moments`,
}

const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
}

export default defineEventHandler(async (event) => {
  // 失败响应不缓存；成功时由 sendFeed 改为短期缓存
  setResponseHeader(event, 'cache-control', 'no-store')
  assertMethod(event, ['GET', 'HEAD'])
  const site = publicSiteUrl(event)
  const [moments, settings] = await Promise.all([publicMoments(event), publicSiteSettings(event)])
  const creator = escapeXml(settings.ownerName || settings.name)
  const locale = resolveDefaultLocale(
    (useRuntimeConfig(event).public as { i18n?: { defaultLocale?: unknown } }).i18n?.defaultLocale,
  )
  const items = moments
    .map((moment) => {
      const oneLine = moment.content.replace(/\s+/g, ' ').trim()
      const title = oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine
      const link = `${site}/moments/${encodeURIComponent(moment.id)}`
      const image = publicFeedUrl(moment.images?.[0], site)
      const imageType = image ? imageTypes[new URL(image).pathname.split('.').at(-1)!.toLowerCase()] : undefined
      const enclosure =
        image && imageType ? `<enclosure url="${escapeXml(image)}" type="${imageType}" length="0" />` : ''
      // 先把正文转为安全 HTML，再整体转义为 XML 文本，避免 CDATA 终止符和阅读器 HTML 注入。
      const description =
        escapeXml(moment.content).replace(/\r?\n/g, '<br />') +
        (image ? `<p><img src="${escapeXml(image)}" alt="" /></p>` : '')
      const categories = (moment.topics ?? []).map((topic) => `<category>${escapeXml(topic)}</category>`).join('')
      return `<item><title>${escapeXml(title)}</title>
<link>${escapeXml(link)}</link><guid isPermaLink="true">${escapeXml(link)}</guid>
<description>${escapeXml(description)}</description><pubDate>${new Date(moment.date).toUTCString()}</pubDate>
<dc:creator>${creator}</dc:creator>${categories}${enclosure}</item>`
    })
    .join('\n')
  const updated = latestDate([settings.updatedAt, ...moments.map((moment) => moment.date)])
  return sendFeed(
    event,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${escapeXml(CHANNEL_TITLE[locale](settings.name))}</title><link>${escapeXml(site + '/moments')}</link>
<description>${escapeXml(settings.description)}</description><language>${locale}</language>
<lastBuildDate>${updated.toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(site + '/moments.xml')}" rel="self" type="application/rss+xml" />
${items}
</channel></rss>`,
    updated,
  )
})
